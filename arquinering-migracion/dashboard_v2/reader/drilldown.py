"""Deep-dives del dashboard v2 (estructura v8_6). Mismo contrato JSON que v1.

  rubro_detail       — tareas (1_Presupuesto) + composición (1_Composicion) +
                       gastos incurridos (2_Movimientos por Desc Cuenta).
  subcontrato_detail — pagos de un contrato (2_Movimientos por ID en Observaciones).
  mes_detail         — egresos de un mes (2_Movimientos por mes derivado).
  etapa_detail       — partidas de un presupuesto/OC (1_Presupuesto por col Presupuesto).

Reconciliación: los subtotales se comparan contra Control y se reporta el delta
(auditable), no se esconde.
"""
import re

from . import nav
from .movimientos import load_movimientos, load_gastos_dirind

TOL = 1.0
_DOT = re.compile(r"^\d+\.\d+$")


def _is_item(v):
    return v is not None and bool(_DOT.match(str(v).strip()))


def _detect_item_col(ws, hr, max_scan=80):
    best, bestc = None, 0
    for c in range(1, ws.max_column + 1):
        n = sum(1 for r in range(hr + 1, min(hr + 1 + max_scan, ws.max_row + 1))
                if _is_item(ws.cell(row=r, column=c).value))
        if n > bestc:
            best, bestc = c, n
    return best


def _ppto_item_set(ws, hr):
    ic = _detect_item_col(ws, hr)
    s = set()
    if ic:
        for r in range(hr + 1, ws.max_row + 1):
            v = ws.cell(row=r, column=ic).value
            if _is_item(v):
                s.add(str(v).strip())
    return s, ic


# --------------------------------------------------- 1_Presupuesto (tareas)
def _presupuesto_tareas(wb, rubro, tipo):
    ws = wb["1_Presupuesto"]
    hr = nav.find_row_scan(ws, "rubro", "mt")
    _, item_col = _ppto_item_set(ws, hr)
    col = nav.map_columns(ws, hr, {
        "a":   {"all": ["rubro", "mt"], "not": ["prov", "otr", "alb"]},
        "c":   {"all": ["rubro", "otr"]},
        "d":   {"all": ["rubro", "alb"]},
        "desc": {"all": ["descripcion"]},
        "cant": {"all": ["cant"]},
        "mt":  {"all": ["mt"], "not": ["rubro", "mo", "prov", "acum", "vta", "tot", "pv"]},
        "otr": {"all": ["otr"], "not": ["rubro", "acum", "vta"]},
        "alb": {"all": ["alb"], "not": ["rubro", "acum", "vta"]},
        "pv":  {"any": ["pv subtotal", "subtotal"], "not": ["acum"]},   # PV total de la tarea
        "costo_total": {"all": ["costo", "total"]},                     # Costo total de la tarea
    })
    rn = nav.norm(rubro)
    tareas = []
    for r in range(hr + 1, ws.max_row + 1):
        cant = nav.num(ws.cell(row=r, column=col["cant"]).value, 0) if "cant" in col else 0
        # Cada apertura de rubro suma su tipo si su columna matchea el rubro. MT drill -> sólo MAT
        # (col A); MO drill -> OTR/ALB (col C/D); rubro SIN tipo (p.ej. "Preliminares", que vive en
        # A+C+D) -> los 3, para cerrar con el Costo de Obra. subs = keys (MAT/OTR/ALB) a mostrar.
        tu = tipo.upper()
        inc_mat = tu == "MT" or tu not in ("MT", "MO")
        inc_mo = tu == "MO" or tu not in ("MT", "MO")
        cost = 0.0
        subs = set()
        if inc_mat and "a" in col and nav.norm(ws.cell(row=r, column=col["a"]).value) == rn:
            cost += nav.num(ws.cell(row=r, column=col["mt"]).value) if "mt" in col else 0.0
            subs.add("MAT")
        if inc_mo and "c" in col and nav.norm(ws.cell(row=r, column=col["c"]).value) == rn:
            cost += nav.num(ws.cell(row=r, column=col["otr"]).value) if "otr" in col else 0.0
            subs.add("OTR")
        if inc_mo and "d" in col and nav.norm(ws.cell(row=r, column=col["d"]).value) == rn:
            cost += nav.num(ws.cell(row=r, column=col["alb"]).value) if "alb" in col else 0.0
            subs.add("ALB")
        # cant=0 -> presupuesto efectivo 0 (costo es por-unidad × cant). El Costo de Obra
        # (_presupuesto: K*J) ya las excluye; se excluyen del drill para que cierren.
        if cost == 0 or not cant:
            continue
        desc = ws.cell(row=r, column=col["desc"]).value if "desc" in col else None
        item = ws.cell(row=r, column=item_col).value if item_col else None
        # margen ppto de la tarea (completa) = PV subtotal ÷ Costo total
        pv_t = nav.num(ws.cell(row=r, column=col["pv"]).value) if "pv" in col else 0.0
        costo_t = nav.num(ws.cell(row=r, column=col["costo_total"]).value) if "costo_total" in col else 0.0
        tareas.append({
            "descripcion": str(desc).strip() if desc else "",
            "item": str(item).strip() if _is_item(item) else None,
            "cant": cant,
            "monto": cost * cant,   # v8_6: costos por-unidad → ×cant
            "pv_tarea": pv_t,
            "margen": (pv_t / costo_t) if costo_t else None,
            "_subs": subs,
        })
    tareas.sort(key=lambda x: x["monto"], reverse=True)
    return tareas


# --------------------------------------------------- 1_Composicion (insumos)
def _composicion_por_item(wb, tipo):
    try:
        ws = wb["1_Composicion"]
    except KeyError:
        return {}
    wp = wb["1_Presupuesto"]
    hrp = nav.find_row_scan(wp, "rubro", "mt")
    itemset, _ = _ppto_item_set(wp, hrp)
    if not itemset:
        return {}
    best, bestc = None, 0
    for c in range(1, ws.max_column + 1):
        n = sum(1 for r in range(2, ws.max_row + 1)
                if str(ws.cell(row=r, column=c).value or "").strip() in itemset)
        if n > bestc:
            best, bestc = c, n
    if not best:
        return {}
    linkc = best
    col = nav.map_columns(ws, 1, {
        "tipo": {"all": ["tipo"]},
        "subtipo": {"all": ["subtipo"]},
        "desc": {"all": ["descripcion"]},
        "unidad": {"any": ["unidad"]},
        "cant": {"all": ["cant"], "not": ["mo", "ej", "total", "unit", "rend"]},
        "precio": {"all": ["precio"]},
        "costo": {"all": ["costo"]},
        "alb_ud": {"all": ["cant", "alb", "unit"]},
    })
    # Devuelve TODOS los insumos no-EQ por ítem, etiquetados con una 'key' (MAT/OTR/ALB) que matchea
    # la apertura de rubro de 1_Presupuesto (A=MAT, C=MO/OTR, D=MO/ALB). El filtrado por tipo/rubro
    # lo hace rubro_detail vía el set 'subs' de la tarea — así un rubro sin split MT/MO (p.ej.
    # "Preliminares", que vive en A+C+D) drillea sus 3 aperturas y cierra con el Costo de Obra. EQ
    # excluido del costo controlable (decisión 2026-06-13).
    out = {}
    for r in range(2, ws.max_row + 1):
        itv = str(ws.cell(row=r, column=linkc).value or "").strip()
        if itv not in itemset:
            continue
        tp = str(ws.cell(row=r, column=col["tipo"]).value or "").strip().upper() if "tipo" in col else ""
        if tp not in ("MAT", "MO"):   # excluir EQ y filas sin tipo
            continue
        sub = str(ws.cell(row=r, column=col["subtipo"]).value or "").strip().upper() if "subtipo" in col else ""
        key = "MAT" if tp == "MAT" else ("ALB" if sub == "ALB" else "OTR")
        precio = nav.num(ws.cell(row=r, column=col["precio"]).value) if "precio" in col else 0.0
        costo = nav.num(ws.cell(row=r, column=col["costo"]).value) if "costo" in col else 0.0
        alb_ud = nav.num(ws.cell(row=r, column=col["alb_ud"]).value) if "alb_ud" in col else 0.0
        monto_ud = precio * alb_ud if (tp == "MO" and sub == "ALB") else costo
        out.setdefault(itv, []).append({
            "tipo": tp, "subtipo": sub, "key": key,
            "desc": str(ws.cell(row=r, column=col["desc"]).value or "").strip() if "desc" in col else "",
            "unidad": str(ws.cell(row=r, column=col["unidad"]).value or "").strip() if "unidad" in col else "",
            "cant": nav.num(ws.cell(row=r, column=col["cant"]).value) if "cant" in col else 0.0,
            "precio": precio,
            "_monto_ud": monto_ud,
        })
    return out


# --------------------------------------------------- gastos (2_Movimientos)
def _gastos_rubro(movs, rubro):
    rn = nav.norm(rubro)
    out = []
    for m in movs:
        if m["tipo_mov"] != "EGRESO" or nav.norm(m["rubro"]) != rn:
            continue
        out.append({
            "fuente": "Movimiento",
            "fecha": m["fecha"],
            "proveedor": m["proveedor"],
            "concepto": m["obs"] or m["rubro"],
            "real": m["real"],
            "descontado": m["descontado"],
            "en_ppto": True,
        })
    return out


# --------------------------------------------------- ensamble rubro
def rubro_detail(wb, rubro, tipo, control=None):
    control = control or {}
    movs = load_movimientos(wb)
    tareas = _presupuesto_tareas(wb, rubro, tipo)
    comp_idx = _composicion_por_item(wb, tipo)
    for t in tareas:
        insumos = comp_idx.get(t.get("item") or "", [])
        subs = t.pop("_subs", None)
        cant = t["cant"] or 1
        ins_out, comp_total = [], 0.0
        for ins in insumos:
            if subs is not None and ins["key"] not in subs:
                continue
            m = ins["_monto_ud"] * cant
            comp_total += m
            ins_out.append({"tipo": ins["tipo"], "subtipo": ins["subtipo"],
                            "desc": ins["desc"], "unidad": ins["unidad"],
                            "cant": ins["cant"], "precio": ins["precio"], "monto": m})
        ins_out.sort(key=lambda x: x["monto"], reverse=True)
        t["insumos"] = ins_out
        t["comp_total"] = comp_total
        tol = max(TOL, 0.005 * abs(t["monto"]))
        t["comp_ok"] = (abs(comp_total - t["monto"]) <= tol) if ins_out else None

    gastos = _gastos_rubro(movs, rubro)
    gastos.sort(key=lambda x: x["real"], reverse=True)

    presup = sum(t["monto"] for t in tareas)
    real = sum(g["real"] for g in gastos)
    descontado = sum(g["descontado"] for g in gastos)
    for t in tareas:
        t["pct"] = (t["monto"] / presup) if presup else 0.0
    for g in gastos:
        g["pct"] = (g["descontado"] / descontado) if descontado else 0.0

    # concentración por proveedor (top 3 + resto), por gasto deflactado
    agg = {}
    for g in gastos:
        key = g["proveedor"] or g["concepto"] or g["fuente"]
        agg[key] = agg.get(key, 0.0) + g["descontado"]
    conc = sorted(({"proveedor": k, "descontado": v, "pct": (v / descontado) if descontado else 0.0}
                   for k, v in agg.items()), key=lambda x: x["descontado"], reverse=True)
    concentracion = conc[:3]
    if len(conc) > 3:
        resto = conc[3:]
        concentracion = concentracion + [{"proveedor": f"otros {len(resto)}",
                                           "descontado": sum(x["descontado"] for x in resto),
                                           "pct": sum(x["pct"] for x in resto)}]

    inflacion = real - descontado

    def recon(calc, ref):
        if ref is None:
            return None
        return {"calc": calc, "control": ref, "delta": calc - ref, "ok": abs(calc - ref) < TOL}

    return {
        "rubro": rubro, "tipo": tipo,
        "presupuesto": tareas, "gastos": gastos,
        "usa_cant": True,
        "concentracion": concentracion,
        "fuente_split": None,
        "subtotales": {
            "presupuestado": presup, "real": real, "descontado": descontado,
            "saldo": presup - descontado,
            "consumido_pct": (descontado / presup) if presup else None,
            "sobregiro": max(0.0, descontado - presup),
            "inflacion_monto": inflacion,
            "inflacion_pct": (inflacion / descontado) if descontado else None,
        },
        "reconciliacion": {
            "presupuesto": recon(presup, control.get("presupuestado")),
            "real": recon(real, control.get("acum_real")),
            "descontado": recon(descontado, control.get("acum_descontado")),
        },
    }


# =================================================================
#  SUBCONTRATOS — pagos de un contrato (2_Movimientos por ID en Observaciones)
# =================================================================
def subcontrato_detail(wb, contrato, control=None):
    control = control or {}
    movs = load_movimientos(wb)
    cn = nav.norm(contrato)
    pagos = []
    for m in movs:
        if not m["sc_id"] or nav.norm(m["sc_id"]) != cn:
            continue
        # Regla CAC/CS (SPEC §4, igual que el control): sólo BASE+ANT descuentan saldo.
        # CAC y CS (cargas sociales) suman gasto pero NO van a 'base' (no descuentan).
        t = (m["sc_tipo"] or "").upper()
        es_cac = t == "CAC"
        es_cs = t in ("CS", "CARGAS SOCIALES", "CARGAS")
        pagos.append({
            "fuente": "Movimiento",
            "fecha": m["fecha"],
            "proveedor": m["proveedor"],
            "concepto": (m["sc_tipo"] or "AVANCE").title() + ((" · " + m["obs"]) if m["obs"] else ""),
            "base": 0.0 if (es_cac or es_cs) else m["real"],
            "cac": m["real"] if es_cac else 0.0,
            "cargas": m["real"] if es_cs else 0.0,
            "real": m["real"],
        })
    pagos.sort(key=lambda x: x["real"], reverse=True)
    base = sum(p["base"] for p in pagos)
    cac = sum(p["cac"] for p in pagos)
    cargas = sum(p["cargas"] for p in pagos)
    real = sum(p["real"] for p in pagos)
    presup = control.get("presupuesto")
    saldo = (presup - base) if presup is not None else None   # base = BASE+ANT (descuenta), cierra con el control
    return {
        "contrato": contrato,
        "proveedor": control.get("proveedor"), "rubro": control.get("rubro"),
        "pagos": pagos,
        "subtotales": {
            "base": base, "cac": cac, "cargas": cargas, "real": real,
            "presupuesto": presup, "saldo": saldo,
            "consumido_pct": (base / presup) if presup else None,
        },
    }


# =================================================================
#  CASH FLOW — egresos de un mes por rubro (2_Movimientos por mes)
# =================================================================
def mes_detail(wb, mes_iso):
    ym = mes_iso[:7]
    movs = load_movimientos(wb)
    porrubro = {}
    movimientos = []
    for m in movs:
        if m["tipo_mov"] != "EGRESO" or not m["mes"] or m["mes"][:7] != ym:
            continue
        real = m["real"]
        # se incluyen los negativos (notas de crédito / ajustes de egreso): netean en su rubro,
        # igual que el chart de cash flow, para que el drill del mes RECONCILIE con la barra (T2-1).
        # En v2 un EGRESO negativo (cuenta 53xx, Debe<Haber) es un ajuste de gasto, no un ingreso.
        if real == 0:
            continue
        rub = m["rubro"] or "(sin rubro)"
        if rub == "-":
            rub = "(sin rubro)"
        pr = porrubro.setdefault(rub, {"rubro": rub, "real": 0.0, "descontado": 0.0, "n": 0})
        pr["real"] += real
        pr["descontado"] += m["descontado"]
        pr["n"] += 1
        movimientos.append({
            "rubro": rub, "proveedor": m["proveedor"], "concepto": m["obs"],
            "real": real, "descontado": m["descontado"],
        })
    # gastos directos/indirectos del mes (2_Gastos_DirInd, por fuera de Tezamat)
    for x in load_gastos_dirind(wb):
        if not x["mes"] or x["mes"][:7] != ym:
            continue
        rub = "Gastos " + ("Indirectos" if x["tipo"] == "Indirecto" else "Directos")
        pr = porrubro.setdefault(rub, {"rubro": rub, "real": 0.0, "descontado": 0.0, "n": 0})
        pr["real"] += x["real"]
        pr["descontado"] += x["descontado"]
        pr["n"] += 1
        movimientos.append({
            "rubro": rub, "proveedor": x["concepto"], "concepto": x["concepto"],
            "real": x["real"], "descontado": x["descontado"],
        })
    rubros = sorted(porrubro.values(), key=lambda x: x["real"], reverse=True)
    movimientos.sort(key=lambda x: x["real"], reverse=True)
    return {
        "mes": ym, "rubros": rubros, "movimientos": movimientos,
        "total_real": sum(x["real"] for x in rubros),
        "total_descontado": sum(x["descontado"] for x in rubros),
        "n_movimientos": sum(x["n"] for x in rubros),
    }


# =================================================================
#  AVANCE POR ETAPA — partidas de un presupuesto/OC (1_Presupuesto col Presupuesto)
# =================================================================
def etapa_detail(wb, etapa, control=None):
    control = control or {}
    ws = wb["1_Presupuesto"]
    hr = nav.find_row_scan(ws, "rubro", "mt")
    col = nav.map_columns(ws, hr, {
        "presupuesto": {"all": ["presupuesto"]},
        "etapa":       {"all": ["etapa"]},
        "cod":         {"any": ["cod"]},                                       # 'Cod. Ítem'
        "desc":        {"all": ["descripcion"]},
        "pv":          {"any": ["pv subtotal", "subtotal"], "not": ["acum"]},
        "avance_pct":  {"all": ["acum", "tot"], "not": ["ant", "$", "imp"]},   # '% Acum Tot'
    })
    en = nav.norm(etapa)
    # clave de filtro: 'Presupuesto' (PTO 01/02) si matchea; si no, 'Etapa'
    key_col = "presupuesto" if "presupuesto" in col else "etapa"
    partidas = []
    for r in range(hr + 1, ws.max_row + 1):
        kv = nav.norm(ws.cell(row=r, column=col[key_col]).value) if key_col in col else ""
        if kv != en:
            continue
        desc = ws.cell(row=r, column=col["desc"]).value if "desc" in col else None
        if not desc:
            continue
        pv = nav.num(ws.cell(row=r, column=col["pv"]).value) if "pv" in col else 0.0
        av = nav.num(ws.cell(row=r, column=col["avance_pct"]).value) if "avance_pct" in col else 0.0
        cert = av * pv   # $ certificado = % Acum Tot × PV subtotal (col $ ya no en 1_Presupuesto)
        if pv == 0 and cert == 0:
            continue
        cod = ws.cell(row=r, column=col["cod"]).value if "cod" in col else None
        partidas.append({
            "cod": str(cod).strip() if (cod is not None and _is_item(cod)) else "",
            "descripcion": str(desc).strip(),
            "ppto_venta": pv, "certificado": cert, "avance_pct": av,
        })
    partidas.sort(key=lambda x: x["ppto_venta"], reverse=True)
    pv_tot = sum(p["ppto_venta"] for p in partidas)
    cert_tot = sum(p["certificado"] for p in partidas)
    return {
        "etapa": etapa,
        "partidas": partidas,
        "subtotales": {
            "ppto_venta": pv_tot, "certificado": cert_tot,
            "avance_pct": (cert_tot / pv_tot) if pv_tot else 0.0,
        },
        "control": control,
    }


# =================================================================
#  CERTIFICADO — tareas que componen una certificación (Cert_App_Output por ID Certif)
# =================================================================
def cert_detail(wb, cert_id):
    """Tareas que compusieron una certificación: % actual (de esta cert), % acum total y $ base,
    desde Cert_App_Output filtrado por ID Certif, con la descripción traída de 1_Presupuesto."""
    try:
        ws = wb["Cert_App_Output"]
    except KeyError:
        return {"cert_id": cert_id, "tareas": [], "subtotales": {"base": 0.0}}
    hr = nav.find_row(ws, "id certif") or nav.find_row_scan(ws, "cod", "tarea") or 1
    col = nav.map_columns(ws, hr, {
        "idcert": {"all": ["id", "certif"]},
        "cod":    {"all": ["cod", "tarea"]},
        "pact":   {"all": ["%", "actual"]},
        "ptot":   {"all": ["%", "total"]},
        "base":   {"all": ["base"]},
    })
    # descripciones desde 1_Presupuesto (por código de ítem)
    desc_by_cod = {}
    try:
        wp = wb["1_Presupuesto"]
        hrp = nav.find_row_scan(wp, "rubro", "mt")
        _, item_col = _ppto_item_set(wp, hrp)
        dcol = nav.map_columns(wp, hrp, {"desc": {"all": ["descripcion"]}}).get("desc")
        if item_col and dcol:
            for r in range(hrp + 1, wp.max_row + 1):
                it = wp.cell(row=r, column=item_col).value
                if _is_item(it):
                    desc_by_cod[str(it).strip()] = str(wp.cell(row=r, column=dcol).value or "").strip()
    except KeyError:
        pass

    cn = nav.norm(cert_id)
    tareas = []
    for r in range(hr + 1, ws.max_row + 1):
        idc = nav.norm(ws.cell(row=r, column=col["idcert"]).value) if "idcert" in col else ""
        if idc != cn:
            continue
        cod = ws.cell(row=r, column=col["cod"]).value if "cod" in col else None
        cods = str(cod).strip() if cod is not None else ""
        pact = nav.num(ws.cell(row=r, column=col["pact"]).value) if "pact" in col else 0.0
        ptot = nav.num(ws.cell(row=r, column=col["ptot"]).value) if "ptot" in col else 0.0
        base = nav.num(ws.cell(row=r, column=col["base"]).value) if "base" in col else 0.0
        if pact == 0 and base == 0:
            continue
        tareas.append({
            "cod": cods,
            "descripcion": desc_by_cod.get(cods, ""),
            "pct_actual": pact, "pct_total": ptot, "base": base,
        })
    tareas.sort(key=lambda x: x["base"], reverse=True)
    return {
        "cert_id": cert_id,
        "tareas": tareas,
        "subtotales": {"base": sum(t["base"] for t in tareas)},
    }
