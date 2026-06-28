# LÓGICA DE CÁLCULO — Resumen de Obra v8 (Egresos)
## Contrato para el motor del dashboard

Este documento traduce a especificación legible la lógica que vivía en las
hojas `3_Control_Ppto`, `3_Control_Jornales`, `3_Cash_Flow` y `3_Dashboard`,
más las columnas calculadas de `2_Movimientos` y `2_Subcontratos`.

Tras el adelgazamiento del v8, **esas hojas y columnas dejan de existir en el
Excel**. El Excel solo entrega FUENTE cruda. El motor del dashboard (Claude
Code) recalcula todo lo de abajo leyendo las hojas fuente en vivo.

> Referencia tomada de `CH_2171_Resumen_de_Obra_v8_5.xlsx`. La estructura es
> idéntica en GDR; los rubros, períodos y parámetros cambian por obra.

> ⚠️ **Addendum post-auditoría (2026-06-26).** Este doc describe la lógica de referencia v8_5; el
> motor evolucionó. Donde difieran, manda el código + `CLAUDE.md` §"Estado v2 — post-auditoría".
> Cambios clave: (1) **CAC** — el ratio se lee por CONTENIDO de la columna (numérica en (0,2] con el
> 1,0 del mes base), no por el header (CH "Ratio deflactación" vs GDR/SVD "Indice"); los meses sin
> índice se reportan como `data_gap`, NO se rellenan con 1,0 en silencio. (2) **Avance físico** =
> `Cert_Control_OC` col E (no cert÷venta); el financiero (cert÷venta) se expone aparte. (3) **Cobrado**
> = tesorería (2_Movimientos ingresos); el conciliado a `Cert_*` va aparte. (4) **Cash Flow** nominal,
> egresos partidos Tezamat vs Dir/Ind; el drill de mes incluye egresos negativos (notas de crédito).
> (5) **Subcontratos** — regla CAC/CS del `SPEC_Conciliacion_Movimientos_v8` (BASE+ANT descuentan
> saldo; CAC y CS no). (6) Nuevo top-level `data_gaps` que surfacea huecos en vez de rellenarlos.

---

## 0. Columnas calculadas que se ELIMINAN de `2_Movimientos`
> El motor las reconstruye al leer el extracto crudo. Sin esto, no hay insumo
> para los KPIs de abajo.

| Col elim. | Nombre | Cómo la recalcula el motor |
|---|---|---|
| **C** | Mes | Primer día del mes de la Fecha de Asiento (col F). Equiv. `EOMONTH(F,-1)+1`. Truncar F a inicio de mes. |
| **T** | Monto Real | `Debe − Haber` = `col L − col M`. |
| **S** | Monto Descontado (deflactado CAC) | `(L − M) × ratio_CAC(mes)`. El ratio sale de `0_Indice_CAC`: `ratio(mes) = CAC_base / CAC(mes)`, con `CAC_base` = valor INDEC del mes base del proyecto (`0_Indice_CAC`, mes marcado como base; en CH = jun-2025 = 16.643,40). |
| **Y** | Tipo Mov | `INGRESO` si el primer dígito de la Cuenta (col D) es `4`; si no, `EGRESO`. |
| **X** | En 3_Control_Ppto | Obsoleta. No reconstruir (era un flag interno). |

**Clave de cruce de egresos:** los KPIs cruzan por **Desc Cuenta (col E)** contra
el rubro. (Antes existían cols A/B que traducían cuenta→rubro; eliminadas: el
rubro viene alineado en origen vía plan de cuentas de Tezamat.)

---

## 1. CONTROL PRESUPUESTARIO  (ex `3_Control_Ppto`)
Una fila por rubro (con sufijo ` MT`/` MO`). Para cada rubro `R`:

| KPI | Fórmula (legible) | Origen |
|---|---|---|
| **Tipo** | `MT` si el rubro termina en " MT"; `MO` si termina en " MO"; si no "—". | nombre del rubro |
| **Presupuestado (C)** | Σ sobre `1_Presupuesto` de `cantidad(K) × precio_unit` donde el rubro coincide. Suma 4 aperturas: col A×K×J, col B×K×J, col C×L×J, col D×M×J. (A/B/C/D = las 4 columnas de rubro auxiliares: materiales, provisiones, MO-sub, MO-interna). | `1_Presupuesto` A:D, J,K,L,M |
| **Acum. Descontado (E)** | `SUMIFS(2_Movimientos.S, 2_Movimientos.E = R)` → con S eliminada: `Σ MontoReal_deflactado de los movimientos cuyo Desc Cuenta = R`. | movimientos |
| **Acum. Real (F)** | `Σ MontoReal (L−M) de los movimientos cuyo Desc Cuenta = R`. | movimientos |
| **Saldo (H)** | `MAX(Presupuestado − Acum.Descontado, 0)`. | — |
| **% ejecución (I)** | `MIN(MAX(1 − Descontado/Presup, 0), 1)`; si error → 0. | — |
| **Desvío $ (K)** | `MAX(Descontado − Presupuestado, 0)`. | — |
| **Desvío % (L)** | `MAX(Descontado/Presupuestado − 1, 0)`; si error → 0. | — |
| **Alerta (M)** | 🔴 si Desvío% > 0,10 · 🟡 si > 0,05 · 🟢 resto. | umbral |
| **% Avance certif. (O)** | (Σ avance físico ponderado, cols AI/AJ/AK de `1_Presupuesto`) ÷ (Σ cant total, cols R/S/T × J). Si error → 0. | `1_Presupuesto` AI:AK, R:T |
| **% Sobrante (Q)** | si avance=100% Y Desvío%≤0 → `Saldo/Presupuestado`; si no 0. | — |

**Total (fila 36 "TOTAL COSTO CONTROLABLE"):** `SUM` de las filas de rubro de C
y E. **Nota:** EQ excluido del costo controlable (decisión de arquitectura).

---

## 2. CONTROL DE JORNALES  (ex `3_Control_Jornales`)
Una fila por (Rubro MO, Categoría). Categorías: ESPECIALIZADO, OFICIAL, MEDIO
OFICIAL, AYUDANTE.

| KPI | Fórmula (legible) | Origen |
|---|---|---|
| **Jornales (C)** | `SUMIFS(1_Composicion.Q, 1_Composicion.S = Rubro, 1_Composicion.E = Categoría)`. | `1_Composicion` Q,S,E |
| **Horas PPTO (D)** | `Jornales × 8`. | — |
| **Horas Acum. (E)** | horas reales de `2_Quincenas` para ese rubro/categoría: `G + H×1,5 + I×2` (normal + extra50 + extra100), filtrando `2_Quincenas.E = rubro` y `.D = categoría`. La fila "Total" suma por rubro sin filtrar categoría. | `2_Quincenas` G,H,I,D,E |
| **Saldo (F)** | `MAX(PPTO − Acum, 0)`. | — |
| **Saldo % (G)** | `Saldo/PPTO` si Saldo>0; si no 0. | — |
| **Desvío (H)** | `Acum − PPTO` si Acum>PPTO; si no 0. | — |
| **Desvío % (I)** | `Desvío/PPTO`. | — |
| **Alerta (J)** | ⚪ si Saldo=0 · 🔴 si hay saldo (lógica original: sin saldo consumido = blanco). | — |

---

## 3. CASH FLOW  (ex `3_Cash_Flow`)
Columnas = meses del proyecto (CH: ene-2026 → jun-2027). Filas:

| Fila | Fórmula (legible) | Origen |
|---|---|---|
| **Ingresos (cobros)** | `−SUMIFS(MontoReal, TipoMov=INGRESO, Mes=m)` (negativo porque ingresos van con signo invertido en el haber). | movimientos T,Y,C |
| **Ingresos por CAC** | 0 por ahora (placeholder; se define al cerrar ingresos). | — |
| **Egresos (Gastos+Quincenas)** | `SUMIFS(MontoReal, TipoMov=EGRESO, Mes=m)`. | movimientos T,Y,C |
| **Gastos Directos / Indirectos** | (vacías hoy; reservadas para `2_Gastos_DirInd`). | `2_Gastos_DirInd` |
| **TOTAL EGRESOS** | suma de Egresos + Directos + Indirectos. | — |
| **Resultado del mes** | `Ingresos − Total Egresos`. | — |
| **Resultado acumulado** | acumulado corrido mes a mes. | — |

---

## 4. DASHBOARD EJECUTIVO  (ex `3_Dashboard`)
KPIs de cabecera. Todos derivables de fuente + secciones 1–3:

| KPI | Fórmula (legible) | Origen |
|---|---|---|
| Total certificado base | 0 hoy (pendiente cierre ingresos → vendrá de `Cert_*`). | Cert_* |
| Total CAC | 0 hoy (ídem). | Cert_* |
| Total cobrado | `−Σ MontoReal donde TipoMov=INGRESO`. | movimientos |
| Presupuesto de venta total | `0_CONFIG` "Precio de venta total" (B18). | 0_CONFIG |
| Saldo a certificar | `Precio venta total − Total certificado base`. | — |
| Costo controlable presupuestado | Total C de sección 1 (ex `3_Control_Ppto!C36`). | sección 1 |
| Gasto acum. descontado | Total E de sección 1 (ex `3_Control_Ppto!E36`). | sección 1 |

---

## 5. TRACKING DE SUBCONTRATOS  (cols calculadas que se eliminan de `2_Subcontratos`)
El maestro queda como fuente (Contrato#, Proveedor, Rubro, Descripción, Monto
Presup., Ajusta CAC, % Anticipo, Monto Anticipo). El motor recalcula:

| Col elim. | KPI | Fórmula (legible) |
|---|---|---|
| Pagado sin CAC (I) | `Σ MontoReal de 2_Movimientos donde Observaciones contiene "{ID} AVANCE" o "{ID} QUINCENA"`. |
| Saldo Disponible (J) | `Monto Presup. − Pagado sin CAC`. |
| CAC Pagado (K) | `Σ MontoReal donde Observaciones contiene "{ID} CAC"`. |
| Cargas Sociales (O) | `Σ MontoReal donde Observaciones contiene "{ID} CARGAS SOCIALES"`. |
| Total Pagado (L) | `Pagado sin CAC + CAC Pagado + Cargas Sociales`. |
| Alerta (M) / Desvío (N) | alerta si Saldo Disponible cercano a 0 con tarea no terminada. |

**Matriz de descuento de saldo:** AVANCE y QUINCENA descuentan saldo del SC;
CAC y CARGAS SOCIALES suman gasto al rubro pero NO descuentan saldo.

---

## Claves de cruce (para que el dashboard una bien las tablas)
- **Rubro:** string exacto del plan de cuentas de Tezamat. Mismo string en
  `1_Presupuesto`, `2_Movimientos` (Desc Cuenta), `2_Quincenas`, `1_Composicion`.
  Sufijo ` MT`/` MO` distingue material de mano de obra.
- **ID de subcontrato:** formato `OBRA-SC-NNN` (ej. `CH-SC-001`) embebido en
  Observaciones con tipo: `... AVANCE | CAC | QUINCENA | CARGAS SOCIALES`.
- **Mes:** primer día del mes de la Fecha de Asiento.
- **Categoría MO:** ESPECIALIZADO / OFICIAL / MEDIO OFICIAL / AYUDANTE.
