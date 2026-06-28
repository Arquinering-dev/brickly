"""read_obra(code) -> dict: contrato del dashboard v2 para una obra (v8_6).

MISMO contrato JSON que el dashboard v1 (para reusar el frontend DS sin tocarlo),
pero las fuentes cambian a la estructura v8_6:
  - control_ppto : presupuestado de 1_Presupuesto (SUMPRODUCT 4 aperturas) +
                   gasto acumulado de 2_Movimientos (derivado, por Desc Cuenta).
  - cash_flow    : 2_Movimientos agregado por mes (ingresos/egresos derivados).
  - certificaciones / avance : circuito Cert_* (ver cert.py).
  - subcontratos : maestro 2_Subcontratos + pagos cruzados por ID en Observaciones.
  - jornales     : 1_Composicion (ppto) + 2_Quincenas (horas reales).
Todos los semáforos se recalculan acá.
"""
import os
from datetime import date

from . import nav
from . import cert as certmod
from .movimientos import load_movimientos, load_gastos_dirind, cac_ratio_map
from .workbook import load_values_wb, get_parsed

# --- umbrales de semáforo (única fuente de los criterios de alerta) ---
DESVIO_ROJO = 0.10
SUBC_AMARILLO = 0.80
TODAY = date(2026, 6, 18)


def _semaforo_desvio(desvio, presup):
    if desvio is None or desvio <= 0:
        return "verde"
    pct = desvio / presup if presup else 1.0
    return "rojo" if pct > DESVIO_ROJO else "amarillo"


def _to_iso(v):
    return v.date().isoformat() if hasattr(v, "date") else (v if v is None else str(v))


# ---------------------------------------------------------------- CONFIG
def _read_config(wb):
    ws = wb["0_CONFIG"]
    cfg = nav.config_dict(ws)
    inicio = nav.cfg_get(cfg, ["fecha", "inicio"], ["inicio"])
    return {
        "nombre_interno": nav.cfg_get(cfg, ["nombre", "obra"], ["obra"]),
        "estado": nav.cfg_get(cfg, ["estado"]),
        "fecha_inicio": _to_iso(inicio),
        "_fecha_inicio_raw": inicio,
        "duracion_meses": nav.num(nav.cfg_get(cfg, ["duracion"]), None),
        "k": nav.num(nav.cfg_get(cfg, ["k ("]), None),
        "cac_mes_base": _to_iso(nav.cfg_get(cfg, ["mes", "base"])),
        "cac_valor_base": nav.num(nav.cfg_get(cfg, ["valor", "base"]), None),
        "apertura_fiscal_cfg": nav.cfg_get(cfg, ["apertura", "fiscal"]),
        "ppto_costo_cfg": nav.num(nav.cfg_get(cfg, ["costo", "controlable"]), None),
        "ppto_venta_cfg": nav.num(nav.cfg_get(cfg, ["precio", "venta"]), None),
    }


# ----------------------------------------------- 1_Presupuesto (ppto por rubro)
def _presupuesto(wb):
    """Presupuestado por rubro (4 aperturas: A×K, B×K, C×L, D×M, todo ×Cant J) +
    avance certif por rubro MT (ΣAG ÷ ΣX). Devuelve (ppto_por_rubro, avance_rubro).
    ppto_por_rubro[rubro_norm] = {'rubro':display, 'tipo':MT/MO, 'presup':$}."""
    ws = wb["1_Presupuesto"]
    hr = nav.find_row_scan(ws, "rubro", "mt")
    col = nav.map_columns(ws, hr, {
        "a":   {"all": ["rubro", "mt"], "not": ["prov", "otr", "alb"]},
        "b":   {"all": ["rubro", "prov"]},
        "c":   {"all": ["rubro", "otr"]},
        "d":   {"all": ["rubro", "alb"]},
        "cant": {"all": ["cant"]},
        "mt":  {"all": ["mt"], "not": ["rubro", "mo", "prov", "acum", "vta", "tot", "pv"]},
        "otr": {"all": ["otr"], "not": ["rubro", "acum", "vta"]},
        "alb": {"all": ["alb"], "not": ["rubro", "acum", "vta"]},
        "pv":  {"any": ["pv subtotal", "subtotal"], "not": ["acum"]},
        "costo_total": {"all": ["costo", "total"]},                  # 'Costo total' (= Costo Unit × Cant)
        "avance_t": {"all": ["acum", "tot"], "not": ["$", "ant"]},   # '% Acum Tot' (fracción por tarea)
        "cod": {"any": ["cod"]},                                     # 'Cod. Ítem' (identifica una tarea real)
    })
    ppto = {}      # rubro_norm -> {rubro, tipo, presup}
    avance = {}    # rubro_norm(MT) -> {pv, cert, costo}  (PV y costo TOTAL de la tarea, por rubro MT)
    orden = {}     # rubro_norm -> primera fila (orden de etapa del presupuesto)
    tareas_total = 0   # tareas reales (con código) de todos los presupuestos
    tareas_100 = 0     # tareas completadas al 100% (% Acum Tot ≥ 0,999)

    def add(rubro_val, monto, r):
        rn = nav.norm(rubro_val)
        if not rn or rn in ("-", "total") or rn.startswith("total"):
            return
        d = ppto.setdefault(rn, {"rubro": str(rubro_val).strip(), "tipo": _tipo(rubro_val), "presup": 0.0})
        d["presup"] += monto
        if rn not in orden:
            orden[rn] = r

    for r in range(hr + 1, ws.max_row + 1):
        J = nav.num(ws.cell(row=r, column=col["cant"]).value) if "cant" in col else 0.0
        K = nav.num(ws.cell(row=r, column=col["mt"]).value) if "mt" in col else 0.0
        L = nav.num(ws.cell(row=r, column=col["otr"]).value) if "otr" in col else 0.0
        M = nav.num(ws.cell(row=r, column=col["alb"]).value) if "alb" in col else 0.0
        va = ws.cell(row=r, column=col["a"]).value if "a" in col else None
        vb = ws.cell(row=r, column=col["b"]).value if "b" in col else None
        vc = ws.cell(row=r, column=col["c"]).value if "c" in col else None
        vd = ws.cell(row=r, column=col["d"]).value if "d" in col else None
        av_t = nav.num(ws.cell(row=r, column=col["avance_t"]).value) if "avance_t" in col else 0.0
        # conteo de tareas (código de ítem 'N.NN' — con punto; excluye banners de etapa '1','2',…)
        codv = ws.cell(row=r, column=col["cod"]).value if "cod" in col else None
        if codv not in (None, "") and "." in str(codv):
            tareas_total += 1
            if av_t >= 0.999:
                tareas_100 += 1
        if va:
            add(va, K * J, r)
        if vb:
            add(vb, K * J, r)
        if vc:
            add(vc, L * J, r)
        if vd:
            add(vd, M * J, r)
        # avance certif por rubro MT (col A)
        rn = nav.norm(va)
        if rn and rn not in ("-", "total") and not rn.startswith("total"):
            pv = nav.num(ws.cell(row=r, column=col["pv"]).value) if "pv" in col else 0.0
            # cert$ por tarea = % Acum Tot × PV subtotal (la col $ certificado ya no vive en
            # 1_Presupuesto; el avance se recalcula desde Cert_App_Output vía '% Acum Tot').
            cert = av_t * pv
            costo = nav.num(ws.cell(row=r, column=col["costo_total"]).value) if "costo_total" in col else 0.0
            ag = avance.setdefault(rn, {"pv": 0.0, "cert": 0.0, "costo": 0.0})
            ag["pv"] += pv
            ag["cert"] += cert
            ag["costo"] += costo
    avance_pct = {k: (v["cert"] / v["pv"] if v["pv"] else None) for k, v in avance.items()}
    # margen presupuestado por rubro MT (col A) = Σ PV ÷ Σ Costo total de sus tareas
    margen_rubro = {k: (v["pv"] / v["costo"] if v["costo"] else None) for k, v in avance.items()}
    tot_pv = sum(v["pv"] for v in avance.values())
    tot_costo = sum(v["costo"] for v in avance.values())
    margen_obra = (tot_pv / tot_costo) if tot_costo else None
    tareas = {"completas": tareas_100, "total": tareas_total}
    return ppto, avance_pct, orden, margen_rubro, margen_obra, tareas


def _tipo(rubro_val):
    n = nav.norm(rubro_val)
    if n.endswith(" mt"):
        return "MT"
    if n.endswith(" mo"):
        return "MO"
    return "—"


# ----------------------------------------------- Control Presupuestario
def materialidad(ppto_costo):
    return max(0.005 * (ppto_costo or 0), 3_000_000.0)


# --- bloques del Control Presupuesto ---
# 1) Costo de Obra: rubros rama 53 (+ Mov. Variables), ordenados por etapa (orden del presupuesto).
# 2-4) Secciones de 1_GGBB (Gastos Generales / Directos / Indirectos), presupuestadas 'por fuera de
#      obra' (columna G; los ítems con valor en J/K ya están en el ppto de obra y NO entran).
# El gasto de cuentas indirectas (rama 51/52) se asigna a su sección. Ingresos (4x) quedan fuera.


def _es_obra(display, rama, presup):
    n = nav.norm(display)
    if "mov" in n and "variable" in n:        # Mov. Variables -> Obra (tiene ppto)
        return True
    return presup > 0 or rama in ("53", "")    # con ppto / rama obra / sin código (MO de obra)


def _seccion_de_cuenta(rn):
    """Cuenta de gasto indirecto (Desc Cuenta normalizada) -> sección GGBB. Best-effort por
    keyword; refinable (ver pendientes.md)."""
    if "agua" in rn or "oficina" in rn or "seguridad" in rn or "higiene" in rn:
        return "generales"
    if "personal" in rn:
        return "directos"
    return "indirectos"   # gestoría / honorarios / impuestos / otros


def _ggbb_secciones(wb):
    """Secciones de 1_GGBB (Gastos Generales / Directos / Indirectos) con sus líneas
    presupuestadas 'por fuera de obra' (columna Subtotal = Cant×Precio×Meses). Los ítems con valor
    sólo en J/K (USD/embebidos en el ppto de obra) NO entran. Devuelve
    [{key, nombre, lineas:[{label, presup, norm}], presup}]."""
    secs = [
        {"key": "generales", "nombre": "Gastos Generales", "lineas": [], "presup": 0.0},
        {"key": "directos", "nombre": "Gastos Directos", "lineas": [], "presup": 0.0},
        {"key": "indirectos", "nombre": "Gastos Indirectos", "lineas": [], "presup": 0.0},
    ]
    try:
        ws = wb["1_GGBB"]
    except KeyError:
        return secs
    hr = nav.find_row_scan(ws, "precio", "unit") or 6
    gcol = nav.map_columns(ws, hr, {"g": {"any": ["subtotal"]}}).get("g")
    if not gcol:
        return secs

    def frow(*kw, start=1):
        for r in range(start, ws.max_row + 1):
            t = nav.norm(ws.cell(row=r, column=2).value)
            if t and all(k in t for k in kw):
                return r
        return None
    gd = frow("gastos", "directos")
    gi = frow("gastos", "indirectos")
    eq = frow("equipos", start=(gd or hr) + 1)
    tot = frow("total", "gastos", "generales") or (ws.max_row + 1)
    rangos = {
        "generales": (hr + 1, gd or tot),
        "directos": ((gd or tot) + 1, eq or gi or tot),
        "indirectos": ((gi or tot) + 1, tot),
    }
    by = {s["key"]: s for s in secs}
    for key, (a, b) in rangos.items():
        for r in range(a, b):
            g = nav.num(ws.cell(row=r, column=gcol).value)
            lbl = ws.cell(row=r, column=2).value
            n = nav.norm(lbl)
            if g <= 0 or not n or "total" in n or n.startswith("gastos "):
                continue
            by[key]["lineas"].append({"label": str(lbl).strip(), "presup": g, "norm": n})
            by[key]["presup"] += g
    return secs


# Mapeo explícito concepto de gasto (2_Gastos_DirInd / cuentas indirectas Tezamat) -> línea de
# presupuesto en 1_GGBB (claves y valores normalizados con nav.norm). Confirmado con Pedro
# (2026-06-24). Donde el gasto "se llama igual" que la línea, el match es directo por nombre
# normalizado y NO necesita entrada acá; sólo se listan los renombres conscientes.
GASTO_A_LINEA = {
    "payroll - administracion": "admin (50%compras - 50%rrhh)",
    # "payroll - socios": sin línea de presupuesto -> queda 'sin ppto' (pendiente: definir con
    #   Arquinering contra qué línea impacta).
}


def _ggbb_rubro(display, key, presup, desc, real, sin_ppto, gastos=None):
    """Fila de un bloque GGBB con la MISMA forma que un rubro de obra (sin avance s/cert).
    `gastos` = cuentas Tezamat / conceptos que componen el gastado de esta línea (para el drill)."""
    desvio = max(desc - presup, 0.0)
    return {
        "rubro": display, "tipo": "", "bloque": key,
        "presupuestado": presup, "acum_descontado": desc, "acum_real": real,
        "saldo": max(presup - desc, 0.0),
        "desvio": desvio,
        "desvio_pct": None if sin_ppto else ((desvio / presup) if presup else 0.0),
        "sin_ppto": sin_ppto,
        "semaforo": _semaforo_desvio(desvio, presup),
        "avance_cert_pct": None,
        "gastos": sorted((gastos or {}).values(), key=lambda c: -c["descontado"]),
    }


def _orden_obra(orden):
    """Clave de orden para los rubros de obra: por etapa (fila del presupuesto), agrupando
    MT/MO del mismo rubro y poniendo MO antes que MT.
    Devuelve (base_min, ordenador) donde ordenador(rubro_display, tipo) -> tupla de orden."""
    def base(rn):
        return rn[:-3] if (rn.endswith(" mt") or rn.endswith(" mo")) else rn
    base_min = {}
    for rn, row in orden.items():
        b = base(rn)
        base_min[b] = min(base_min.get(b, row), row)
    rank = {"MO": 0, "MT": 1}

    def key(rubro_display, tipo):
        b = base(nav.norm(rubro_display))
        return (base_min.get(b, 99999), b, rank.get(tipo, 2))
    return key


def _control_ppto(ppto, avance_rubro, orden, movs, ggbb_sec, gdi, margen_rubro=None, margen_obra=None):
    """4 bloques: Costo de Obra (rubros rama 53, control contra 1_Presupuesto) + Gastos
    Generales / Directos / Indirectos (presupuesto de 1_GGBB por sección, gasto desde
    2_Gastos_DirInd + cuentas indirectas de Tezamat, mapeado a su línea de presupuesto)."""
    margen_rubro = margen_rubro or {}
    gasto = {}  # rubro_norm -> {real, descontado, display, rama}
    for m in movs:
        if m["tipo_mov"] != "EGRESO" or not m["rubro"]:
            continue
        rn = nav.norm(m["rubro"])
        g = gasto.setdefault(rn, {"real": 0.0, "descontado": 0.0, "display": m["rubro"], "rama": ""})
        g["real"] += m["real"]
        g["descontado"] += m["descontado"]
        if not g["rama"] and m.get("cuenta"):
            g["rama"] = str(m["cuenta"]).strip()[:2]

    # índice de líneas de presupuesto GGBB: norm(línea) -> {sec, presup, label}
    linea_idx = {}
    for s in ggbb_sec:
        for ln in s["lineas"]:
            linea_idx.setdefault(ln["norm"], {"sec": s["key"], "presup": ln["presup"], "label": ln["label"]})

    # acumuladores de gasto por sección: 'lineas'[linea_norm]={desc,real} (matchea ppto) y
    # 'sin'[concepto_norm]={desc,real,display} (gasto sin línea de presupuesto)
    gg = {s["key"]: {"lineas": {}, "sin": {}} for s in ggbb_sec}

    def add_ggbb_gasto(concepto, desc, real, fallback_sec):
        cn = nav.norm(concepto)
        target = GASTO_A_LINEA.get(cn, cn)
        if target in linea_idx:
            sec = linea_idx[target]["sec"]
            d = gg[sec]["lineas"].setdefault(target, {"desc": 0.0, "real": 0.0, "conceptos": {}})
        else:
            sec = fallback_sec if fallback_sec in gg else "indirectos"
            d = gg[sec]["sin"].setdefault(cn, {"desc": 0.0, "real": 0.0, "display": str(concepto).strip(), "conceptos": {}})
        d["desc"] += desc
        d["real"] += real
        # cuenta/concepto Tezamat que compone el gastado de esta línea (para el drill GGBB)
        c = d["conceptos"].setdefault(cn, {"cuenta": str(concepto).strip(), "descontado": 0.0, "real": 0.0})
        c["descontado"] += desc
        c["real"] += real

    obra_rubros = []
    for rn in set(ppto) | set(gasto):
        p = ppto.get(rn)
        g = gasto.get(rn)
        display = (p["rubro"] if p else g["display"])
        presup = p["presup"] if p else 0.0
        real = g["real"] if g else 0.0
        desc = g["descontado"] if g else 0.0
        rama = g["rama"] if g else "53"
        if _es_obra(display, rama, presup):
            desvio = max(desc - presup, 0.0)
            sin_ppto = presup == 0 and desc > 0
            obra_rubros.append({
                "rubro": display,
                "tipo": (p["tipo"] if p else _tipo(display)),
                "bloque": "obra",
                "presupuestado": presup,
                "acum_descontado": desc,
                "acum_real": real,
                "saldo": max(presup - desc, 0.0),
                "desvio": desvio,
                "desvio_pct": None if sin_ppto else ((desvio / presup) if presup else 0.0),
                "sin_ppto": sin_ppto,
                "semaforo": _semaforo_desvio(desvio, presup),
                "avance_cert_pct": avance_rubro.get(nav.norm(display)),
                "margen_pct": margen_rubro.get(nav.norm(display)),   # margen ppto = PV÷Costo (rubro MT)
            })
        else:  # gasto indirecto de Tezamat -> bloque GGBB (a su línea si matchea, si no 'sin ppto')
            add_ggbb_gasto(display, desc, real, _seccion_de_cuenta(rn))

    # gasto de 2_Gastos_DirInd (cargado 'por fuera de Tezamat') -> bloques GGBB
    for x in gdi:
        fb = "indirectos" if x["tipo"] == "Indirecto" else "directos"
        add_ggbb_gasto(x["concepto"], x["descontado"], x["real"], fb)

    # orden de obra: por etapa, agrupando MT/MO del mismo rubro (MO antes que MT)
    okey = _orden_obra(orden)
    obra_rubros.sort(key=lambda r: okey(r["rubro"], r["tipo"]))

    def sub(presup, desc, real):
        desvio = max(desc - presup, 0.0)
        return {"presupuestado": presup, "acum_descontado": desc, "acum_real": real,
                "saldo": max(presup - desc, 0.0),
                "consumido_pct": (desc / presup) if presup else None,
                "desvio": desvio, "semaforo": _semaforo_desvio(desvio, presup)}

    o_presup = sum(r["presupuestado"] for r in obra_rubros)
    o_desc = sum(r["acum_descontado"] for r in obra_rubros)
    o_real = sum(r["acum_real"] for r in obra_rubros)
    bloques = [{"key": "obra", "nombre": "Costo de Obra", "tipo": "obra", "controlable": True,
                "rubros": obra_rubros, "subtotal": sub(o_presup, o_desc, o_real)}]
    for s in ggbb_sec:
        acc = gg[s["key"]]
        rubros = []
        # líneas presupuestadas de 1_GGBB (en orden de la hoja); gasto adjunto si lo hay
        for ln in s["lineas"]:
            d = acc["lineas"].get(ln["norm"], {"desc": 0.0, "real": 0.0, "conceptos": {}})
            rubros.append(_ggbb_rubro(ln["label"], s["key"], ln["presup"], d["desc"], d["real"], False, d.get("conceptos")))
        # gasto sin línea de presupuesto (ej. Payroll Socios, cuentas indirectas no mapeadas)
        for cn, d in sorted(acc["sin"].items(), key=lambda kv: -kv[1]["desc"]):
            rubros.append(_ggbb_rubro(d["display"], s["key"], 0.0, d["desc"], d["real"], True, d.get("conceptos")))
        b_presup = sum(r["presupuestado"] for r in rubros)
        b_desc = sum(r["acum_descontado"] for r in rubros)
        b_real = sum(r["acum_real"] for r in rubros)
        bloques.append({
            "key": s["key"], "nombre": s["nombre"], "tipo": "ggbb", "controlable": False,
            "rubros": rubros, "subtotal": sub(b_presup, b_desc, b_real),
        })

    total = dict(bloques[0]["subtotal"])   # TOTAL CONTROLABLE = bloque Obra
    mat = materialidad(o_presup)
    floor = max(0.001 * o_presup, 300_000.0)
    top_desvios = [dict(x, material=(x["desvio"] > mat))
                   for x in sorted((r for r in obra_rubros if r["desvio"] > floor),
                                   key=lambda r: r["desvio"], reverse=True)[:5]]
    return {"rubros": obra_rubros, "bloques": bloques, "total": total, "top_desvios": top_desvios,
            "margen_obra": margen_obra}


# ----------------------------------------------- Cash Flow (por mes)
def _cash_flow(movs, gdi):
    meses_set = sorted({m["mes"] for m in movs if m["mes"]} | {x["mes"] for x in gdi if x["mes"]})
    if not meses_set:
        return {"meses": [], "series": {}}
    meses = _rango_meses(meses_set[0], meses_set[-1])
    idx = {m: i for i, m in enumerate(meses)}
    n = len(meses)
    ingresos = [0.0] * n
    egresos = [0.0] * n
    for m in movs:
        if not m["mes"] or m["mes"] not in idx:
            continue
        i = idx[m["mes"]]
        if m["tipo_mov"] == "INGRESO":
            ingresos[i] += -m["real"]   # cobros con signo positivo
        else:
            egresos[i] += m["real"]
    # gastos directos/indirectos (2_Gastos_DirInd, por fuera de Tezamat), nominales
    gd = [0.0] * n
    gi = [0.0] * n
    for x in gdi:
        if not x["mes"] or x["mes"] not in idx:
            continue
        i = idx[x["mes"]]
        if x["tipo"] == "Indirecto":
            gi[i] += x["real"]
        else:
            gd[i] += x["real"]
    total_egresos = [egresos[i] + gd[i] + gi[i] for i in range(n)]
    resultado_mes = [ingresos[i] - total_egresos[i] for i in range(n)]
    acum, run = [], 0.0
    for v in resultado_mes:
        run += v
        acum.append(run)
    return {
        "meses": meses,
        "series": {
            "ingresos": ingresos,
            "ingresos_cac": [0.0] * n,          # placeholder (circuito de ingresos)
            "egresos": egresos,                 # 2_Movimientos EGRESO
            "gastos_directos": gd,              # 2_Gastos_DirInd (Directo)
            "gastos_indirectos": gi,            # 2_Gastos_DirInd (Indirecto)
            "total_egresos": total_egresos,     # egresos + directos + indirectos
            "resultado_mes": resultado_mes,
            "resultado_acumulado": acum,
        },
    }


def _rango_meses(m0, m1):
    """Lista continua de 'YYYY-MM-01' entre m0 y m1 inclusive."""
    y0, mo0 = int(m0[:4]), int(m0[5:7])
    y1, mo1 = int(m1[:4]), int(m1[5:7])
    out = []
    y, mo = y0, mo0
    while (y, mo) <= (y1, mo1):
        out.append(f"{y:04d}-{mo:02d}-01")
        mo += 1
        if mo > 12:
            mo = 1
            y += 1
    return out


# ----------------------------------------------- Subcontratos
def _subcontratos(wb, movs):
    ws = wb["2_Subcontratos"]
    hr = nav.find_row_scan(ws, "proveedor")
    col = nav.map_columns(ws, hr, {
        "contrato": {"any": ["contrato"]},
        "proveedor": {"any": ["proveedor"]},
        "rubro": {"any": ["rubro"]},
        "presup": {"any": ["presup"]},
        "anticipo_pct": {"all": ["anticipo"], "not": ["monto"]},
    })
    # pagos por SC desde movimientos. Regla de oro (SPEC_Conciliacion §4):
    # BASE+ANT descuentan saldo; CAC y CS (cargas sociales) NO descuentan.
    pag = {}  # sc_id -> {sin_cac, cac, cargas, total}
    for m in movs:
        if not m["sc_id"]:
            continue
        p = pag.setdefault(m["sc_id"], {"sin_cac": 0.0, "cac": 0.0, "cargas": 0.0})
        t = (m["sc_tipo"] or "").upper()
        if t == "CAC":
            p["cac"] += m["real"]
        elif t in ("CS", "CARGAS SOCIALES", "CARGAS"):
            p["cargas"] += m["real"]
        else:  # BASE, ANT (y legacy AVANCE/QUINCENA, o sin tipo) -> descuenta saldo
            p["sin_cac"] += m["real"]

    items = []
    for r in range(hr + 1, ws.max_row + 1):
        c = ws.cell(row=r, column=col["contrato"]).value if "contrato" in col else None
        cn = nav.norm(c)
        if cn.startswith("total"):
            break
        if c is None or cn == "" or cn.startswith("instruc") or cn.startswith("►") or cn.startswith("▌"):
            continue
        presup = nav.num(ws.cell(row=r, column=col["presup"]).value) if "presup" in col else 0.0
        p = pag.get(str(c).strip().upper(), {"sin_cac": 0.0, "cac": 0.0, "cargas": 0.0})
        pagado_sin_cac = p["sin_cac"]
        total_pagado = p["sin_cac"] + p["cac"] + p["cargas"]
        saldo = presup - pagado_sin_cac
        consumo = (pagado_sin_cac / presup) if presup else (1.0 if pagado_sin_cac else 0.0)
        if pagado_sin_cac == 0 and presup > 0:
            riesgo = "sin_datos"   # nada pagado/tagueado: no es "en control", es sin dato (T4-2)
        elif saldo < 0:
            riesgo = "rojo"
        elif consumo > SUBC_AMARILLO:
            riesgo = "amarillo"
        else:
            riesgo = "verde"
        items.append({
            "contrato": str(c).strip(),
            "proveedor": (str(ws.cell(row=r, column=col["proveedor"]).value).strip()
                          if "proveedor" in col and ws.cell(row=r, column=col["proveedor"]).value else ""),
            "rubro": (str(ws.cell(row=r, column=col["rubro"]).value).strip()
                      if "rubro" in col and ws.cell(row=r, column=col["rubro"]).value else ""),
            "presupuesto": presup,
            "pagado": total_pagado,
            "pagado_sin_cac": pagado_sin_cac,
            "cac_pagado": p["cac"],
            "saldo": saldo,
            "consumo_pct": consumo,
            "riesgo": riesgo,
        })
    en_riesgo = sum(1 for x in items if x["riesgo"] in ("rojo", "amarillo"))
    return {
        "items": items,
        "comprometido": sum(x["presupuesto"] for x in items),
        "pagado": sum(x["pagado"] for x in items),
        "saldo": sum(x["saldo"] for x in items),
        "en_riesgo": en_riesgo,
    }


# ----------------------------------------------- Jornales (UOCRA)
# Categorías UOCRA válidas (igual que el SUMIFS del control viejo): sólo estas
# cuentan como jornal. La col Descripción de 1_Composicion a veces trae texto
# libre (p.ej. "MO Albañilería complementaria…") que NO es una categoría.
VALID_CATS = {"capataz", "especializado", "oficial", "medio oficial",
              "ayudante", "jefe de obra"}


def _jornales(wb):
    # ppto: SUMIFS 1_Composicion.Q por (Rubro S, Categoría=Descripción E)
    ppto = {}  # (rubro_norm, cat_norm) -> jornales
    rubro_display = {}
    try:
        wc = wb["1_Composicion"]
        col = nav.map_columns(wc, 1, {
            "tipo": {"all": ["tipo"]},
            "desc": {"all": ["descripcion"]},
            "q": {"all": ["cant", "alb", "total"]},
            "rubro": {"all": ["rubro"]},
        })
        for r in range(2, wc.max_row + 1):
            tp = str(wc.cell(row=r, column=col["tipo"]).value or "").strip().upper() if "tipo" in col else ""
            if tp != "MO":
                continue
            rub_v = wc.cell(row=r, column=col["rubro"]).value if "rubro" in col else None
            rub = nav.norm(rub_v)
            cat = nav.norm(wc.cell(row=r, column=col["desc"]).value) if "desc" in col else ""
            q = nav.num(wc.cell(row=r, column=col["q"]).value) if "q" in col else 0.0
            # rubro inválido (0/-/vacío) o categoría no-UOCRA -> no es jornal
            if not rub or rub in ("0", "-") or cat not in VALID_CATS or q == 0:
                continue
            ppto[(rub, cat)] = ppto.get((rub, cat), 0.0) + q
            rubro_display.setdefault(rub, str(rub_v).strip() if rub_v else rub)
    except KeyError:
        pass

    # horas reales: 2_Quincenas G + H*1.5 + I*2 por (Rubro, Categoría)
    horas = {}  # (rubro_norm, cat_norm) -> horas
    cat_display = {}
    try:
        wq = wb["2_Quincenas"]
        hr = nav.find_row_scan(wq, "rubro")
        col = nav.map_columns(wq, hr, {
            "categoria": {"any": ["categoria"]},
            "rubro": {"all": ["rubro"]},
            "h_norm": {"all": ["horas", "normales"]},
            "h50": {"all": ["horas", "extra", "50"]},
            "h100": {"all": ["horas", "extra", "100"]},
        })
        for r in range(hr + 1, wq.max_row + 1):
            rub_v = wq.cell(row=r, column=col["rubro"]).value if "rubro" in col else None
            cat_v = wq.cell(row=r, column=col["categoria"]).value if "categoria" in col else None
            rn, cn = nav.norm(rub_v), nav.norm(cat_v)
            if not rn:
                continue
            g = nav.num(wq.cell(row=r, column=col["h_norm"]).value) if "h_norm" in col else 0.0
            h50 = nav.num(wq.cell(row=r, column=col["h50"]).value) if "h50" in col else 0.0
            h100 = nav.num(wq.cell(row=r, column=col["h100"]).value) if "h100" in col else 0.0
            horas[(rn, cn)] = horas.get((rn, cn), 0.0) + g + h50 * 1.5 + h100 * 2
            rubro_display.setdefault(rn, str(rub_v).strip() if rub_v else rn)
            cat_display.setdefault(cn, str(cat_v).strip() if cat_v else cn)
    except KeyError:
        pass

    # ensamble por rubro -> categorías
    for (rn, cn) in ppto:
        rubro_display.setdefault(rn, rn)
        cat_display.setdefault(cn, cn)
    rubros = {}
    keys = set(ppto) | set(horas)
    for (rn, cn) in keys:
        rb = rubros.setdefault(rn, {"rubro": rubro_display.get(rn, rn),
                                    "horas_ppto": 0.0, "horas_acum": 0.0, "categorias": []})
        jorn = ppto.get((rn, cn), 0.0)
        hp = jorn * 8
        ha = horas.get((rn, cn), 0.0)
        rb["horas_ppto"] += hp
        rb["horas_acum"] += ha
        rb["categorias"].append({
            "categoria": cat_display.get(cn, cn),
            "jornales": jorn, "horas_ppto": hp, "horas_acum": ha,
        })
    lst = sorted(rubros.values(), key=lambda x: x["horas_ppto"], reverse=True)
    for rb in lst:
        rb["categorias"].sort(key=lambda c: c["horas_ppto"], reverse=True)
    return {
        "rubros": lst,
        "horas_ppto": sum(x["horas_ppto"] for x in lst),
        "horas_acum": sum(x["horas_acum"] for x in lst),
    }


# ----------------------------------------------- ENSAMBLE
def _parse(path):
    wb = load_values_wb(path)
    try:
        cfg = _read_config(wb)
        movs = load_movimientos(wb)
        cac_ratio = cac_ratio_map(wb)   # para detectar meses sin índice (data_gaps)
        ppto, avance_rubro, orden, margen_rubro, margen_obra, tareas = _presupuesto(wb)
        ggbb_sec = _ggbb_secciones(wb)
        gdi = load_gastos_dirind(wb)
        control = _control_ppto(ppto, avance_rubro, orden, movs, ggbb_sec, gdi, margen_rubro, margen_obra)
        cash = _cash_flow(movs, gdi)
        subc = _subcontratos(wb, movs)
        jorn = _jornales(wb)
        cblock = certmod.read_cert(wb)
    finally:
        wb.close()

    cert = cblock["certificaciones"]
    avance_etapa = cblock["avance_etapa"]
    avance_fisico = cblock["avance_fisico_pct"]

    ppto_costo = control["total"]["presupuestado"] or cfg.get("ppto_costo_cfg") or 0.0
    ppto_venta = cfg.get("ppto_venta_cfg") or avance_etapa["total"].get("ppto_venta", 0.0)
    gasto_real = control["total"]["acum_real"]
    gasto_defl = control["total"]["acum_descontado"]

    # tiempo transcurrido
    tiempo_pct = None
    ini = cfg.get("_fecha_inicio_raw")
    dur = cfg.get("duracion_meses")
    if ini is not None and dur:
        ini_d = ini.date() if hasattr(ini, "date") else ini
        meses_trans = (TODAY.year - ini_d.year) * 12 + (TODAY.month - ini_d.month)
        tiempo_pct = max(0.0, min(meses_trans / dur, 1.5))

    S = cash["series"]
    res_acum = S.get("resultado_acumulado", [])
    meses_cf = cash.get("meses", [])
    resultado_acum = next((v for v in reversed(res_acum) if v != 0), 0.0) if res_acum else 0.0
    caja_valle = min(res_acum) if res_acum else 0.0
    caja_valle_mes = meses_cf[res_acum.index(caja_valle)] if res_acum and meses_cf else None
    meses_negativos = sum(1 for v in res_acum if v < 0)
    hoy_ym = TODAY.isoformat()[:7]
    meses_neg_futuros = sum(1 for m, v in zip(meses_cf, res_acum) if v < 0 and (m or "")[:7] >= hoy_ym)

    # COBRADO — fuente única: tesorería (ingresos reales de 2_Movimientos, def. congelada
    # CLAUDE.md ppio 4). El cobrado del circuito Cert_* se expone como conciliación, no como
    # número suelto que se contradice con el cash flow (hallazgo T0-4).
    cobrado_tesoreria = sum(S.get("ingresos", []))
    cobrado_conciliado = cert["cobrado"]
    apertura = cfg.get("apertura_fiscal_cfg") or " / ".join(f["tipo"] for f in cert["apertura_fiscal"])

    # avance FINANCIERO (certificado de avance ÷ ppto venta) vs avance FÍSICO (col E). Se
    # exponen los dos para que no se confundan (hallazgo T0-5).
    cert_avance = cert.get("certificado_avance", 0.0)
    avance_financiero = (cert_avance / ppto_venta) if ppto_venta else 0.0

    # --- data_gaps: huecos de datos que deben VERSE (no rellenar en silencio) (T0-2) ---
    data_gaps = []
    meses_mov = sorted({m["mes"][:7] for m in movs if m["mes"]})
    sin_cac = [mm for mm in meses_mov if mm not in cac_ratio]
    if sin_cac:
        data_gaps.append({"tipo": "cac", "sev": "critico",
                          "detalle": f"Sin índice CAC para {len(sin_cac)} mes(es) ({sin_cac[0]}…{sin_cac[-1]}): "
                                     f"el gasto de esos meses no se pudo deflactar (se tomó nominal)."})
    if subc["items"] and subc["pagado"] == 0 and any(x["presupuesto"] > 0 for x in subc["items"]) \
            and not any(m["sc_id"] for m in movs):
        data_gaps.append({"tipo": "subcontratos", "sev": "atencion",
                          "detalle": f"{len(subc['items'])} subcontrato(s) en el maestro sin pagos "
                                     f"tagueados en Tezamat: tracking de pagos en $0."})
    if cobrado_tesoreria - cobrado_conciliado > max(0.005 * cobrado_tesoreria, 1_000_000):
        data_gaps.append({"tipo": "cobros", "sev": "atencion",
                          "detalle": f"Cobros en Tezamat ({_fmtM(cobrado_tesoreria)}) sin conciliar "
                                     f"a una certificación ({_fmtM(cobrado_conciliado)})."})
    if cert["total_certificado"] > 0 and cert.get("facturado", 0.0) == 0:
        data_gaps.append({"tipo": "facturacion", "sev": "atencion",
                          "detalle": f"Certificado {_fmtM(cert['total_certificado'])} sin facturación ni cobro "
                                     f"cargados en el circuito Cert_*: el lado ingresos (factura→cobro) está inerte."})
    if jorn["horas_acum"] > 0 and jorn["horas_ppto"] == 0:
        data_gaps.append({"tipo": "jornales", "sev": "atencion",
                          "detalle": "Mano de obra con horas reales pero sin presupuesto de horas "
                                     "(1_Composicion sin rubros MO): no se puede medir el consumo de jornales."})

    resumen = {
        "ppto_costo": ppto_costo,
        "ppto_venta": ppto_venta,
        "margen": ppto_venta - ppto_costo,
        "margen_pct": (ppto_venta - ppto_costo) / ppto_venta if ppto_venta else 0.0,
        "gasto_real": gasto_real,
        "gasto_deflactado": gasto_defl,
        "consumido_pct": (gasto_defl / ppto_costo) if ppto_costo else 0.0,
        "saldo_presupuestario": ppto_costo - gasto_defl,
        "avance_fisico_pct": avance_fisico,              # FÍSICO (Cert_Control_OC col E)
        "avance_financiero_pct": avance_financiero,      # FINANCIERO (cert avance ÷ ppto venta)
        "tareas_completas": tareas["completas"],   # tareas al 100% (% Acum Tot ≥ 0,999)
        "tareas_total": tareas["total"],           # tareas reales (con código) de todos los ppto
        "tiempo_transcurrido_pct": tiempo_pct,
        "certificado_total": cert["total_certificado"],       # incl. anticipo (reconciliación)
        "certificado_avance": cert.get("certificado_avance", cert["total_certificado"]),
        "anticipo": cert.get("anticipo", 0.0),
        "certificado_pendiente": cert["certificado_pendiente"],
        "facturado_pendiente": cert["facturado_pendiente"],
        "cobrado": cobrado_tesoreria,              # headline = tesorería (cobros reales Tezamat)
        "cobrado_conciliado": cobrado_conciliado,  # de los cuales conciliados a certificación
        "saldo_cobrar": ppto_venta - cobrado_tesoreria,
        "resultado_acumulado": resultado_acum,
        "caja_valle": caja_valle,
        "caja_valle_mes": caja_valle_mes,
        "meses_negativos": meses_negativos,
        "meses_neg_futuros": meses_neg_futuros,
    }

    return {
        "meta": {
            "nombre_interno": cfg.get("nombre_interno"),
            "estado": cfg.get("estado"),
            "fecha_inicio": cfg.get("fecha_inicio"),
            "duracion_meses": dur,
            "k": cfg.get("k"),
            "cac_mes_base": cfg.get("cac_mes_base"),
            "cac_valor_base": cfg.get("cac_valor_base"),
            "apertura_fiscal": apertura,
        },
        "resumen": resumen,
        "data_gaps": data_gaps,
        "control_ppto": control,
        "avance_etapa": avance_etapa,
        "cash_flow": cash,
        "certificaciones": cert,
        "subcontratos": subc,
        "jornales": jorn,
    }


# ------------------------------------------------------- helpers de salida
def _fmtM(x):
    return f"${x/1e6:,.1f}M".replace(",", ".")


def semaforo_global(d):
    r = d["resumen"]
    sub = d["subcontratos"]
    desv = d["control_ppto"]["top_desvios"]
    mat = materialidad(r.get("ppto_costo"))
    av = r.get("avance_fisico_pct") or 0
    tt = r.get("tiempo_transcurrido_pct") or 0
    cons = r.get("consumido_pct") or 0
    ppto = r.get("ppto_costo") or 0

    razones, nivel = [], "verde"
    sev2niv = {"critico": "rojo", "atencion": "amarillo", "info": "verde"}
    order = {"verde": 0, "amarillo": 1, "rojo": 2}

    def add(txt, sev):
        nonlocal nivel
        razones.append({"txt": txt, "sev": sev})
        if order[sev2niv[sev]] > order[nivel]:
            nivel = sev2niv[sev]

    desfase = (cons - av) * ppto
    if cons - av > 0.15 and desfase > mat:
        add(f"gasto adelantado al avance en {_fmtM(desfase)}", "critico")
    if r.get("resultado_acumulado", 0) < -mat:
        add("resultado acumulado negativo", "critico")
    desvio_mat = [t for t in desv if (t.get("desvio") or 0) > mat]
    if desvio_mat:
        add(f"{len(desvio_mat)} rubro(s) con desvío material (>{_fmtM(mat)})", "critico")

    if tt - av > 0.20:
        add(f"avance ({av*100:.0f}%) detrás del cronograma ({tt*100:.0f}%)", "atencion")
    sub_rojo = sum(1 for s in sub["items"] if s["riesgo"] == "rojo")
    sub_amar = sum(1 for s in sub["items"] if s["riesgo"] == "amarillo")
    if sub_rojo:
        add(f"{sub_rojo} subcontrato(s) sobregirado(s)", "atencion")
    if sub_amar:
        add(f"{sub_amar} subcontrato(s) >80% consumido", "atencion")
    if r.get("meses_neg_futuros", 0) > 0:
        add(f"caja negativa en {r['meses_neg_futuros']} mes(es) próximo(s)", "atencion")
    jb = d.get("jornales", {})
    jp = jb.get("horas_ppto") or 0
    if jp and (jb.get("horas_acum", 0) / jp) > 1.05:
        add(f"horas-hombre al {jb['horas_acum']/jp*100:.0f}% del presupuesto", "atencion")

    desvio_menor = [t for t in desv if 0 < (t.get("desvio") or 0) <= mat]
    if desvio_menor and not desvio_mat:
        add(f"{len(desvio_menor)} rubro(s) con desvío menor", "info")

    if not razones:
        razones.append({"txt": "sin alertas", "sev": "info"})
    return {"nivel": nivel, "razones": razones}


def portfolio_card(d):
    m, r = d["meta"], d["resumen"]
    return {
        "code": m.get("code"),
        "nombre": m.get("nombre"),
        "seccion": m.get("seccion", ""),
        "estado": m.get("estado"),
        "apertura_fiscal": m.get("apertura_fiscal"),
        "ppto_costo": r["ppto_costo"],
        "ppto_venta": r["ppto_venta"],
        "avance_fisico_pct": r["avance_fisico_pct"],
        "tiempo_transcurrido_pct": r["tiempo_transcurrido_pct"],
        "consumido_pct": r["consumido_pct"],
        "cobrado": r["cobrado"],
        "saldo_cobrar": r["saldo_cobrar"],
        "resultado_acumulado": r["resultado_acumulado"],
        "margen_pct": r["margen_pct"],
        "en_riesgo": d["subcontratos"]["en_riesgo"],
        "mtime": m.get("mtime"),
        "semaforo": semaforo_global(d),
    }


def read_obra(path, code=None, nombre=None, seccion=None):
    data = get_parsed(path, _parse)
    out = dict(data)
    out["meta"] = dict(out["meta"])
    if code:
        out["meta"]["code"] = code
    if nombre:
        out["meta"]["nombre"] = nombre
    if seccion is not None:
        out["meta"]["seccion"] = seccion
    out["meta"]["archivo"] = os.path.basename(path)
    out["meta"]["mtime"] = os.path.getmtime(path)
    return out
