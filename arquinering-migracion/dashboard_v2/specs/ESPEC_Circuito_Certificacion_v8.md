# Especificación de cambios — Circuito de Certificación sobre Resumen de Obra v8

> Documento de ejecución para Claude Code. Autosuficiente: implementá a partir de lo que está acá, sin asumir contexto previo de ninguna conversación.

---

## 1. Contexto mínimo necesario

### Archivo a modificar

- **Archivo base:** `CH_2171_Resumen_de_Obra_v8_1.xlsx` (el Resumen de Obra v8 de la obra Chivilcoy 2171).
- **Trabajar SOBRE UNA COPIA.** Primer paso del protocolo: copiar el archivo a `CH_2171_Resumen_de_Obra_v8_2.xlsx` (o el siguiente número de versión disponible) y aplicar **todos** los cambios sobre la copia. El v8_1 queda como backup intacto.
- Ubicación esperada: la carpeta del proyecto donde vive el resumen de obra.

### Qué es el Resumen de Obra v8

Modelo Excel formula-pure de control de obra para un proyecto de construcción bajo fideicomiso. Tiene 18 hojas con prefijos por capa: `0_` parámetros/tablas maestras, `1_` presupuesto y composición, `2_` datos transaccionales (gastos, quincenas, subcontratos, certificaciones), `3_` vistas finales (dashboard, control presupuestario, cash flow). El dato fluye desde las hojas fuente hacia las vistas mediante el patrón staging + SUMIFS.

Este trabajo agrega un **circuito de certificación nuevo**: una app móvil (AppSheet) le permite al Jefe de Obra registrar el avance físico por tarea; ese avance viaja a una hoja de staging (`Cert_App_Output`), desde donde se calcula la certificación (montos, desacopio, CAC, blanco/negro, IVA, MEP) y se registran las facturas y cobros. El circuito se apoya en dos hojas existentes (`1_Presupuesto` para los precios de venta, `0_Indice_CAC` para el índice) y reemplaza el mecanismo manual de avance que hoy vive en `1_Presupuesto`.

### Convenciones del archivo — RESPETAR SÍ O SÍ

- **Formula-pure:** todo cálculo es una fórmula de Excel. No macros, no VBA, no valores calculados en Python y pegados. Si un número se puede derivar, va como fórmula.
- **Patrón staging + SUMIFS:** los datos transaccionales se cargan en una hoja fuente (fila por registro) y las vistas los agregan con `SUMIFS`/`SUMPRODUCT`. No se hacen referencias celda-a-celda frágiles cuando corresponde una agregación.
- **Color coding de celdas** (por color de fuente, salvo el amarillo que es relleno):
  - Azul `#0000FF` → input manual (lo que un humano tipea).
  - Verde `#00B050` → referencia a otra hoja del mismo libro.
  - Negro `#000000` → cálculo/fórmula interna de la hoja.
  - Gris `#808080` → valor estático / congelado.
  - Relleno amarillo `#FFFF00` → celda de atención / pendiente / control.
- **Nomenclatura de rubros:** Title Case con tildes (ej. `Hormigón`, `Albañilería`, `Instalación Eléctrica`). Las categorías de mano de obra van en UPPERCASE (ej. `OFICIAL`, `AYUDANTE`). Los tipos de costo son `MT`, `MO`, `EQ`.
- **Compatibilidad Excel 2016+:** `XLOOKUP` está disponible y es preferido. Evitar funciones de versiones posteriores no soportadas (ej. `LAMBDA`, `LET` no garantizados). `SUMIFS`, `SUMPRODUCT`, `IFERROR` son seguros.
- **Recálculo:** después de cada bloque de cambios, recalcular con `scripts/recalc.py <archivo>` y verificar 0 errores de fórmula.

### Estructura relevante de hojas existentes (verificada)

**`1_Presupuesto`** (datos en filas 5–211; fila 4, 14, 19… son encabezados de sección SIN código; fila 212 = `SUB TOTAL OBRA`):
- Col `A` = Rubro MT, `C` = Rubro MO/OTR, `D` = Rubro MO/ALB (se usan para apertura por componente).
- Col `F` = Cód. Ítem (ej. `3.10`). **Solo las filas con F no vacío son tareas reales.**
- Col `H` = Descripción, `J` = Cant, `V` = `Tot PV/ud` (PV unitario), `X` = `PV subtotal` (= `V*J`, precio de venta total de la tarea ejecutada al 100%).
- Col `R` = MT_vta, `S` = MO_OTR_vta, `T` = MO_ALB_vta, `U` = EQ_vta (componentes del PV unitario).
- **Tramo de certificación (el que se modifica):** `AA` = % Acum Ant, `AB` = % Cert Act, `AC` = % Acum Tot, `AE` = Acum_ant $, `AF` = Cert_act $, `AG` = Acum_tot $, `AI` = AcumMT, `AJ` = AcumMO_OTR, `AK` = AcumMO_ALB, `AL` = AcumEQ, `AM` = AcumTot.

**`0_Indice_CAC`** (tabla de índices INDEC):
- Col `A` = Mes (fecha, primer día de mes, ej. `2025-06-01`), `B` = Valor INDEC, `D` = Ratio deflactación (`=$B$5/Bn`, factor para **traer a base**; OJO: es el inverso del ratio actualizador que necesitamos).
- Fila 5 = jun-2025 (índice base del proyecto, valor `16643.40`). Datos desde fila 4.

**`3_Control_Ppto`** (vista que consume el avance):
- Col `O` = `% Avance certif.` por rubro. Es una `ArrayFormula` (`SUMPRODUCT`) que lee `1_Presupuesto!$AI$4:$AI$212` (MT), `$AJ$` y `$AK$` (MO), divididos por `$R$×$J$` / (`$S$×$J$`+`$T$×$J$`). **Este es el único consumidor aguas abajo del tramo de avance de `1_Presupuesto`, y solo usa AI/AJ/AK.**

**`2_Certificaciones`** (hoja vieja, NO se toca):
- Sistema de certificación anterior, manual, con base y %CAC pegados. La consumen `3_Cash_Flow` y `3_Dashboard`. **No modificar, no eliminar, no reconectar.** El circuito nuevo NO la usa. (Ver §3, riesgo de confusión.)

---

## 2. Lista ordenada de cambios

> Orden de ejecución por dependencias: primero las hojas fuente nuevas (B1, B2), luego la hoja de cálculo que las consume (B3), luego facturación (B4), y al final el reenganche de `1_Presupuesto` (B5), que depende de que B2 exista. Ejecutar **un bloque por vez**, guardar, recalcular, verificar, y recién entonces pasar al siguiente.

---

### BLOQUE B1 — Hoja nueva `Cert_OC_Cliente`

**Qué cambia y por qué.** Crea la hoja de condiciones contractuales de cada Orden de Compra a cliente (OC). Es la fuente de los parámetros que la certificación usa como default (anticipo, blanco/negro, IVA) y del índice CAC base. Una fila por OC.

**Hojas y rangos afectados.** Hoja nueva `Cert_OC_Cliente`. Encabezados en fila 1, datos desde fila 2.

**Especificación técnica.** Columnas (encabezado → contenido, tipo de color):

| Col | Encabezado | Contenido | Color |
|---|---|---|---|
| A | Obra | input (ej. `CH 2171`) | azul |
| B | ID OC | input (ej. `CH-OC01`) | azul |
| C | Descripción | input (ej. `Pto 1 - Preliminares y estructura`) | azul |
| D | Presupuesto aprobado | input (ej. `250000000`) | azul |
| E | % anticipo | input (ej. `0.10`) | azul |
| F | Mes base CAC | input fecha (ej. `2025-06-01`) | azul |
| G | Índice base CAC | `=XLOOKUP(F2,'0_Indice_CAC'!$A:$A,'0_Indice_CAC'!$B:$B)` | verde |
| H | % Blanco sugerido | input (ej. `0.65`) | azul |
| I | % Negro sugerido | input (ej. `0.35`) | azul |
| J | % desacopio sugerido | input (ej. `0.10`) | azul |
| K | % IVA sugerido | input (ej. `0.21`) | azul |

Datos de ejemplo a cargar (1 fila):
`CH 2171 | CH-OC01 | Pto 1 - Preliminares y estructura | 250000000 | 0.10 | 2025-06-01 | =XLOOKUP(...) | 0.65 | 0.35 | 0.10 | 0.21`

Formato: D como moneda `$#,##0`; E/H/I/J/K como `0.0%`; F como fecha `mmm-yyyy`; G número `#,##0.00`.

**Dependencias.** Ninguna previa. Debe existir antes de B3 (B3 lee G por lookup).

**Criterio de verificación.** `G2` debe dar `16643.40` (el índice de jun-2025). `recalc.py` sin errores en la hoja.

---

### BLOQUE B2 — Hoja nueva `Cert_App_Output`

**Qué cambia y por qué.** Crea la hoja de staging que simula el output de la app del Jefe de Obra: el avance físico por tarea, por certificación. Es la **fuente única de verdad del avance físico**. Las columnas A–G son lo que genera la app; H–J son apoyo de cálculo (traen el PV del presupuesto, que el JO no ve). Cargar datos de ejemplo simulando 3 certificaciones ya confirmadas.

**Hojas y rangos afectados.** Hoja nueva `Cert_App_Output`. Encabezados fila 1, datos desde fila 2.

**Especificación técnica.** Columnas:

| Col | Encabezado | Contenido | Color |
|---|---|---|---|
| A | Obra | input/viaja de app | azul |
| B | ID OC | input/viaja de app | azul |
| C | ID Certif | input/viaja de app (ej. `CH-OC01-C01`) | azul |
| D | Fecha | input fecha | azul |
| E | Cod. tarea | input (ej. `3.10`) — matchea `1_Presupuesto!F` | azul |
| F | % anterior | input | azul |
| G | % actual | input | azul |
| H | % total | `=F2+G2` | negro |
| I | PV total tarea | `=XLOOKUP(E2,'1_Presupuesto'!$F:$F,'1_Presupuesto'!$X:$X)` | verde |
| J | $ base tarea (cert act.) | `=G2*I2` | negro |

> **Nota sobre `E` (Cod. tarea):** los códigos en `1_Presupuesto!F` se guardan como están (algunos como texto, ej. `3.1` representa la tarea "3.10"). Para el ejemplo usar exactamente los códigos tal como aparecen en `1_Presupuesto!F`. Verificar el tipo de dato: si en el presupuesto el código es número, el XLOOKUP debe matchear número; si es texto, texto. **Antes de cargar, leer 3-4 códigos reales de `1_Presupuesto!F` y replicar su tipo exacto.** (Ver §3, riesgo de tipo de dato en la clave de lookup.)

**Datos de ejemplo a cargar — 3 certificaciones × 7 tareas de estructura = 21 filas.**

Tareas (col E) y su PV total real (col I, que la fórmula traerá sola — listado solo como referencia de verificación):
`3.02`=65.949.869 · `3.10`=44.523.554 · `3.11`=34.705.655 · `3.14`=62.186.548 · `3.15`=114.346.363 · `3.16`=12.261.158 · `3.17`=14.944.686.

% actual (col G) por tarea y certificación (inventados):

| Cod. tarea (E) | C01 (G) | C02 (G) | C03 (G) |
|---|---|---|---|
| 3.02 | 0.40 | 0.35 | 0.25 |
| 3.10 | 0.20 | 0.25 | 0.30 |
| 3.11 | 0.15 | 0.20 | 0.25 |
| 3.14 | 0.10 | 0.20 | 0.25 |
| 3.15 | 0.05 | 0.15 | 0.20 |
| 3.16 | 0.00 | 0.10 | 0.20 |
| 3.17 | 0.00 | 0.00 | 0.30 |

Columna `% anterior` (F) de cada fila: para C01 = 0 en todas; para C02 = el % actual de C01 de esa tarea; para C03 = suma de % actual de C01+C02 de esa tarea. (Así `% total` = acumulado coherente.) Las filas con `% actual` = 0 se pueden cargar igual (avance 0 en esa cert) o omitir; preferir cargarlas para que el ejemplo sea completo.

Metadatos por certificación:
- C01: ID Certif `CH-OC01-C01`, Fecha `2026-01-15`.
- C02: ID Certif `CH-OC01-C02`, Fecha `2026-03-15`.
- C03: ID Certif `CH-OC01-C03`, Fecha `2026-05-15`.
- Todas: Obra `CH 2171`, ID OC `CH-OC01`.

**Control cruzado (en esta misma hoja, col L):** verificación de que el acumulado por tarea cierra contra el presupuesto. Encabezado `L1` = "Control vs Ppto". Esta validación se completa conceptualmente en B5 (cuando `1_Presupuesto.AC` pase a leer de acá). Por ahora dejar la columna preparada con encabezado; la fórmula concreta se agrega en B5.

**Dependencias.** Debe existir antes de B3 y B5 (ambos leen de esta hoja). Lee de `1_Presupuesto` (ya existe).

**Criterio de verificación.** Suma de col J filtrada por `C='CH-OC01-C01'` debe dar ≈ **52.426.480**. Para C02 ≈ **71.969.854**. Para C03 ≈ **83.872.494**. (Son los $ base de cada certificación.) `recalc.py` sin errores.

---

### BLOQUE B3 — Hoja nueva `Cert_Calculo`

**Qué cambia y por qué.** El corazón del circuito: la cascada de cálculo de cada certificación, **2 filas por certificación (Blanco + Negro)**. Cruza el avance (B2) con las condiciones de la OC (B1), el presupuesto (PV ya viene en B2) y el índice CAC (`0_Indice_CAC`). Los porcentajes de facturación, desacopio e IVA son **input manual por fila** (la OC solo da el default sugerido), porque cada certificación puede repartir distinto.

**Hojas y rangos afectados.** Hoja nueva `Cert_Calculo`. Encabezados fila 1, datos desde fila 2. 3 certificaciones × 2 filas = 6 filas de datos.

**Especificación técnica.** Columnas:

| Col | Encabezado | Contenido | Color |
|---|---|---|---|
| A | ID Certif | input (ej. `CH-OC01-C01`) | azul |
| B | ID Cert+Fact | input (ej. `CH-OC01-C01-B` / `-N`) | azul |
| C | Tipo | input (`Blanco` / `Negro`) | azul |
| D | Obra | `=XLOOKUP(A2,'Cert_App_Output'!$C:$C,'Cert_App_Output'!$A:$A)` | verde |
| E | ID OC | `=XLOOKUP(A2,'Cert_App_Output'!$C:$C,'Cert_App_Output'!$B:$B)` | verde |
| F | Fecha | `=XLOOKUP(A2,'Cert_App_Output'!$C:$C,'Cert_App_Output'!$D:$D)` | verde |
| G | $ base certif (total) | `=SUMIFS('Cert_App_Output'!$J:$J,'Cert_App_Output'!$C:$C,$A2)` | verde |
| H | % facturación | **input** (ej. `0.65` en fila Blanco, `0.35` en Negro) | azul |
| I | $ base de esta parte | `=$G2*H2` | negro |
| J | % desacopio | **input** (ej. `0.10`) | azul |
| K | $ desacopio | `=-I2*J2` | negro |
| L | $ base neta | `=I2+K2` | negro |
| M | Índice base CAC | `=XLOOKUP($E2,'Cert_OC_Cliente'!$B:$B,'Cert_OC_Cliente'!$G:$G)` | verde |
| N | Índice CAC a la fecha | `=XLOOKUP(DATE(YEAR(F2),MONTH(F2),1),'0_Indice_CAC'!$A:$A,'0_Indice_CAC'!$B:$B)` | verde |
| O | Ratio CAC | `=N2/M2` | negro |
| P | $ CAC | `=L2*(O2-1)` | negro |
| Q | $ base + CAC | `=L2+P2` | negro |
| R | % IVA | **input** (ej. `0.21` Blanco, `0` Negro) | azul |
| S | $ IVA | `=Q2*R2` | negro |
| T | $ Total certificación | `=Q2+S2` | negro |
| U | USD MEP a la fecha | **input** (inventar, ver abajo) | azul |
| V | U$ Total | `=IF(C2="Negro",T2/U2,"")` | negro |
| X | Control B/N suma 100% | (ver abajo) | negro + relleno amarillo si ⚠ |

**Columna X — control cruzado B/N (en esta hoja, como se pidió):**
`=IF(ABS(SUMIFS($H:$H,$A:$A,$A2)-1)<0.0001,"✓","⚠ ≠100%")`
Verifica que, para cada ID Certif, los `% facturación` de sus filas (Blanco+Negro) sumen 100%. Aplicar relleno amarillo condicional o dejar el texto ⚠ visible.

**Ratio CAC — nota crítica.** El ratio que se necesita es **actualizador** = índice del mes de la cert / índice base = `N/M` (resulta > 1 cuando los precios subieron). NO usar la columna D de `0_Indice_CAC`, que es el ratio **deflactor** (`base/mes`, el inverso). Por eso O se calcula como `N2/M2` con lookups directos a la columna B (valor INDEC), no a la D.

**Datos de ejemplo — 6 filas:**

| A (ID Certif) | B (ID Cert+Fact) | C (Tipo) | H (% fact) | J (% desac) | R (% IVA) | U (MEP) |
|---|---|---|---|---|---|---|
| CH-OC01-C01 | CH-OC01-C01-B | Blanco | 0.65 | 0.10 | 0.21 | 1175 |
| CH-OC01-C01 | CH-OC01-C01-N | Negro | 0.35 | 0.10 | 0 | 1175 |
| CH-OC01-C02 | CH-OC01-C02-B | Blanco | 0.70 | 0.10 | 0.21 | 1235 |
| CH-OC01-C02 | CH-OC01-C02-N | Negro | 0.30 | 0.10 | 0 | 1235 |
| CH-OC01-C03 | CH-OC01-C03-B | Blanco | 0.60 | 0.10 | 0.21 | 1290 |
| CH-OC01-C03 | CH-OC01-C03-N | Negro | 0.40 | 0.10 | 0 | 1290 |

(C02 reparte 70/30 y C03 60/40 a propósito, para demostrar que el % es editable por cert.)

Formato: montos `$#,##0`; porcentajes `0.0%`; ratio `0.0000`; MEP `$#,##0`; USD `US$ #,##0`.

**Dependencias.** Requiere B1 (lee OC.G por E) y B2 (lee App_Output por A). Ejecutar después de ambos.

**Criterio de verificación.**
- `G2` (base C01, cualquier fila) ≈ 52.426.480.
- Para C01-Blanco: `I = G*0.65`, `K = -I*0.10`, `O ≈ 19209.40/16643.40 = 1.1542` (CAC ene-26), `T = Q*1.21`.
- Col X = `✓` en las 6 filas (todas suman 100% B+N).
- `V` con valor solo en filas Negro; vacío en Blanco.
- `recalc.py` sin errores.

---

### BLOQUE B4 — Hoja nueva `Cert_Facturacion`

**Qué cambia y por qué.** Registra los comprobantes (facturas/recibos) emitidos contra cada parte de certificación, con relación 1:N (una parte Blanco/Negro puede facturarse en varios comprobantes y/o parciales). También registra el cobro del anticipo como una fila tipo `Anticipo` (Forma A: el anticipo se cobra acá, y se va recuperando vía desacopio en cada certificación de B3). Incluye control de saldo facturado vs certificado.

**Hojas y rangos afectados.** Hoja nueva `Cert_Facturacion`. Encabezados fila 1, datos desde fila 2.

**Especificación técnica.** Columnas:

| Col | Encabezado | Contenido | Color |
|---|---|---|---|
| A | ID Cert+Fact | input (ata a `Cert_Calculo!B`; para anticipo, ej. `CH-OC01-ANT`) | azul |
| B | Comprobante | input (ej. `FA-B 0001`) | azul |
| C | Tipo | input (`Blanco` / `Negro` / `Anticipo`) | azul |
| D | $ Monto | input | azul |
| E | USD Monto | input | azul |
| F | Fecha cobro | input fecha (vacío si no cobrado) | azul |
| G | Retención | input | azul |
| H | Conciliado | input (`Sí` / `No`) | azul |
| I | $ certificado (control) | `=IFERROR(XLOOKUP($A2,'Cert_Calculo'!$B:$B,'Cert_Calculo'!$T:$T),0)` | verde |
| J | Saldo a facturar | `=I2-SUMIFS($D:$D,$A:$A,$A2)` | negro |

**Control en esta hoja (col J):** el saldo a facturar por cada ID Cert+Fact = lo certificado menos lo ya facturado contra esa parte. Para filas `Anticipo`, I dará 0 (no hay cert detrás) y J quedará negativo: eso es esperado (el anticipo no certifica avance). Marcar las filas Anticipo con relleno gris para distinguirlas, o dejar I/J en blanco con `IF(C2="Anticipo","",...)`.

**Datos de ejemplo (inventar, ~8-10 filas):**
- 1 fila Anticipo: `CH-OC01-ANT | REC-ANT 0001 | Anticipo | 25000000 | | 2026-01-10 | | Sí`. (10% de 250M.)
- C01: una factura Blanco (cobrada) + un recibo Negro en USD (cobrado).
- C02: dos facturas Blanco (una cobrada, una pendiente) + un recibo Negro.
- C03: una factura Blanco (pendiente) + un recibo Negro (cobrado).
Inventar números de comprobante, fechas de cobro coherentes con la fecha de cada certificación, montos que respeten (o parcialicen) el total certificado de cada parte, y estados de conciliación mezclados (algunos Sí, algunos No) para que el ejemplo sea realista.

**Dependencias.** Requiere B3 (lee Cert_Calculo.T y .B). Ejecutar último de las hojas nuevas.

**Criterio de verificación.** Para una parte totalmente facturada, `J = 0`. Para una con factura pendiente, `J > 0`. `I` trae el total certificado correcto por XLOOKUP. `recalc.py` sin errores.

---

### BLOQUE B5 — Reenganche de avance en `1_Presupuesto`

**Qué cambia y por qué.** El mecanismo viejo de avance en `1_Presupuesto` se cargaba a mano (col AA pegada). Con la metodología nueva, el avance físico vive en `Cert_App_Output`. Este bloque convierte `1_Presupuesto` de **generador** (carga manual) a **consumidor** (lee el avance de la app), eliminando la redundancia y la carga manual. Se conserva la desagregación por componente (AI/AJ/AK) que `3_Control_Ppto` necesita. Se eliminan las columnas intermedias que ya no se usan.

**Hojas y rangos afectados.** `1_Presupuesto`, columnas AA, AB, AC, AE, AF (filas 5–211, solo filas con código en col F). Las columnas AG, AI, AJ, AK, AL, AM **no se tocan** (siguen funcionando). `3_Control_Ppto` col O **no se toca** (sigue leyendo AI/AJ/AK).

**Especificación técnica.**

1. **Col AC (`% Acum Tot`)** pasa a ser la fuente del avance, leída de la app. Para cada fila de tarea (F no vacío), reemplazar la fórmula actual `=AA+AB` por:
   ```
   =SUMIFS('Cert_App_Output'!$G:$G,'Cert_App_Output'!$E:$E,$F<fila>)
   ```
   Suma todos los `% actual` informados para esa tarea en todas las certificaciones. Color verde (referencia externa).

2. **Col AA (`% Acum Ant`)** y **col AB (`% Cert Act`)**: ya no se usan como input.
   - **AA:** vaciar (eliminar el valor pegado). Dejar la celda vacía.
   - **AB:** reutilizar como **celda de control cruzado** (en esta hoja, como se pidió). Fórmula por fila de tarea:
     ```
     =IF(AC<fila>=0,"",IF(ABS(AC<fila>-XLOOKUP($F<fila>,'Cert_App_Output'!$E:$E... )) ... ))
     ```
     Como AC ya es el SUMIFS del avance de la app, el control debe comparar AC contra el `% total` que la app reporta para esa tarea. Dado que en `Cert_App_Output` hay varias filas por tarea (una por cert), el `% total` de la última cert de esa tarea = el acumulado. Implementación robusta del control: comparar `AC` (suma de % actual) contra `MAXIFS('Cert_App_Output'!H, 'Cert_App_Output'!E, F<fila>)` (el mayor % total registrado para la tarea, que corresponde a la última cert):
     ```
     =IF(AC<fila>=0,"",IF(ABS(AC<fila>-MAXIFS('Cert_App_Output'!$H:$H,'Cert_App_Output'!$E:$E,$F<fila>))<0.0001,"✓","⚠"))
     ```
     Encabezado de AB (fila 3) cambiar de `% Cert Act` a `Control`. Relleno amarillo si da ⚠.

3. **Col AC fórmula derivada AG (`Acum_tot $`)**: ya es `=AC*X`, **no cambia** (ahora AC viene de la app, AG se actualiza solo).

4. **Eliminar columnas AE (`Acum_ant $`) y AF (`Cert_act $`):** dependían de AA/AB y no las consume nadie aguas abajo (verificado: el único consumidor, `3_Control_Ppto` col O, usa AI/AJ/AK que cuelgan de AG, no de AE/AF). Eliminar el contenido de AE y AF (fórmula y encabezado) en filas 3–211.
   - **NO usar `delete_cols`** (corre las columnas y rompe las referencias absolutas de `3_Control_Ppto` a `$AI$/$AJ$/$AK$`). En su lugar: **vaciar el contenido** de AE y AF (dejar las columnas vacías en su lugar). Así AG/AI/AJ/AK mantienen su letra de columna y `3_Control_Ppto` sigue apuntando bien.

**Referencias downstream a verificar (no romper):**
- `3_Control_Ppto` col O lee `1_Presupuesto!$AI$4:$AI$212`, `$AJ$`, `$AK$`, `$R$`, `$S$`, `$T$`, `$J$`, `$A$`, `$C$`, `$D$`. Ninguna de esas columnas se mueve ni se toca. **Confirmar que O sigue dando el mismo tipo de resultado tras el cambio** (ahora alimentado por el avance de la app en vez del manual).
- `3_Dashboard` lee `1_Presupuesto` (3 refs) — verificar que no apunten a AA/AB/AE/AF. Si apuntan, reportar como checkpoint.

**Dependencias.** Requiere B2 (`Cert_App_Output` debe existir y tener datos). Ejecutar **después** de B2. Es el último bloque.

**Criterio de verificación.**
- Para la tarea `3.02` (avance acumulado 40%+35%+25% = 100%), `AC` de esa fila = `1.00`. Para `3.10` = `0.75`. Para `3.15` = `0.40`. Para `3.16` = `0.30`.
- Col AB (control) = `✓` en las tareas con avance; vacío en las tareas sin avance.
- `3_Control_Ppto` col O recalcula sin error y da % coherentes por rubro (el rubro Hormigón/estructura debería mostrar avance > 0).
- `recalc.py` sin errores en todo el archivo.

---

## 3. Riesgos y advertencias de ejecución

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | **`delete_cols`/`delete_rows`/`insert_rows` en openpyxl corrompe fórmulas downstream.** Las refs absolutas de `3_Control_Ppto` a `$AI$:$AK$` se desalinearían si se corren columnas. | **Nunca** mover columnas. En B5, eliminar AE/AF **vaciando contenido**, no borrando la columna. Para hojas nuevas, agregar filas por `append` o escritura directa a celdas, nunca insertando en medio de tablas existentes. |
| R2 | **Tipo de dato en la clave de lookup (Cod. tarea).** Si `1_Presupuesto!F` guarda los códigos como número y `Cert_App_Output!E` los carga como texto (o viceversa), todos los XLOOKUP fallan silenciosamente (devuelven #N/A o 0). | Antes de B2, leer 3-4 valores reales de `1_Presupuesto!F` y replicar exactamente su tipo (texto vs número) al cargar la col E de `Cert_App_Output`. Verificar que `I2` (PV traído) da un número, no #N/A. |
| R3 | **Ratio CAC invertido.** `0_Indice_CAC!D` es deflactor (base/mes). Usarlo daría CAC negativo o al revés. | En B3, calcular el ratio como `N/M` con lookups directos a col B (valor INDEC), nunca usar col D. Verificar que O > 1 para fechas posteriores a jun-2025. |
| R4 | **Confusión con la hoja vieja `2_Certificaciones`.** Existe un sistema de certificación anterior con nombres parecidos. Modificarlo o reconectarlo rompería `3_Cash_Flow` y `3_Dashboard`. | **No tocar `2_Certificaciones`.** El circuito nuevo usa hojas con prefijo `Cert_`. Son sistemas separados a propósito. |
| R5 | **SUMIFS sobre filas de sección.** `1_Presupuesto` tiene filas de encabezado de sección (4, 14, 19…) sin código en F. Un SUMIFS mal armado podría sumar de más. | Los SUMIFS de avance filtran por `E = código de tarea`; las filas de sección no tienen código, así que no matchean. Verificar que AC en filas de sección quede vacío o 0 (esas filas no tienen F). |
| R6 | **Columnas enteras en XLOOKUP/SUMIFS** (`$A:$A`). Funcionan pero pueden incluir encabezados. | Los encabezados son texto y no matchean claves de datos; es seguro. Si recalc marca lentitud o error, acotar rangos a filas con datos. |
| R7 | **`#N/A` por OC inexistente.** Si una cert referencia una OC que no está en `Cert_OC_Cliente`, M dará #N/A. | Para el ejemplo, todas las certs son de `CH-OC01`, que existe. En producción, envolver M en `IFERROR(...,"")` si se prefiere — pero para esta entrega dejar el lookup directo para que un error sea visible. |

**Errores pre-existentes tolerables:** si `recalc.py` reporta errores en hojas que NO son parte de estos cambios (ej. `2_Quincenas` o `2_Gastos` que están parcialmente vacías a la espera de datos), y esos errores ya existían en el v8_1 base, NO son responsabilidad de este trabajo: reportarlos pero no intentar corregirlos. La condición de éxito es **0 errores nuevos** en las hojas tocadas (`Cert_*` y `1_Presupuesto`) y que `3_Control_Ppto` col O no se haya roto.

---

## 4. Protocolo de ejecución

1. **Copiar primero.** Duplicar `CH_2171_Resumen_de_Obra_v8_1.xlsx` → `CH_2171_Resumen_de_Obra_v8_2.xlsx`. Trabajar solo sobre la copia.
2. **Incremental, un bloque por vez.** Ejecutar en este orden: **B1 → B2 → B3 → B4 → B5.** No ejecutar todo de una pasada.
3. **Por cada bloque:**
   a. Aplicar los cambios del bloque con openpyxl (preferir escritura directa a celdas; nunca `insert/delete` de filas o columnas existentes).
   b. Un único `wb.save()` al final del bloque.
   c. Correr `python scripts/recalc.py CH_2171_Resumen_de_Obra_v8_2.xlsx`.
   d. Revisar el JSON de salida. **Si hay errores nuevos en las hojas tocadas, DETENERSE y reportar** — no pasar al siguiente bloque. No intentar parches improvisados que puedan enmascarar el problema.
   e. Verificar el criterio de verificación del bloque (los valores esperados). Si un valor no coincide, DETENERSE y reportar la discrepancia con el valor obtenido vs esperado.
4. **Solo si el bloque pasó** (0 errores nuevos + criterios de verificación OK), continuar al siguiente.
5. **Al terminar B5,** correr un `recalc.py` final completo y reportar: cantidad de fórmulas, errores totales, y el resultado de los criterios de verificación de cada bloque en una tabla resumen.
6. **No tocar** `2_Certificaciones`, `3_Cash_Flow`, `3_Dashboard` salvo lo explícitamente indicado (que es: nada).

---

## 5. Checkpoints de decisión

Estos puntos no quedaron 100% cerrados o dependen de algo que solo se confirma al abrir el archivo. **Preguntar antes de ejecutar el punto, no asumir.**

- **CP1 — Tipo de dato de los códigos de tarea (R2).** Al abrir `1_Presupuesto`, verificar si los códigos en col F son texto o número, y si hay inconsistencias (ej. `3.1` vs `3.10`). Si el tipo no es uniforme o hay ambigüedad que haría fallar los XLOOKUP, **reportar antes de cargar B2** con ejemplos concretos de lo encontrado, para confirmar cómo normalizar la clave.

- **CP2 — Nombre del archivo de salida.** La spec asume `CH_2171_Resumen_de_Obra_v8_2.xlsx`. Si ya existe un v8_2 en la carpeta, **preguntar** qué número de versión usar antes de copiar.

- **CP3 — Referencias de `3_Dashboard` a `1_Presupuesto`.** En B5, antes de vaciar AE/AF, confirmar (leyendo las 3 referencias de `3_Dashboard` a `1_Presupuesto`) que ninguna apunta a AA/AB/AE/AF. Si alguna apunta, **reportar** cuál y a qué columna, para decidir si se reengancha o se deja.

- **CP4 — Filas con avance 0 en `Cert_App_Output`.** La spec sugiere cargar las 21 filas incluso con % actual = 0. Si se prefiere omitir las filas en 0 para aligerar, es válido, pero **confirmar**: afecta cuántas filas tiene la hoja, no los resultados (un SUMIFS sobre filas inexistentes o sobre filas en 0 da lo mismo).

- **CP5 — Tratamiento visual de filas `Anticipo` en `Cert_Facturacion`.** La spec deja a criterio si las columnas de control I/J se blanquean con `IF(C="Anticipo","",...)` o se dejan mostrar el saldo negativo. Si hay duda sobre cuál es más claro para el usuario, **preguntar**.
