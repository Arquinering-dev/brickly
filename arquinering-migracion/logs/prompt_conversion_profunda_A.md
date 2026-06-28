# PROMPT — Conversión profunda A: estandarizar costos de `1_Presupuesto` a POR-UNIDAD (GDR)

> Pegar este prompt como objetivo de una sesión DEDICADA. Es un cambio estructural sobre la
> referencia maestra (GDR). Ejecutar con backup + checkpoints + verificación de preservación de
> valores. NO mezclar con otras tareas.

## 0. Contexto
Los dos Resúmenes v8 guardan los costos de `1_Presupuesto` (cols K=MT, L=MO/OTR, M=MO/ALB, N=EQ)
de forma distinta:
- **CH**: POR UNIDAD (el total se obtiene ×Cant aguas abajo). Es la forma APU-nativa y formula-pure.
- **GDR**: TOTALES (los valores ya tienen el ×Cant horneado).

Objetivo: **convertir GDR a POR-UNIDAD** para que K/L/M/N signifiquen lo mismo en ambas obras y
los procesos cross-obra no tengan que ramificar. Ya existe (sesión 2026-06-14) la estandarización
aditiva `Costo_ud`/`Costo_total` y la columna `Cod_Item_Ppto`; esta conversión va un paso más:
normaliza el ALMACENAMIENTO base, no solo columnas derivadas.

## 1. Alcance (qué SÍ / qué NO)
**SÍ:**
- `1_Presupuesto` GDR: K/L/M/N pasan de total → por-unidad (dividir por Cant).
- Reajustar las fórmulas que CONSUMEN esos costos como TOTAL, insertando ×Cant en el punto de
  consumo, de modo que **todos los valores calculados queden idénticos a hoy** (value-preserving).
- Actualizar los agregadores que asumen "totales en GDR":
  - `0_CONFIG!B18/B19/B20` (costo controlable / venta / sanity).
  - `3_Control_Ppto` columna Presupuestado (D) — SUMIFS sin ×cant → SUMPRODUCT con ×Cant.
  - Columnas Acum/Imp dentro de `1_Presupuesto` que hoy son totales (X/Z/AG/AI/AK..AO).
  - `Costo_ud`/`Costo_total` de GDR pasan a las MISMAS fórmulas que CH (`=O` / `=O*Cant`).

**NO (fuera de alcance):**
- NO unificar el LAYOUT de columnas celda-por-celda entre GDR y CH (GDR conserva su orden de
  columnas X/Y/Z/Acum; CH el suyo). El reader del dashboard abstrae el layout por anclaje de texto,
  así que no hace falta y sería mucho más invasivo.
- NO tocar CH (ya está en por-unidad).
- NO cambiar ningún número de salida (es un refactor de forma, no de negocio).

## 2. Estado actual verificado (fórmulas reales, para usar de referencia)
**GDR `1_Presupuesto` (header fila 3, datos 5..227):** K/L/M/N = VALORES (totales). Cadena:
`O=SUM(K:N)` · `P=O*$P$2` · `R..U=K..N*$P$2` · `V=SUM(R:U)` · `X=R` · `Y=Z-X` · `Z=V` ·
`AG=AC*Z` · `AI=AE*Z` · `AK=AE*X` · `AL=AE*S` · `AM=AE*T` · `AN=AE*U` · `AO=AK+AL+AM+AN`.

**GDR `0_CONFIG`:**
- `B18 (Costo total presupuestado) =SUM('1_Presupuesto'!K5:K227)+SUM(L5:L227)+SUM(M5:M227)`
- `B19 (Precio de venta total)     =SUM('1_Presupuesto'!O5:O227)*B14`
- `B20 (Sanity Check P. Costo)     =SUM('1_Presupuesto'!P5:P227)-B19`

**GDR `3_Control_Ppto` (header fila 3; col D = Presupuestado):**
- `D4 =IF($B4="MT",SUMIFS('1_Presupuesto'!$K:$K,'1_Presupuesto'!$A:$A,$A4),IF($B4="MO",SUMIFS('1_Presupuesto'!$L:$L,'1_Presupuesto'!$C:$C,$A4)+SUMIFS('1_Presupuesto'!$M:$M,'1_Presupuesto'!$D:$D,$A4),0))`

**CH = forma destino (replicar el patrón ×J):**
- `0_CONFIG!B16 =SUMPRODUCT(('1_Presupuesto'!$K$4:$K$212+$L$4:$L$212+$M$4:$M$212)*'1_Presupuesto'!$J$4:$J$212)`
- `0_CONFIG!B17 =SUMPRODUCT('1_Presupuesto'!$O$4:$O$212*'1_Presupuesto'!$J$4:$J$212)`
- CH `3_Control_Ppto` col C (Presupuestado) usa SUMPRODUCT con ×J (no SUMIFS).

## 3. Cambios a ejecutar (GDR)
### 3.1 `1_Presupuesto`
1. **K/L/M/N**: para cada fila de tarea con `Cant>0`, nuevo valor = `valor_actual / Cant`.
   (Filas con Cant=0 ya tienen 0; dejar igual.) Guardar máxima precisión (no redondear).
2. **Cadena derivada**: `O,P,R,S,T,U,V` quedan igual (pasan a per-unidad solos). Reajustar a TOTAL
   donde hoy se consumen como total, insertando `*$J{row}`:
   - `Z = =+V{r}*J{r}`   (subtotal venta total)  [antes `=+V`]
   - `X = =+R{r}*J{r}`   (MT venta total)         [antes `=+R`]
   - `Y = =+Z{r}-X{r}`   (sin cambio)
   - `AL = =AE{r}*S{r}*J{r}` · `AM = =AE{r}*T{r}*J{r}` · `AN = =AE{r}*U{r}*J{r}`  [insertar *J]
   - `AK = =AE{r}*X{r}` (X ya es total) · `AG = =AC{r}*Z{r}` · `AI = =AE{r}*Z{r}` (Z ya total) — sin cambio
   - `AO = =AK+AL+AM+AN` (sin cambio)
   > Criterio guía: cualquier celda que hoy representa un TOTAL debe seguir dando el mismo total.
   > La verificación de §5 es la red de seguridad: si una celda difiere, falta un ×J.
3. **`Costo_ud` / `Costo_total`** (cols AQ/AR): pasar a la forma de CH → `Costo_ud = =+O{r}`,
   `Costo_total = =+O{r}*J{r}`.

### 3.2 `0_CONFIG`
- `B18 = =SUMPRODUCT(('1_Presupuesto'!$K$5:$K$227+$L$5:$L$227+$M$5:$M$227)*'1_Presupuesto'!$J$5:$J$227)`
- `B19 = =SUMPRODUCT('1_Presupuesto'!$O$5:$O$227*'1_Presupuesto'!$J$5:$J$227)*B14`
- `B20 = =SUMPRODUCT('1_Presupuesto'!$P$5:$P$227*'1_Presupuesto'!$J$5:$J$227)-B19`
  (P pasa a per-unidad → la venta total es SUMPRODUCT(P*J).)

### 3.3 `3_Control_Ppto`
- Columna Presupuestado (D), todas las filas de rubro: cambiar los `SUMIFS(K..)` por SUMPRODUCT con ×Cant:
  `=IF($B{r}="MT",SUMPRODUCT(('1_Presupuesto'!$A$5:$A$227=$A{r})*'1_Presupuesto'!$K$5:$K$227*'1_Presupuesto'!$J$5:$J$227),IF($B{r}="MO",SUMPRODUCT(('1_Presupuesto'!$C$5:$C$227=$A{r})*'1_Presupuesto'!$L$5:$L$227*'1_Presupuesto'!$J$5:$J$227)+SUMPRODUCT(('1_Presupuesto'!$D$5:$D$227=$A{r})*'1_Presupuesto'!$M$5:$M$227*'1_Presupuesto'!$J$5:$J$227),0))`
- Revisar la col Q (% Avance s/cert) y cualquier otra que use rangos de costo de `1_Presupuesto`:
  si usa AK/R (ratios), el ratio es adimensional y no cambia; **confirmarlo con la verificación**.

## 4. Impacto en el DASHBOARD y cómo NO romperlo
La conversión es **value-preserving**, así que si se respeta §5 el dashboard NO necesita cambios de
código. Puntos a tener presentes:
- `reader/drilldown.py::_presupuesto_tareas` (deep-dive de rubro) lee K/L/M y **auto-calibra ×cant**
  contra el total de Control (`_calibrar_cant`). Tras la conversión, GDR pasa de `usa_cant=False` a
  `usa_cant=True` automáticamente. Sigue funcionando sin tocar código. ✔
- `reader/drilldown.py::etapa_detail` lee de `1_Presupuesto` el PV (subtotal) y el Imp. Acum. Total
  (certificado): **deben seguir siendo TOTALES**. El reajuste de §3.1 (Z=V*J, Imp/Acum totales) lo
  garantiza. ✔
- `reader/read_obra.py` lee el presupuesto **vía `3_Control_Ppto`** (no directo). Si §3.3 preserva
  los valores de Presupuestado/Acum, el dashboard ve números idénticos. ✔
- **Doc a actualizar en el reader**: el hallazgo en `dashboard/CLAUDE.md` ("columnas de costo por
  unidad en CH y total en GDR") pasa a "**ambas por unidad**". La auto-calibración `_calibrar_cant`
  puede quedarse (es robusta a ambos casos); opcional simplificarla más adelante.

## 5. Workflow de ejecución y verificación (OBLIGATORIO)
1. **Backup** de GDR (`dashboard/data` y `archivos/referencia`) → `_bak_GDR_pre_conversionA.xlsx`.
2. Guardar los **valores cacheados actuales** de GDR (snapshot) de TODAS las hojas calculadas
   (`1_Presupuesto`, `3_Control_Ppto`, `0_CONFIG`, `2_Certificaciones`, `3_Cash_Flow`, etc.) para
   diff posterior.
3. Editar con openpyxl (append-only donde aplique; nunca insert/delete_rows).
4. `python scripts/excel_recalc.py <GDR>` (recalcula y repuebla valores cacheados; ver
   [memoria excel-recalc-workflow]).
5. **Verificación de preservación de valores (red de seguridad):** comparar celda-por-celda el
   snapshot pre vs post en todas las hojas calculadas. **Criterio de aceptación: |Δ| < $0,01 en cada
   celda de total/agregado.** Cualquier celda con Δ≠0 indica un ×J faltante → corregir y repetir.
   (Las celdas K/L/M/N de `1_Presupuesto` SÍ cambian de valor —de total a unitario— y están
   excluidas de este diff; todo lo demás NO debe cambiar.)
6. `python scripts/recalc.py <GDR>` → **0 errores de fórmula**.
7. **Sanity checks embebidos** de `3_Control_Ppto` (Δ Ppto Rubros, directos, indirectos, etapas,
   costo sin rubro) deben seguir dando 0 / ✓.
8. **Smoke test del dashboard**: levantar Flask y comparar el JSON de `/api/obras/GDR` (KPIs,
   control_ppto, avance_etapa) + los deep-dives de rubro y etapa contra los de antes: idénticos.
9. **Sincronizar** copias (`dashboard/data` ↔ `archivos/referencia`) y verificar hashes.

## 6. Documentación a actualizar (parte del entregable)
- `docs/Playbook_Migracion_v1.1.md`: el paso de costeo del presupuesto ahora produce K/L/M/N **por
  unidad** (no totales); el total es derivado (`Costo_total`/Subtotal). Estándar único para todas
  las obras.
- `docs/Manual_Uso_v8.md`: aclarar que `Costo_ud` es por unidad y `Costo_total`=ud×cant; que el
  control y el CONFIG agregan con ×Cant (SUMPRODUCT).
- `CLAUDE.md` (raíz) §11: nueva fila de decisión "Costos de `1_Presupuesto` estandarizados a
  por-unidad en todas las obras (GDR convertido); totales son derivados (formula-pure)".
- `dashboard/CLAUDE.md`: actualizar el hallazgo de datos (ya no hay divergencia total/unidad).
- Memorias: actualizar `composicion-join-key` (quitar el caveat de divergencia ×cant) y, si
  corresponde, cerrar el pendiente.

## 7. Riesgos y rollback
- Riesgo principal: olvidar un ×J en alguna fórmula de total → lo detecta la verificación §5.
- Si algo no cierra: restaurar `_bak_GDR_pre_conversionA.xlsx` y reintentar.
- GDR es la referencia maestra: no avanzar a sincronizar copias hasta que §5–§8 estén en verde.
