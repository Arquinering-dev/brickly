# Relevamiento de movimientos a modificar en Tezamat — CH 2171

> Generado por `scripts/relevamiento_tezamat.py` desde `CH_2171_Resumen_de_Obra_v8_6.xlsx` (hoja `2_Movimientos`, con `Observaciones original` = carga cruda de Tezamat) y el maestro `2_Subcontratos`.

Objetivo: que Arquinering corrija la carga en Tezamat para que el extracto salga correcto **sin curado manual** y el Excel/dashboard funcionen sobre datos históricos.

## Reglas de carga nuevas (definidas con Arquinering)
1. **Pago a subcontrato** → Observaciones con `CH-SC-NNN AVANCE` (o `CAC`/`QUINCENA`/`CARGAS SOCIALES`) y Desc Cuenta = rubro del subcontrato.
2. **SC que ajusta CAC** → el monto de CAC va en un asiento separado del base, con `CH-SC-NNN CAC` en Observaciones.
3. **Quincenas (nómina propia UOCRA)** → el costo se asienta como movimiento en Tezamat.
4. **Rubro** → Desc Cuenta debe ser un rubro canónico (pendiente del plan de cuentas).

## Subcontratos confirmados (maestro `2_Subcontratos`)

| ID | Proveedor | Rubro | Ajusta CAC |
|----|-----------|-------|:----------:|
| CH-SC-001 | CLAUDIO BALACLAV | Electricidad | no |
| CH-SC-002 | ALEJANDRO ARDILES | Agrimensura | no |
| CH-SC-003 | MICROPILOTES | Hormigón | SÍ |
| CH-SC-004 | CELSI VIAL | Excavación y Mov. de Suelos | SÍ |

## Resumen del relevamiento

- **Total movimientos analizados:** 126
- **Tipo 1 — Pagos a subcontrato (agregar ID + rubro):** 10
- **Tipo 2 — Separar CAC del base (crear asiento):** 2
- **Tipo 3 — Cargar quincenas en Tezamat (crear asiento):** 11
- **Tipo 4 — Rubro sin mapear (pendiente plan de cuentas):** 32
- **Sin cambios:** 71

## Tipo 1 — Pagos a subcontratos: agregar ID de SC (+ corregir rubro)

Existen en Tezamat con el proveedor en texto libre. Hay que etiquetarlos con el ID del subcontrato y, donde el Desc Cuenta es genérico (Preliminares, H. Gestoria), reclasificarlos al rubro del SC. El nombre exacto del rubro sigue el maestro `2_Subcontratos`; su forma canónica final (p. ej. "Electricidad"→"Eléctrico") se fija con el plan de cuentas.

| # fila | Fecha | Monto | Desc Cuenta (hoy) | Observación original (hoy) | → Desc Cuenta ajustado | → Observación ajustada | Acción |
|:------:|-------|------:|-------------------|----------------------------|------------------------|------------------------|--------|
| 11 | 2026-02-27 | $520.000 | Preliminares | Claudio Balaclav - Gestor Elec | Electricidad | CH-SC-001 AVANCE | Agregar "CH-SC-001 AVANCE" en Observaciones (hoy: proveedor en texto libre) · Reclasificar Desc Cuenta a rubro del SC: "Electricidad" (hoy "Preliminares", genérico) |
| 18 | 2026-03-05 | $380.000 | Preliminares | Alejandro Ardiles - Agrimensor | Agrimensura | CH-SC-002 AVANCE | Agregar "CH-SC-002 AVANCE" en Observaciones (hoy: proveedor en texto libre) · Reclasificar Desc Cuenta a rubro del SC: "Agrimensura" (hoy "Preliminares", genérico) |
| 24 | 2026-03-10 | $16.781.280 | Hormigón MT | HORMIGON MT - FEIS DEL OESTE C | Hormigón MT | CH-SC-003 AVANCE | Agregar "CH-SC-003 AVANCE" en Observaciones (hoy: proveedor en texto libre) · SC ajusta CAC: verificar si este pago lleva CAC a separar |
| 42 | 2026-03-25 | $350.000 | Preliminares | Alejandro Ardiles - Agrimensor | Agrimensura | CH-SC-002 AVANCE | Agregar "CH-SC-002 AVANCE" en Observaciones (hoy: proveedor en texto libre) · Reclasificar Desc Cuenta a rubro del SC: "Agrimensura" (hoy "Preliminares", genérico) |
| 60 | 2026-04-13 | $520.000 | H. Gestoria | Claudio Balaclav - Gestor Elec | Electricidad | CH-SC-001 AVANCE | Agregar "CH-SC-001 AVANCE" en Observaciones (hoy: proveedor en texto libre) · Reclasificar Desc Cuenta a rubro del SC: "Electricidad" (hoy "H. Gestoria", genérico) |
| 74 | 2026-04-16 | $1.310.000 | Preliminares | Celsi Vial - Certif. #1 | Excavación y Mov. de Suelos | CH-SC-004 AVANCE | Agregar "CH-SC-004 AVANCE" en Observaciones (hoy: proveedor en texto libre) · Reclasificar Desc Cuenta a rubro del SC: "Excavación y Mov. de Suelos" (hoy "Preliminares", genérico) · SC ajusta CAC: verificar si este pago lleva CAC a separar |
| 83 | 2026-04-28 | $6.837.217 | Homigón MO | Micropilotes - FEIS DEL OESTE | Hormigón | CH-SC-003 AVANCE | Agregar "CH-SC-003 AVANCE" en Observaciones (hoy: proveedor en texto libre) · Reclasificar Desc Cuenta a rubro del SC: "Hormigón" (hoy "Homigón MO", genérico) · SC ajusta CAC: verificar si este pago lleva CAC a separar |
| 90 | 2026-04-30 | $10.000.000 | Homigón MO | FEIS Construcciones - Certif. | Hormigón | CH-SC-003 AVANCE | Agregar "CH-SC-003 AVANCE" en Observaciones (hoy: proveedor en texto libre) · Reclasificar Desc Cuenta a rubro del SC: "Hormigón" (hoy "Homigón MO", genérico) · SC ajusta CAC: verificar si este pago lleva CAC a separar |
| 106 | 2026-05-21 | $4.119.224 | Hormigón MT | HORMIGON MT - FEIS DEL OESTE C | Hormigón MT | CH-SC-003 AVANCE | Agregar "CH-SC-003 AVANCE" en Observaciones (hoy: proveedor en texto libre) · SC ajusta CAC: verificar si este pago lleva CAC a separar |
| 107 | 2026-05-21 | $13.019.869 | Homigón MO | HORMIGON MO - FEIS DEL OESTE C | Hormigón | CH-SC-003 AVANCE | Agregar "CH-SC-003 AVANCE" en Observaciones (hoy: proveedor en texto libre) · Reclasificar Desc Cuenta a rubro del SC: "Hormigón" (hoy "Homigón MO", genérico) · SC ajusta CAC: verificar si este pago lleva CAC a separar |

**Subtotal Tipo 1: 10 movimientos · $53.837.590.**

## Tipo 2 — Separar el CAC del monto base

Para los SC que ajustan CAC, el ajuste debe ir en un asiento aparte. Hoy el CAC está embebido en el pago base; hay que crear el movimiento de CAC. **Confirmar los montos exactos contra Tezamat / la certificación del SC.**

| # fila | Fecha | Monto | Desc Cuenta (hoy) | Observación original (hoy) | → Desc Cuenta ajustado | → Observación ajustada | Acción |
|:------:|-------|------:|-------------------|----------------------------|------------------------|------------------------|--------|
| 115 | 2026-04-28 | $492.423 | Homigón MO | (no existe como asiento propio — CAC incluido en el pago base, fila 83 | Homigón MO | CH-SC-003 CAC | CREAR en Tezamat un movimiento de CAC separado del pago base (CH-SC-003). Hoy el pago base y su CAC van juntos en un solo asiento. |
| 116 | 2026-05-21 | $652.747 | Homigón MO | (no existe como asiento propio — CAC incluido en el pago base, fila 10 | Homigón MO | CH-SC-003 CAC | CREAR en Tezamat un movimiento de CAC separado del pago base (CH-SC-003). Hoy el pago base y su CAC van juntos en un solo asiento. |

**Subtotal Tipo 2: 2 movimientos · $1.145.170.**

## Tipo 3 — Cargar quincenas (nómina propia) en Tezamat

El costo de las quincenas UOCRA hoy NO está asentado en Tezamat (se toma de la planilla `2_Quincenas`). Hay que cargarlo como movimiento, con su rubro MO y la referencia de período.

| # fila | Fecha | Monto | Desc Cuenta (hoy) | Observación original (hoy) | → Desc Cuenta ajustado | → Observación ajustada | Acción |
|:------:|-------|------:|-------------------|----------------------------|------------------------|------------------------|--------|
| 117 | 2026-01-01 | $293.600 | Herrería MO | (no existe en Tezamat — costo de quincena no asentado) | Herrería MO | QUINCENA 2026-01 2Q | CARGAR en Tezamat el costo de la quincena (nómina propia UOCRA). Hoy no existe como asiento; se toma de la planilla 2_Quincenas. |
| 118 | 2026-02-01 | $397.453 | Albañilería MO | (no existe en Tezamat — costo de quincena no asentado) | Albañilería MO | QUINCENA 2026-02 1Q | CARGAR en Tezamat el costo de la quincena (nómina propia UOCRA). Hoy no existe como asiento; se toma de la planilla 2_Quincenas. |
| 119 | 2026-03-01 | $931.015 | Albañilería MO | (no existe en Tezamat — costo de quincena no asentado) | Albañilería MO | QUINCENA 2026-03 1Q | CARGAR en Tezamat el costo de la quincena (nómina propia UOCRA). Hoy no existe como asiento; se toma de la planilla 2_Quincenas. |
| 120 | 2026-03-01 | $189.130 | Eléctrico MO | (no existe en Tezamat — costo de quincena no asentado) | Eléctrico MO | QUINCENA 2026-03 1Q | CARGAR en Tezamat el costo de la quincena (nómina propia UOCRA). Hoy no existe como asiento; se toma de la planilla 2_Quincenas. |
| 121 | 2026-03-01 | $2.788.085 | Homigón MO | (no existe en Tezamat — costo de quincena no asentado) | Homigón MO | QUINCENA 2026-03 1Q | CARGAR en Tezamat el costo de la quincena (nómina propia UOCRA). Hoy no existe como asiento; se toma de la planilla 2_Quincenas. |
| 122 | 2026-03-01 | $1.243.479 | Albañilería MO | (no existe en Tezamat — costo de quincena no asentado) | Albañilería MO | QUINCENA 2026-03 2Q | CARGAR en Tezamat el costo de la quincena (nómina propia UOCRA). Hoy no existe como asiento; se toma de la planilla 2_Quincenas. |
| 123 | 2026-03-01 | $378.259 | Eléctrico MO | (no existe en Tezamat — costo de quincena no asentado) | Eléctrico MO | QUINCENA 2026-03 2Q | CARGAR en Tezamat el costo de la quincena (nómina propia UOCRA). Hoy no existe como asiento; se toma de la planilla 2_Quincenas. |
| 124 | 2026-03-01 | $102.029 | Herrería MO | (no existe en Tezamat — costo de quincena no asentado) | Herrería MO | QUINCENA 2026-03 2Q | CARGAR en Tezamat el costo de la quincena (nómina propia UOCRA). Hoy no existe como asiento; se toma de la planilla 2_Quincenas. |
| 125 | 2026-03-01 | $1.169.571 | Homigón MO | (no existe en Tezamat — costo de quincena no asentado) | Homigón MO | QUINCENA 2026-03 2Q | CARGAR en Tezamat el costo de la quincena (nómina propia UOCRA). Hoy no existe como asiento; se toma de la planilla 2_Quincenas. |
| 126 | 2026-04-01 | $1.357.510 | Albañilería MO | (no existe en Tezamat — costo de quincena no asentado) | Albañilería MO | QUINCENA 2026-04 1Q | CARGAR en Tezamat el costo de la quincena (nómina propia UOCRA). Hoy no existe como asiento; se toma de la planilla 2_Quincenas. |
| 127 | 2026-04-01 | $2.711.432 | Homigón MO | (no existe en Tezamat — costo de quincena no asentado) | Homigón MO | QUINCENA 2026-04 1Q | CARGAR en Tezamat el costo de la quincena (nómina propia UOCRA). Hoy no existe como asiento; se toma de la planilla 2_Quincenas. |

**Subtotal Tipo 3: 11 movimientos · $11.561.564.**

## Tipo 4 — Cuentas sin rubro canónico (pendiente plan de cuentas)

Estas cuentas Tezamat no mapean a un rubro de obra y caen como gasto sin presupuesto. La mayoría son **gastos indirectos / generales** (honorarios de seguridad e higiene, gestoría, volquetes, baños químicos, agua, EPP, gastos en personal) que probablemente vayan a Gastos Generales / indirectos, no a un rubro de obra. Se resuelven al recibir el plan de cuentas de Tezamat — NO modificar aún. Incluye un ajuste en negativo (fila 85) a revisar.

| # fila | Fecha | Monto | Desc Cuenta (hoy) | Observación original (hoy) | → Desc Cuenta ajustado | → Observación ajustada | Acción |
|:------:|-------|------:|-------------------|----------------------------|------------------------|------------------------|--------|
| 3 | 2026-01-22 | $2.000 | Varios Ferreteria | Varios Ferreteria | (definir con plan de cuentas) | Varios Ferreteria | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 5 | 2026-01-23 | $6.200 | Varios Ferreteria | Varios Ferreteria | (definir con plan de cuentas) | Varios Ferreteria | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 6 | 2026-02-02 | $517.195 | H. Seguridad e Higiene | Honorarios Seguridad e Higiene | (definir con plan de cuentas) | Honorarios Seguridad e Higiene | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 9 | 2026-02-24 | $247.000 | Gastos Generales | Baño portatil - ECOBAT SRL | (definir con plan de cuentas) | Baño portatil - ECOBAT SRL | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 14 | 2026-03-03 | $517.195 | H. Seguridad e Higiene | Honorarios Seguridad e Higiene | (definir con plan de cuentas) | Honorarios Seguridad e Higiene | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 15 | 2026-03-03 | $18.500 | Varios Ferreteria | Varios Ferreteria | (definir con plan de cuentas) | Varios Ferreteria | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 17 | 2026-03-05 | $8.000 | Gastos en personal | Gastos en personal | (definir con plan de cuentas) | Gastos en personal | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 19 | 2026-03-06 | $21.000 | Varios Ferreteria | Varios Ferreteria | (definir con plan de cuentas) | Varios Ferreteria | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 33 | 2026-03-13 | $1.000 | Varios Ferreteria | Varios Ferreteria | (definir con plan de cuentas) | Varios Ferreteria | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 34 | 2026-03-13 | $14.500 | Varios Ferreteria | Varios Ferreteria | (definir con plan de cuentas) | Varios Ferreteria | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 37 | 2026-03-16 | $309.091 | Seguridad e Higiene | Matafuegos - LSH Servicios SRL | (definir con plan de cuentas) | Matafuegos - LSH Servicios SRL | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 47 | 2026-03-30 | $227.000 | Gastos Generales | Baño quimico - ECOBAT SRL | (definir con plan de cuentas) | Baño quimico - ECOBAT SRL | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 53 | 2026-04-01 | $517.195 | H. Seguridad e Higiene | Honorarios Seguridad e Higiene | (definir con plan de cuentas) | Honorarios Seguridad e Higiene | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 56 | 2026-04-01 | $52.000 | Varios Ferreteria | Varios Ferreteria | (definir con plan de cuentas) | Varios Ferreteria | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 58 | 2026-04-11 | $66.529 | Aguas | Aguas - EMBOTELLADORA BONSAL | (definir con plan de cuentas) | Aguas - EMBOTELLADORA BONSAL | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 61 | 2026-04-14 | $30.220 | Gastos en personal | Farmacia | (definir con plan de cuentas) | Farmacia | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 65 | 2026-04-14 | $49.000 | Gastos Generales | Kit de ollas y utensilios | (definir con plan de cuentas) | Kit de ollas y utensilios | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 66 | 2026-04-14 | $10.000 | Varios Ferreteria | Varios Ferreteria | (definir con plan de cuentas) | Varios Ferreteria | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 67 | 2026-04-14 | $7.000 | Varios Ferreteria | Varios Ferreteria | (definir con plan de cuentas) | Varios Ferreteria | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 68 | 2026-04-14 | $78.892 | Varios Ferreteria | Varios Ferreteria | (definir con plan de cuentas) | Varios Ferreteria | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 78 | 2026-04-17 | $900.000 | Gastos Generales | Volquetes | (definir con plan de cuentas) | Volquetes | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 79 | 2026-04-23 | $328.017 | Varios Ferreteria | Varios Ferreteria - Sabatini D | (definir con plan de cuentas) | Varios Ferreteria - Sabatini D | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 84 | 2026-04-28 | $227.000 | Gastos Generales | Baño portatil - ECOBAT SRL | (definir con plan de cuentas) | Baño portatil - ECOBAT SRL | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 85 | 2026-04-29 | $-75.000 | Gastos Generales | GASTOS GENERALES - ECOBAT SRL | (definir con plan de cuentas) | GASTOS GENERALES - ECOBAT SRL | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 91 | 2026-05-04 | $28.000 | Gastos en personal | Gastos en Personales - Sabatin | (definir con plan de cuentas) | Gastos en Personales - Sabatin | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 92 | 2026-05-04 | $18.000 | Gastos en personal | Gastos en Personales - Sabatin | (definir con plan de cuentas) | Gastos en Personales - Sabatin | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 93 | 2026-05-04 | $19.500 | Varios Ferreteria | Varios Ferreteria - Sabatini D | (definir con plan de cuentas) | Varios Ferreteria - Sabatini D | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 94 | 2026-05-05 | $307.848 | Gastos en personal | EPP - Abrafer S.R.L. | (definir con plan de cuentas) | EPP - Abrafer S.R.L. | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 95 | 2026-05-05 | $1.195.790 | H. Seguridad e Higiene | Honorarios Seguridad e Higiene | (definir con plan de cuentas) | Honorarios Seguridad e Higiene | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 96 | 2026-05-07 | $38.017 | Aguas | Aguas - EMBOTELLADORA BONSAL | (definir con plan de cuentas) | Aguas - EMBOTELLADORA BONSAL | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 103 | 2026-05-19 | $1.520.000 | Gastos Generales | Volquetes | (definir con plan de cuentas) | Volquetes | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |
| 114 | 2026-06-02 | $775.790 | H. Seguridad e Higiene | Honorarios Seguridad e Higiene | (definir con plan de cuentas) | Honorarios Seguridad e Higiene | Pendiente plan de cuentas Tezamat: esta cuenta no mapea a un rubro canónico de obra (cae como gasto sin presupuesto en el control). |

**Subtotal Tipo 4: 32 movimientos · $7.982.478.**

## Movimientos sin cambios

71 movimientos ya están cargados correctamente (cuenta con rubro válido, sin SC ni quincena ni CAC pendiente). Resumen por Desc Cuenta:

| Desc Cuenta | # mov | Monto |
|-------------|:-----:|------:|
| Hormigón MT | 9 | $8.296.846 |
| Albañilería MO | 7 | $4.259.000 |
| Preliminares | 21 | $3.606.386 |
| Mov. Variables | 24 | $1.506.981 |
| Albañilería MT | 5 | $679.248 |
| Sanitaria MT | 1 | $434.539 |
| Obra civil Reforma | 4 | $-128.640.152 |
