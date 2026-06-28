"""Registro de obras: lee config/obras.yaml y resuelve rutas a data/."""
import os
import yaml

_BASE = os.path.dirname(os.path.dirname(__file__))
_CONFIG = os.path.join(_BASE, "config", "obras.yaml")
_DATA = os.path.join(_BASE, "data")


def load_registry():
    """Devuelve lista de obras declaradas: [{code, nombre, seccion, path}].
    Filtra (con aviso) las que no tengan archivo presente en data/."""
    with open(_CONFIG, "r", encoding="utf-8") as fh:
        cfg = yaml.safe_load(fh) or {}
    obras = []
    for o in cfg.get("obras", []):
        arch = o["archivo"]
        # `archivo` simple (sin separador) -> data/ (convención por defecto).
        # `archivo` con ruta (abs o relativa con / o \) -> se resuelve tal cual
        # (relativa al dir de dashboard_v2), p.ej. "../archivos/output/X.xlsx".
        if os.path.isabs(arch):
            path = arch
        elif ("/" in arch) or ("\\" in arch):
            path = os.path.normpath(os.path.join(_BASE, arch))
        else:
            path = os.path.join(_DATA, arch)
        obras.append({
            "code": o["code"],
            "nombre": o.get("nombre", o["code"]),
            "seccion": o.get("seccion", ""),
            "archivo": o["archivo"],
            "path": path,
            "existe": os.path.exists(path),
        })
    return obras


def get_obra(code):
    for o in load_registry():
        if o["code"].lower() == code.lower():
            return o
    return None
