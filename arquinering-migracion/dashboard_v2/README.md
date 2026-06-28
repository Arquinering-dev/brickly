# Dashboard v2 — Arquinering (estructura v8_6)

Vista ejecutiva del Resumen de Obra en el **formato nuevo v8_6** (Tezamat crudo +
circuito de certificación `Cert_*`). Proyecto **standalone**, independiente del
`dashboard/` v1: no lo pisa, corre aparte.

- **Sólo Chivilcoy** por ahora. GDR todavía no fue acondicionado a v8_6; cuando lo
  esté, se suelta el `.xlsx` en `data/` + 3 líneas en `config/obras.yaml`.
- **Frontend idéntico** al design system "Industrial Integrity" del v1 (mismo
  `ds.html/ds.js/ds.css`). El contrato JSON del reader es el mismo; sólo cambian
  las FUENTES dentro del Excel. Por eso el front no se tocó.
- La vista cross-obra (Portfolio) funciona con una sola obra.

## Correr
```powershell
python -m pip install -r dashboard_v2/requirements.txt   # primera vez
python dashboard_v2/app.py                                # http://127.0.0.1:5001
```
Corre en el **puerto 5001** (el v1 usa el 5000), así pueden convivir.

## Estructura
```
dashboard_v2/
├── app.py                 # Flask: /api/obras, /api/obras/<code>, drill endpoints, vistas DS
├── config/obras.yaml      # registro (sólo CH por ahora)
├── data/                  # CH_2171_Resumen_de_Obra_v8_6.xlsx
├── reader/
│   ├── nav.py             # navegación anclada por texto (idéntico a v1)
│   ├── workbook.py        # carga + cache por mtime (idéntico a v1)
│   ├── registry.py        # lee obras.yaml (idéntico a v1)
│   ├── movimientos.py     # CAPA DE DERIVACIÓN sobre 2_Movimientos (ver abajo)
│   ├── cert.py            # certificación / avance / facturación desde Cert_* (5 hojas)
│   ├── read_obra.py       # contrato JSON: control_ppto, cash_flow, subcontratos, jornales, resumen
│   └── drilldown.py       # deep-dives: rubro, subcontrato, mes, etapa
└── web/                   # = DS "Industrial Integrity" del v1 (sin cambios)
```

## De dónde sale cada dato (v8_6)

**Capa de derivación de `2_Movimientos`** (`movimientos.py`) — el extracto de
Tezamat ya no trae columnas calculadas; se reconstruyen:
- `Mes` = inicio de mes de Fecha Asiento · `Monto Real` = Debe − Haber ·
  `Monto Descontado` = Real × ratio CAC (`0_Indice_CAC!Ratio` por mes) ·
  `Tipo Mov` = INGRESO si Cuenta empieza en `4`, si no EGRESO ·
  `Rubro` = Desc Cuenta (string exacto, con sufijo MT/MO) ·
  `ID SC` = `CH-SC-NNN` + tipo (AVANCE/CAC/QUINCENA/CARGAS) leído de Observaciones.

| Sección | Fuente |
|---|---|
| Control Ppto — presupuestado | `1_Presupuesto` SUMPRODUCT (A×K + B×K + C×L + D×M)×Cant → reconcilia a `0_CONFIG!B16` |
| Control Ppto — gasto acum | `2_Movimientos` por Desc Cuenta (Real / Descontado), sólo EGRESO |
| Avance físico + Avance por etapa | `Cert_Control_OC` (% avance, certificado, por OC + TOTAL) |
| Certificaciones / Facturación | `Cert_Calculo` (ledger B/N, base/CAC/IVA/total) + `Cert_Facturacion` (cobro/conciliado) |
| Cash Flow | `2_Movimientos` agregado por mes (ingresos = INGRESO, egresos = EGRESO) |
| Subcontratos | maestro `2_Subcontratos` + pagos cruzados por ID en Observaciones |
| Jornales (UOCRA) | `1_Composicion` (ppto: Cant MO/ALB Total × 8) + `2_Quincenas` (horas reales) |

## Decisiones de datos (a confirmar con Pedro) — ver `logs/pendientes.md`
1. **Cruce por Desc Cuenta** (interino): ~$8,5M (8 cuentas Tezamat sin rubro
   canónico: Aguas, Varios Ferretería, Gastos Generales, H. Gestoría, etc.)
   caen como "gasto sin presupuesto". Se resuelve con el plan de cuentas de Tezamat.
2. **Cobrado = tesorería** (ingresos acumulados de `2_Movimientos`, `resumen.cobrado`);
   el cobrado conciliado al circuito `Cert_*` se expone aparte (`cobrado_conciliado`) y,
   si difieren, sale un `data_gap`. (Actualizado en la auditoría 2026-06-26; antes el
   headline usaba Cert_*.)
3. **Avance físico = `Cert_Control_OC` col E**, NO certificado/venta; el avance
   **financiero** (cert÷venta) se expone aparte (`avance_financiero_pct`).
4. Cash Flow Gastos Directos/Indirectos (`2_Gastos_DirInd`): **cableados** — suman a
   `total_egresos` (nominal) y el chart los muestra como serie propia (sin overlap con
   Tezamat, verificado). Sólo `ingresos_cac` queda como placeholder (0).
5. Quincenas: el COSTO entra por `2_Movimientos` (filas con cuenta vacía); las
   HORAS por `2_Quincenas`. No se doble-cuenta.
