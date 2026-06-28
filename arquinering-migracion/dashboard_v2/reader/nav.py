"""Navegación anclada por texto sobre hojas v8.

Las dos obras (GDR, CH) derivan en fila de header, columna de cada métrica, fila
de total y wording de etiquetas. Nada se puede leer por coordenada fija. Estos
helpers localizan regiones buscando texto (banners/headers) y mapean
header->columna por palabra clave, de modo que una obra nueva con otro layout se
lee sin tocar código.
"""
import unicodedata


def norm(v):
    """Normaliza texto para matching: sin tildes, minúsculas, sin saltos de línea,
    espacios colapsados y sin numeración inicial tipo '3. '."""
    if v is None:
        return ""
    s = str(v)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace("\n", " ").replace("\r", " ")
    s = " ".join(s.split())
    # quita numeración de prefijo: "3. egresos" -> "egresos"
    if "." in s:
        head, _, tail = s.partition(".")
        if head.strip().isdigit():
            s = tail.strip()
    return s


def is_date(v):
    return hasattr(v, "year") and hasattr(v, "month") and not isinstance(v, bool)


def num(v, default=0.0):
    """Convierte a float de forma defensiva; '' / None / texto -> default."""
    if v is None or v == "":
        return default
    if isinstance(v, bool):
        return default
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def cells_row(ws, row, max_col=None):
    """Lista de valores de una fila (1-indexed)."""
    mc = max_col or ws.max_column
    return [ws.cell(row=row, column=c).value for c in range(1, mc + 1)]


def find_row(ws, *keywords, col=1, contains_all=True, max_row=None):
    """Primera fila cuyo valor en `col` (normalizado) matchea las keywords.
    contains_all=True -> deben estar todas; False -> alguna."""
    mr = max_row or ws.max_row
    kws = [norm(k) for k in keywords]
    for r in range(1, mr + 1):
        t = norm(ws.cell(row=r, column=col).value)
        if not t:
            continue
        hit = all(k in t for k in kws) if contains_all else any(k in t for k in kws)
        if hit:
            return r
    return None


def find_row_scan(ws, *keywords, max_row=None):
    """Primera fila donde ALGUNA celda (cualquier columna) contiene todas las
    keywords. Útil para localizar headers cuyo título no está en la col A."""
    mr = max_row or ws.max_row
    kws = [norm(k) for k in keywords]
    for r in range(1, mr + 1):
        for c in range(1, ws.max_column + 1):
            t = norm(ws.cell(row=r, column=c).value)
            if t and all(k in t for k in kws):
                return r
    return None


def find_banner(ws, *keywords, col=1, max_row=None):
    """Fila de un banner de sección (texto que suele empezar con '▌')."""
    return find_row(ws, *keywords, col=col, max_row=max_row)


def find_date_header(ws, min_dates=3, max_row=20):
    """Fila de encabezado de meses: la primera con >= min_dates fechas desde col B.
    Devuelve (row, [(col, fecha), ...])."""
    mr = min(max_row, ws.max_row)
    for r in range(1, mr + 1):
        months = [(c, ws.cell(row=r, column=c).value)
                  for c in range(2, ws.max_column + 1)
                  if is_date(ws.cell(row=r, column=c).value)]
        if len(months) >= min_dates:
            return r, months
    return None, []


def map_columns(ws, header_row, specs):
    """Mapea campos->columna escaneando el header.
    specs: dict campo -> {'any': [...], 'all': [...], 'not': [...]} (keywords ya en lenguaje natural).
    Devuelve dict campo -> col (1-indexed). Primer match gana por columna."""
    cols = {}
    headers = [(c, norm(ws.cell(row=header_row, column=c).value))
               for c in range(1, ws.max_column + 1)]
    for field, rule in specs.items():
        need_all = [norm(k) for k in rule.get("all", [])]
        need_any = [norm(k) for k in rule.get("any", [])]
        forbid = [norm(k) for k in rule.get("not", [])]
        for c, h in headers:
            if not h:
                continue
            if any(f in h for f in forbid):
                continue
            if need_all and not all(k in h for k in need_all):
                continue
            if need_any and not any(k in h for k in need_any):
                continue
            cols[field] = c
            break
    return cols


def read_rows(ws, start_row, col_map, stop):
    """Itera filas desde start_row construyendo dicts según col_map (campo->col).
    `stop(row_index, value_of_first_mapped_col)` corta la iteración.
    Devuelve lista de dicts con además '_row'."""
    out = []
    anchor_col = next(iter(col_map.values()))
    for r in range(start_row, ws.max_row + 1):
        anchor_val = ws.cell(row=r, column=anchor_col).value
        if stop(r, anchor_val):
            break
        rec = {"_row": r}
        for field, c in col_map.items():
            rec[field] = ws.cell(row=r, column=c).value
        out.append(rec)
    return out


def config_dict(ws, max_row=None):
    """0_CONFIG como dict etiqueta_normalizada -> {'label': original, 'value':, 'note':}."""
    mr = max_row or ws.max_row
    d = {}
    for r in range(1, mr + 1):
        label = ws.cell(row=r, column=1).value
        if label is None or str(label).strip() == "":
            continue
        key = norm(label)
        if not key:
            continue
        d[key] = {
            "label": str(label).strip(),
            "value": ws.cell(row=r, column=2).value,
            "note": ws.cell(row=r, column=3).value,
        }
    return d


def cfg_get(cfg, *keyword_sets, default=None):
    """Busca en config_dict una clave que contenga TODAS las keywords de algún set.
    keyword_sets: cada arg es una lista de keywords (se prueban en orden)."""
    for kws in keyword_sets:
        kws_n = [norm(k) for k in kws]
        for key, entry in cfg.items():
            if entry["value"] in (None, ""):
                continue  # saltea banners de sección (sin valor en col B)
            if all(k in key for k in kws_n):
                return entry["value"]
    return default
