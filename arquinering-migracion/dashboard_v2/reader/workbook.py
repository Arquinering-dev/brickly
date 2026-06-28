"""Carga de workbooks con cache keyed por (ruta, mtime).

El dashboard lee el último guardado de Excel (data_only=True): muestra los
valores cacheados por Excel, no recalcula fórmulas. Guardás en Excel -> cambia el
mtime -> el cache se invalida -> al refrescar ves datos frescos.
"""
import os
import time
import openpyxl

_CACHE = {}          # ruta -> {'mtime':, 'parsed':, 'ts':}
TTL_SECONDS = 10     # ventana en la que no se vuelve a stat-ear agresivamente


def load_values_wb(path):
    """Workbook con valores calculados (data_only). No usa read_only porque el
    parser hace acceso aleatorio por .cell() (read_only sólo permite iterar). Los
    archivos v8 son chicos (<2k filas), el costo es despreciable."""
    return openpyxl.load_workbook(path, data_only=True, read_only=False)


def get_parsed(path, parse_fn):
    """Devuelve el dict parseado de un archivo, recachéandolo sólo si cambió el
    mtime. `parse_fn(path) -> dict` hace la lectura real."""
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    mtime = os.path.getmtime(path)
    now = time.time()
    entry = _CACHE.get(path)
    if entry and entry["mtime"] == mtime:
        return entry["parsed"]
    parsed = parse_fn(path)
    _CACHE[path] = {"mtime": mtime, "parsed": parsed, "ts": now}
    return parsed


def invalidate(path=None):
    if path is None:
        _CACHE.clear()
    else:
        _CACHE.pop(path, None)
