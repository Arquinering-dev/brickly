# -*- coding: utf-8 -*-
"""Compara KPIs del dashboard v2 (v8_6) contra los valores calculados de v8_5."""
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from reader.read_obra import read_obra
import reader.workbook as w
w._CACHE.clear()

d = read_obra("data/CH_2171_Resumen_de_Obra_v8_6.xlsx", code="CH")
rb = {r["rubro"]: r for r in d["control_ppto"]["rubros"]}
sc = {x["contrato"]: x for x in d["subcontratos"]["items"]}
S = d["cash_flow"]["series"]
meses = d["cash_flow"]["meses"]
mar = meses.index("2026-03-01")
her_real = rb["Herrería MO"]["acum_real"]
ctrl_real_budget = sum(r["acum_real"] for r in d["control_ppto"]["rubros"] if r["presupuestado"] > 0)

NEW = {
    "Hormigón MT · desc": rb["Hormigón MT"]["acum_descontado"],
    "Hormigón MT · real": rb["Hormigón MT"]["acum_real"],
    "Albañilería MO · desc": rb["Albañilería MO"]["acum_descontado"],
    "Albañilería MO · real": rb["Albañilería MO"]["acum_real"],
    "Eléctrico MO · desc": rb["Eléctrico MO"]["acum_descontado"],
    "Herrería MO · desvío": rb["Herrería MO"]["desvio"],
    "Costo controlable · real": ctrl_real_budget + her_real,
    "Cash · Cobrado": sum(S["ingresos"]),
    "Cash · Total egresos": sum(S["total_egresos"]),
    "Cash · Egresos marzo": S["total_egresos"][mar],
    "Cash · Resultado acum": d["resumen"]["resultado_acumulado"],
    "Cash · Valle de caja": d["resumen"]["caja_valle"],
    "SC · Comprometido": d["subcontratos"]["comprometido"],
    "SC · Pagado": d["subcontratos"]["pagado"],
    "SC · Saldo total": d["subcontratos"]["saldo"],
    "SC-002 · saldo": sc["CH-SC-002"]["saldo"],
    "SC-003 · saldo": sc["CH-SC-003"]["saldo"],
}
OLD = {
    "Hormigón MT · desc": 24231156.384185947,
    "Hormigón MT · real": 29197349.47,
    "Albañilería MO · desc": 6791483.784911795,
    "Albañilería MO · real": 8188457.52,
    "Eléctrico MO · desc": 477627.85051529505,
    "Herrería MO · desvío": 340269.14393997873,
    "Costo controlable · real": 84807322.80999,
    "Cash · Cobrado": 128640151.87,
    "Cash · Total egresos": 93309800.91,
    "Cash · Egresos marzo": 29071362.82,
    "Cash · Resultado acum": 35330350.959999986,
    "Cash · Valle de caja": -3462667.45,
    "SC · Comprometido": 58967600.0,
    "SC · Pagado": 54982760.0,
    "SC · Saldo total": 5130009.58,
    "SC-002 · saldo": -50000.0,
    "SC-003 · saldo": 5180009.58,
}
print(f'{"KPI":42}{"OLD (v8_5 3_*)":>20}{"NEW (v2)":>20}{"delta":>13}')
print("-" * 95)
allok = True
for k in OLD:
    o, n = OLD[k], NEW[k]
    dl = o - n
    if abs(dl) > 0.01:
        allok = False
    print(f"{k:42}{o:>20,.2f}{n:>20,.2f}{dl:>13,.2f}")
print("-" * 95)
print("TODOS COINCIDEN (delta < 0.01)" if allok else "HAY DIFERENCIAS")
