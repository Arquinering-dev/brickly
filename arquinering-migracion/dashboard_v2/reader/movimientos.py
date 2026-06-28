"""Capa de derivación sobre 2_Movimientos (extracto crudo de Tezamat).

En v8_6 el Excel ya NO trae columnas calculadas: 2_Movimientos es el extracto
puro (16 cols). El motor reconstruye acá las columnas que antes vivían en la hoja
(sección 0 de LOGICA_CALCULO_v8.md):

  Mes            = primer día del mes de Fecha Asiento (col C)
  Monto Real     = Debe − Haber          (col I − col J)
  Monto Descontado = Monto Real × ratio_CAC(Mes)   (ratio de 0_Indice_CAC!D)
  Tipo Mov       = INGRESO si Cuenta (col A) empieza en '4'; si no EGRESO
  Rubro (clave)  = Desc Cuenta (col B), string exacto, con sufijo ' MT'/' MO'
  ID Subcontrato = CH-SC-NNN embebido en Observaciones (col E) + tipo

Todo se lee con navegación anclada por texto (nav.py); las letras de columna del
.md describen un layout viejo y NO se toman literales.
"""
import re

from . import nav

_SC = re.compile(r"([A-Z]{2,4}-SC-\d+)", re.I)
# Convención v8_9: Observaciones = '{ID} | {TIPO} | {desc}' con TIPO ∈ {BASE,CAC,ANT,CS}.
# Fallback legacy (volcados viejos sin ' | '): keyword suelto.
_SC_TIPOS_LEGACY = ("CARGAS SOCIALES", "AVANCE", "QUINCENA", "CAC")  # 'cargas' antes que 'cac'


def _to_iso(v):
    return v.date().isoformat() if hasattr(v, "date") else (str(v) if v else None)


def _mes_iso(v):
    """Primer día del mes de una fecha -> 'YYYY-MM-01'. None si no es fecha."""
    if not (hasattr(v, "year") and hasattr(v, "month")):
        return None
    return f"{v.year:04d}-{v.month:02d}-01"


# ----------------------------------------------------- ratio CAC por mes
def cac_ratio_map(wb):
    """{'YYYY-MM': ratio_deflactacion} desde 0_Indice_CAC.

    Detecta las columnas POR CONTENIDO, no por el wording del header: el header del
    ratio difiere entre obras (CH: 'Ratio deflactación'/'Mes'; GDR/SVD:
    'Indice'/'Escala de tiempo'). Si se ancla por texto, GDR/SVD quedan sin ratio y
    la deflactación se anula en silencio (bug T0-1). Reglas:
      - columna fecha = la que más celdas-mes tiene;
      - columna ratio = columna numérica con valores en (0, 2] (los ratios rondan
        0,8–1,0; el índice INDEC son miles → se descarta), priorizando la que trae
        el 1,0 del mes base.
    El ratio viene en forma CAC_base/CAC(mes) (mes base = 1)."""
    try:
        ws = wb["0_Indice_CAC"]
    except KeyError:
        return {}
    max_r = min(ws.max_row, 80)
    max_c = min(ws.max_column, 12)
    # columna de fecha (mes)
    date_col, best = None, 0
    for c in range(1, max_c + 1):
        n = sum(1 for r in range(1, max_r + 1) if nav.is_date(ws.cell(row=r, column=c).value))
        if n > best:
            best, date_col = n, c
    if not date_col:
        return {}
    data_rows = [r for r in range(1, max_r + 1) if nav.is_date(ws.cell(row=r, column=date_col).value)]
    # columna de ratio: numérica, valores en (0,2], preferir la que tiene el 1,0 base
    ratio_col, bestscore = None, -1
    for c in range(1, max_c + 1):
        if c == date_col:
            continue
        nums = [ws.cell(row=r, column=c).value for r in data_rows]
        nums = [v for v in nums if isinstance(v, (int, float)) and not isinstance(v, bool)]
        if not nums:
            continue
        in_range = sum(1 for v in nums if 0 < v <= 2)
        if in_range == 0:
            continue
        has_one = any(abs(v - 1.0) < 1e-6 for v in nums)
        score = in_range + (10_000 if has_one else 0)
        if score > bestscore:
            bestscore, ratio_col = score, c
    if not ratio_col:
        return {}
    out = {}
    for r in data_rows:
        mk = _mes_iso(ws.cell(row=r, column=date_col).value)
        rv = ws.cell(row=r, column=ratio_col).value
        if mk and isinstance(rv, (int, float)) and not isinstance(rv, bool):
            out[mk[:7]] = rv
    return out


# ----------------------------------------------------- lectura de movimientos
def load_movimientos(wb):
    """Lista de movimientos con columnas derivadas. Cada item:
      cuenta, rubro (=Desc Cuenta), fecha (iso), mes (iso 'YYYY-MM-01'),
      obs, proveedor, debe, haber, real, descontado, tipo_mov,
      sc_id, sc_tipo (None si la obs no trae ID de subcontrato).
    """
    ws = wb["2_Movimientos"]
    hr = nav.find_row_scan(ws, "desc cuenta") or nav.find_row(ws, "cuenta", col=1) or 1
    col = nav.map_columns(ws, hr, {
        "cuenta":    {"all": ["cuenta"], "not": ["desc"]},
        "rubro":     {"all": ["desc", "cuenta"]},
        "fecha":     {"all": ["fecha", "asiento"]},
        "obs":       {"any": ["observaciones"]},          # 1er match = la col E (no la 'original')
        "proveedor": {"any": ["proveedor", "cliente"]},
        "debe":      {"all": ["debe"]},
        "haber":     {"all": ["haber"]},
    })
    ratio = cac_ratio_map(wb)
    out = []
    for r in range(hr + 1, ws.max_row + 1):
        cuenta = ws.cell(row=r, column=col["cuenta"]).value if "cuenta" in col else None
        rubro = ws.cell(row=r, column=col["rubro"]).value if "rubro" in col else None
        fecha = ws.cell(row=r, column=col["fecha"]).value if "fecha" in col else None
        debe = nav.num(ws.cell(row=r, column=col["debe"]).value) if "debe" in col else 0.0
        haber = nav.num(ws.cell(row=r, column=col["haber"]).value) if "haber" in col else 0.0
        # fila vacía: sin cuenta, sin rubro y sin importes -> saltar
        if cuenta is None and rubro is None and debe == 0 and haber == 0:
            continue
        # fila de TOTAL/subtotal (no es un movimiento): cortar (bug T0-3, SVD r320)
        if nav.norm(cuenta).startswith("total") or nav.norm(rubro).startswith("total"):
            continue
        real = debe - haber
        mes = _mes_iso(fecha)
        cs = str(cuenta).strip() if cuenta is not None else ""
        tipo_mov = "INGRESO" if cs[:1] == "4" else "EGRESO"
        desc = (ratio.get(mes[:7], 1.0) if mes else 1.0)
        obs = ws.cell(row=r, column=col["obs"]).value if "obs" in col else None
        prov = ws.cell(row=r, column=col["proveedor"]).value if "proveedor" in col else None
        sc_id, sc_tipo = _parse_sc(obs)
        out.append({
            "cuenta": cs,
            "rubro": str(rubro).strip() if rubro else "",
            "fecha": _to_iso(fecha),
            "mes": mes,
            "obs": str(obs).strip() if obs else "",
            "proveedor": str(prov).strip() if prov else "",
            "debe": debe, "haber": haber,
            "real": real,
            "descontado": real * desc,
            "tipo_mov": tipo_mov,
            "sc_id": sc_id, "sc_tipo": sc_tipo,
        })
    return out


def load_gastos_dirind(wb):
    """Tabla plana 2_Gastos_DirInd -> [{fecha, mes, tipo, concepto, real, descontado}].
    real = monto nominal; descontado = real × ratio_CAC(mes) (deflactado, como 2_Movimientos).
    Son gastos directos/indirectos 'por fuera de obra', cargados aparte de Tezamat."""
    try:
        ws = wb["2_Gastos_DirInd"]
    except KeyError:
        return []
    hr = nav.find_row(ws, "fecha", col=1) or nav.find_row_scan(ws, "concepto") or 1
    col = nav.map_columns(ws, hr, {
        "fecha":    {"all": ["fecha"]},
        "tipo":     {"all": ["tipo"]},
        "concepto": {"all": ["concepto"]},
        "monto":    {"all": ["monto"]},
    })
    if "fecha" not in col or "monto" not in col:
        return []
    ratio = cac_ratio_map(wb)
    out = []
    for r in range(hr + 1, ws.max_row + 1):
        f = ws.cell(row=r, column=col["fecha"]).value
        monto = nav.num(ws.cell(row=r, column=col["monto"]).value)
        if not (hasattr(f, "year") and hasattr(f, "month")) or monto == 0:
            continue
        mes = _mes_iso(f)
        desc = ratio.get(mes[:7], 1.0) if mes else 1.0
        tipo = str(ws.cell(row=r, column=col["tipo"]).value or "").strip() if "tipo" in col else ""
        out.append({
            "fecha": _to_iso(f), "mes": mes,
            "tipo": "Indirecto" if tipo.lower().startswith("indirect") else "Directo",
            "concepto": str(ws.cell(row=r, column=col["concepto"]).value or "").strip() if "concepto" in col else "",
            "real": monto, "descontado": monto * desc,
        })
    return out


def _parse_sc(obs):
    """(id, tipo) si la observación trae un ID de subcontrato; (None, None) si no.
    Convención v8_9: '{ID} | {TIPO} | {desc}' → tipo = token 2 (BASE/CAC/ANT/CS).
    Fallback legacy: keyword suelto (AVANCE/QUINCENA/CARGAS SOCIALES/CAC)."""
    if not obs:
        return None, None
    s = str(obs)
    m = _SC.search(s)
    if not m:
        return None, None
    tipo = None
    if " | " in s:
        parts = [p.strip().upper() for p in s.split(" | ")]
        if len(parts) >= 2:
            tipo = parts[1]
    if not tipo:
        up = s.upper()
        tipo = next((t for t in _SC_TIPOS_LEGACY if t in up), None)
    return m.group(1).upper(), tipo
