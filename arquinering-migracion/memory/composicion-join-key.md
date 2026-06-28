---
name: composicion-join-key
description: Cómo se une 1_Composicion con 1_Presupuesto (clave de join tarea↔composición APU) y la divergencia GDR↔CH
metadata:
  type: project
---

Para unir cada tarea de `1_Presupuesto` (identificada por `Cod. Ítem` en col F, ej `1.02`)
con su composición de insumos en `1_Composicion`:

- **CH** (`CH_2171_Resumen_de_Obra_v8`): la clave vive en `1_Composicion` **columna R**
  (header dice `"en PPTO?"` pero el contenido son los códigos de ítem `1.02`, `14.03`…).
  Relación **1:1** (164 partidas ↔ 164 ítems), cobertura ~95% (164/173; los 9 sin comp son
  ítems cotizados directo tipo `PTO-xxxx`: Limpieza, Ascensores, Demolición…). Reconcilia con
  el costo de `1_Presupuesto` (cols K=MT, L=MO/OTR, M=MO/ALB, N=EQ): el 1.02 cierra al centavo;
  global 157/164 ítems con Δ<$1 por unidad.
- **GDR** (`GDR_3760_Resumen_de_Obra_v8`): **desde 2026-06-14 también tiene el link** — Pedro
  pobló col R con los códigos de ítem (986 celdas, 162 partidas 1:1, cobertura 162/191).
  Antes la col R era un booleano `"en PPTO?"` (NO/SI). Sincronizado en ambas ubicaciones
  (`dashboard/data/` y `archivos/referencia/`, master); backup viejo en
  `archivos/referencia/_bak_GDR_pre_composicion_link.xlsx`. La metodología ya sirve para AMBAS obras.

✅ (2026-06-14) El header se renombró `"en PPTO?"` → **`Cod_Item_Ppto`** en ambas obras. Aun así
**no anclar por header**: detección por contenido (ver abajo); el nombre puede variar entre versiones.

⚠️ El header viejo `"en PPTO?"` NO describía el contenido (son códigos de ítem) → **no anclar por
header**. Detección robusta = elegir la columna de `1_Composicion` cuyos valores intersecan el set
de códigos de ítem **dotted** (`N.NN`) de `1_Presupuesto` col F (filtrar enteros de grupo de rubro
`1,2,…` que dan falsos positivos). Si ninguna columna matchea → la obra no soporta la feature
(degradar en silencio).

✅ FEATURE IMPLEMENTADA (2026-06-14): deep-dive de rubro → cada tarea desplegable a su composición
de insumos. Backend `reader/drilldown.py` (`_composicion_por_item` + attach en `rubro_detail`,
inline en el payload, sin endpoint nuevo); frontend `web/js/obra.js` (`tareaCell` + `dataTable`
con `children`/`childCols`, chip ámbar `.compd` si no reconcilia, hint `.compn` "cotizado directo").
Validado en ambas obras por el endpoint (CH Hormigón/MT 21/21, GDR 19/19; pocos Δ reales).

✅ Conversión A YA EJECUTADA por Pedro: **ambas obras guardan POR UNIDAD** (GDR 1.02: K=25000,
O=288866 per-ud; antes K=75000/O=866599 total). `Costo_ud`=O, `Costo_total`=O×cant consistentes,
recalc 0 errores. `_calibrar_cant` resuelve `usa_cant=True` para las dos.

✅ (2026-06-14) Estandarización aditiva en `1_Presupuesto` de ambas obras: columnas-fórmula
**`Costo_ud`** (por unidad) y **`Costo_total`** (= ud×cant) con header IDÉNTICO, appendeadas al
final (GDR cols AQ/AR, CH AO/AP — distintas letras, mismo nombre → leer por header name).
GDR: `Costo_ud=O/Cant`, `Costo_total=O`. CH: `Costo_ud=O`, `Costo_total=O*Cant`. Verificado: 1.02
GDR ud 288.866/total 866.599; CH ud 311.234/total 1.244.936. Procesos cross-obra leen `Costo_ud`/
`Costo_total` sin branching. Hecho con `scripts/estandarizar_v8.py` + [[excel-recalc-workflow]].
La conversión PROFUNDA de GDR (reescribir K:N a per-unidad + cadena Acum) quedó para sesión aparte.

**Reconciliación (regla):** costo/ud = Σ MAT.Costo + Σ MO/OTR.Costo + Σ MO/ALB.Costo÷`Rend.Part.`(N)
+ Σ EQ.Costo÷`Rend.Part.`. Luego × `Cant. Ej. Part.`(col P = cant a ejecutar = `1_Presupuesto` col J)
= total de la tarea. Atajos del sheet: col O `Cant MO/ALB Unit` = Cant/Rend; col Q `Cant MO/ALB
Total` = O×P (jornales internos totales). MAT-CONS (Consumibles) tiene precio=1.

El bridge `APU Link` del `PPTO_GENERADOR` (en los APU_Unificado) NO sirve: GDR linkea 19/187,
CH 0/204. La clave buena es la col R del Resumen, no el APU. Ver [[dashboard-composicion-feature]].
