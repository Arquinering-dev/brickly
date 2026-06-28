"""Backend del Dashboard Arquinering — VERSIÓN 2 (estructura v8_6).

Igual contrato JSON que el dashboard v1, pero el reader lee la estructura nueva
(2_Movimientos crudo + Cert_* + 1_Presupuesto) en vez de las hojas 3_* (eliminadas).
Frontend = design system "Industrial Integrity" (idéntico al /ds de v1), servido
en la raíz. Sólo Chivilcoy por ahora (GDR aún no migrado a v8_6).

Uso:
    python dashboard_v2/app.py            # http://127.0.0.1:5001
"""
import os
import sys

from flask import Flask, jsonify, send_from_directory, abort, request

sys.path.insert(0, os.path.dirname(__file__))
from reader.read_obra import read_obra, portfolio_card, semaforo_global  # noqa
from reader.registry import load_registry, get_obra      # noqa
from reader.workbook import load_values_wb                # noqa
from reader.drilldown import (rubro_detail, subcontrato_detail,  # noqa
                              mes_detail, etapa_detail, cert_detail)

WEB = os.path.join(os.path.dirname(__file__), "web")
app = Flask(__name__, static_folder=WEB, static_url_path="")


# ----------------------------------------------------------------- API
@app.get("/api/obras")
def api_obras():
    """Tarjetas de portfolio de todas las obras declaradas y presentes."""
    cards = []
    for o in load_registry():
        if not o["existe"]:
            cards.append({"code": o["code"], "nombre": o["nombre"],
                          "error": "archivo no encontrado en data/"})
            continue
        try:
            d = read_obra(o["path"], code=o["code"], nombre=o["nombre"],
                          seccion=o["seccion"])
            cards.append(portfolio_card(d))
        except Exception as e:  # una obra rota no debe tumbar el portfolio
            cards.append({"code": o["code"], "nombre": o["nombre"],
                          "error": f"{type(e).__name__}: {e}"})
    return jsonify({"obras": cards})


@app.get("/api/obras/<code>")
def api_obra(code):
    o = get_obra(code)
    if not o:
        abort(404, description=f"Obra '{code}' no está en el registro")
    if not o["existe"]:
        abort(404, description=f"Archivo de '{code}' no encontrado en data/")
    d = read_obra(o["path"], code=o["code"], nombre=o["nombre"], seccion=o["seccion"])
    d["semaforo"] = semaforo_global(d)
    return jsonify(d)


def _open(code):
    o = get_obra(code)
    if not o or not o["existe"]:
        abort(404, description=f"Obra '{code}' no disponible")
    return o, read_obra(o["path"], code=o["code"], nombre=o["nombre"], seccion=o["seccion"])


@app.get("/api/obras/<code>/rubro")
def api_rubro(code):
    rubro = request.args.get("rubro")
    tipo = request.args.get("tipo")
    if not rubro or not tipo:
        abort(400, description="Faltan parámetros 'rubro' y 'tipo'")
    o, d = _open(code)
    ctrl = next((r for r in d["control_ppto"]["rubros"]
                 if r["rubro"] == rubro and r["tipo"] == tipo), None)
    wb = load_values_wb(o["path"])
    try:
        detail = rubro_detail(wb, rubro, tipo, control=ctrl)
    finally:
        wb.close()
    detail["control"] = ctrl
    return jsonify(detail)


@app.get("/api/obras/<code>/subcontrato")
def api_subcontrato(code):
    contrato = request.args.get("contrato")
    if not contrato:
        abort(400, description="Falta 'contrato'")
    o, d = _open(code)
    ctrl = next((s for s in d["subcontratos"]["items"] if s["contrato"] == contrato), None)
    wb = load_values_wb(o["path"])
    try:
        return jsonify(subcontrato_detail(wb, contrato, control=ctrl))
    finally:
        wb.close()


@app.get("/api/obras/<code>/mes")
def api_mes(code):
    mes = request.args.get("mes")
    if not mes:
        abort(400, description="Falta 'mes' (YYYY-MM)")
    o, _ = _open(code)
    wb = load_values_wb(o["path"])
    try:
        return jsonify(mes_detail(wb, mes))
    finally:
        wb.close()


@app.get("/api/obras/<code>/etapa")
def api_etapa(code):
    etapa = request.args.get("etapa")
    if not etapa:
        abort(400, description="Falta 'etapa'")
    o, d = _open(code)
    ctrl = next((e for e in d["avance_etapa"]["items"] if e["etapa"] == etapa), None)
    wb = load_values_wb(o["path"])
    try:
        return jsonify(etapa_detail(wb, etapa, control=ctrl))
    finally:
        wb.close()


@app.get("/api/obras/<code>/cert")
def api_cert(code):
    cid = request.args.get("id")
    if not cid:
        abort(400, description="Falta 'id' (ID Certif)")
    o, _ = _open(code)
    wb = load_values_wb(o["path"])
    try:
        return jsonify(cert_detail(wb, cid))
    finally:
        wb.close()


# --------------------------------------------------------------- VISTAS
# El DS es el único frontend de v2: portfolio en /, y las rutas /obra/... y
# (compat con deep-links de v1) /ds/... sirven el mismo SPA.
@app.get("/")
@app.get("/obra/<code>")
@app.get("/obra/<code>/<module>")
@app.get("/ds")
@app.get("/ds/obra/<code>")
@app.get("/ds/obra/<code>/<module>")
def ds_view(code=None, module=None):
    return send_from_directory(WEB, "ds.html")


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": str(e.description)}), 404


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)
