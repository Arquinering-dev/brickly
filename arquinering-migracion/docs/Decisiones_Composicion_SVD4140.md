# Decisiones y dudas — Composición del APU Unificado SVD 4140

> Documento para validar antes de integrar la COMPOSICIÓN al Resumen v8.
> Cada tarea muestra de dónde se reconstruyó su composición y qué decisiones se tomaron.
> El **Δ** es la diferencia del costo reconstruido vs el del presupuesto (0% = exacto).
> Las marcas **⚠** señalan decisiones que conviene que confirmes.

## A. Reglas transversales (aplican a todas las tareas)

1. **Trazabilidad antes que paridad** (manual v3): se reconstruye cada insumo individual; solo se usa *lump* cuando el presupuesto no deja rastro.
2. **ALB vs OTR por trazabilidad** (confirmado por vos): MO que llega a `P.MO`/`MO HA AING` = ALB (nómina propia); a `SUBCONTRATOS`/`MO HA SILVA` = OTR (subcontrato).
3. **Caso 7 (partidas derivadas)**: cuando el presupuesto usa una fracción de una partida APU (p.ej. distinto espesor), el factor se aplica a las **cantidades** de los insumos, no a los precios.
4. **Hojas auxiliares** (ELECT, COVE, CALEFA, INCEND): se asume costo **de 1 unidad** (confirmado por vos).
5. **Desperdicio** de materiales: se deriva del total real del APU (el APU mezcla % entero y fracción).
6. **Consumibles**: el `MAT-CONS` (precio 1) es solo para los consumibles % del APU; las líneas "Consumibles" de Tareas son un costo real con su precio.
7. **Pintura excluida**: el presupuesto es "sin pintura" → rubro 15 con costo 0.
8. **Equipos**: 13 partidas del APU tienen el equipo con VLOOKUP roto (`#N/A`); ese costo de equipo no se pudo reconstruir (EQ está excluido del control de costos igual).
9. **Hormigón estructural (rubro 3)**: la MO la hace la cuadrilla propia AING (nómina = ALB, confirmado por vos) pero está priceada **por m³**, no por jornal → su costo es correcto pero no se descompone a horas UOCRA directas (esas saldrían de `2_Quincenas`). El hormigón en sí (H30 premezclado) va como una línea de material (se compra como unidad, no se desglosa).
10. **Lump (sin desglose)**: cuando el presupuesto carga un valor pegado sin rastro de insumos (subcontrato global, premezclado, colocación a cargo del comitente), se usa ese valor como una sola línea — **fiel al monto presupuestado**, pero sin detalle de insumos. No es un error; se listan en la sección B2 por transparencia.

## B. Tareas que requieren tu validación ⚠ (2)

| Tarea | Descripción | A validar |
|---|---|---|
| **1.09** | Tramite luz de obra, certificado luz de obra (2) | escalado por quirk de fuente |
| **23.01** | Albañilería parrila completa | escalado por quirk de fuente |

## B2. Tareas sin desglose de insumos / lump (25) — informativo

Costo fiel al presupuesto pero como una sola línea (sin insumos individuales). Típicamente: subcontrato global, hormigón premezclado, o colocación con material del comitente.

| Tarea | Descripción | Qué quedó como lump |
|---|---|---|
| 3.16 | Permiso de estacionamiento de bomba de hormigó | MAT/OTR |
| 5.07 | Impermeabilización de subsuelo | MO/OTR |
| 10.02 | Ventilación Baños - En caño Ø 110 | MAT/OTR, MO/OTR |
| 18.17 | Montante eléctrica | MAT/OTR |
| 19.01 | Tendido caño cloacal en planta baja y ss | MAT/OTR, MO/OTR |
| 19.02 | Armado de pozo de bombeo cloacal | MAT/OTR, MO/OTR |
| 19.03 | Por armar CDV en planta tipo | MAT/OTR, MO/OTR |
| 19.04 | Montantes, remate y ventilación a los 4 viento | MAT/OTR, MO/OTR |
| 19.05 | Tendido caño pluvial en planta baja y ss | MAT/OTR, MO/OTR |
| 19.06 | Tendido caño pluvial por pisos | MAT/OTR, MO/OTR |
| 19.07 | Instalación tanque de recupero y bombeo pluvia | MAT/OTR, MO/OTR |
| 19.08 | Tendido caño de agua en SS hasta TB. Colocació | MAT/OTR, MO/OTR |
| 19.09 | Colocación TR, armado de colector, subida y ba | MAT/OTR, MO/OTR |
| 19.1 | Colocación de bomba presurizadora, armado de c | MAT/OTR, MO/OTR |
| 19.11 | Distribución agua fria y caliente en planta ti | MAT/OTR, MO/OTR |
| 19.12 | Colocación de artefactos y griferias - Provisi | MAT/OTR, MO/OTR |
| 19.13 | Armado y conexionado de desagües AA.CC | MAT/OTR, MO/OTR |
| 19.14 | Tendido de cañerías de mando y retorno para ca | MAT/OTR |
| 19.16 | Montaje de caldera y puesta en marcha - Provis | MAT/OTR |
| 19.18 | Provisión y tendido de cañerías de gas a cada  | MAT/OTR, MO/OTR |
| 19.19 | Tramites gas - Prefactibilidad, inspección par | MO/OTR |
| 24.08 | Fletes | MO/OTR |
| 24.1 | Volquetes | MAT/OTR |
| 27.01 | Colocación de artefactos a gas - Anafe/Horno | MAT/OTR |
| 28.03 | Flexibles caldera | MAT/OTR |

## C. Detalle por tarea (las 189)

### Rubro 1 — TAREAS PRELIMINARES
- **1.01 Limpieza y preparación del terreno - No cotiza**
  - Sin costo (no cotiza / provisión a cargo del comitente).
- **1.02 Topógrafo - Visita de obra replanteo**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ +0.0%.
  - MO subcontratada (OTR): JEFE DE OBRA.
- **1.03 Cartel de Obra - No cotiza**
  - Sin costo (no cotiza / provisión a cargo del comitente).
- **1.04 Cerco de obra perimetral - En chapa C25 + Concertina + Porto**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ -0.0%.
- **1.05 Obrador colgante, pañol y ducha**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ -0.0%.
  - MO subcontratada (OTR): Flete madera.
- **1.06 Alquiler de baños quimicos y duchas portatiles**
  - Resuelto directo desde: Cotizaciones. Δ +0.0%.
  - MO subcontratada (OTR): Baño portatil / Ducha, Traslado flete entrega/ retiro.
- **1.07 Conexión pilar y luz de obra + Tablero de obra**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ -0.0%.
- **1.08 Conexión agua de obra, tanque + bomba**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ -0.0%.
- **1.09 Tramite luz de obra, certificado luz de obra (2) y medición ** ⚠
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ -0.0%.
  - MO subcontratada (OTR): Gestion suministros luz de obra, Luz de Obra, Medicion PAT luz de obra.
  - ⚠ **MO escalado x0.795** — la fuente tiene un quirk en su propio armado; la composición se escaló al monto presupuestado preservando ítems y proporciones. **Validar el monto del presupuesto.**
- **1.1 Sistema de depresión de napas**
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Total de Obra (3 perforaciones).

### Rubro 2 — MOVIMIENTO DE TIERRA, COMPACTACION Y RELLENO
- **2.01 Excavación a maquina para submuración y subsuelo**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ -0.0%.
  - MO subcontratada (OTR): Desmonte, retiro, aporte y compactación .
- **2.02 Demolición y retiro de fundaciones existentes - No cotiza**
  - Sin costo (no cotiza / provisión a cargo del comitente).
- **2.03 Excavación manual para pozo de achique y bombeo**
  - Resuelto directo desde: jornales P.MO. Δ +0.0%.

### Rubro 3 — ESTRUCTURA RESISTENTE
- **3.01 Hormigón de limpieza - e: 10 cm**
  - Resuelto directo desde: Cotizaciones, jornales P.MO. Δ +0.0%.
- **3.02 Tabique submuración - H30 hidrófugo (95 kg/m3 de hierro)**
  - Resuelto directo. Δ -0.0%.
- **3.03 Zapata corrida tabique - H30 hidrófugo (120 kg/m3)**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): H.A. De vigas de fundación (115kg/m3 de .
- **3.04 Platea - H30 hidrófugo (95 kg/m3 de hierro)**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): HA. De cabezales (90 kg/m3 de hierro).
- **3.05 Rampa - H30 (120 kg/m3 de hierro)**
  - Resuelto directo. Δ -0.0%.
- **3.06 Losa maciza - H30 (110 kg/m3 de hierro)**
  - Resuelto directo. Δ -0.0%.
- **3.07 Vigas - H30 (140 kg/m3 de hierro)**
  - Resuelto directo. Δ +0.0%.
- **3.08 Vigas de H° visto - H30 (140 kg/m3 de hierro)**
  - Resuelto directo. Δ +0.0%.
- **3.09 Tabiques - H30 (120 kg/m3 de hierro)**
  - Resuelto directo. Δ -0.0%.
- **3.1 Columna - H30 (240 Kg/m3 de hierro)**
  - Resuelto directo. Δ -0.0%.
- **3.11 Escaleras - H30 (105 kg/m3 de hierro)**
  - Resuelto directo. Δ +0.0%.
- **3.12 Tabiques tanques de H° - H30 (120 kg/m3 de hierro)**
  - Resuelto directo. Δ -0.0%.
- **3.13 Junta de impermeabilización de PVC - Sika Waterbars v15 x 15**
  - Resuelto directo desde: Cotizaciones. Δ +0.0%.
- **3.14 Sistema de apuntalamiento y reapuntalamiento**
  - Resuelto directo. Δ 0%.
- **3.15 Ensayos de Hormigon por etapas de hormigonado**
  - Resuelto directo. Δ +0.0%.
- **3.16 Permiso de estacionamiento de bomba de hormigón a contramano**
  - Resuelto directo. Δ +0.0%.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Permiso de estacionamiento de bomb._
- **3.17 Picado de medianeras para columnas y vigas - Cotizado solo p**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ +0.0%.

### Rubro 4 — ALBAÑILERIA
- **4.01 Muro tipo 1 (interiores, divisorio de locales) e: 10 cm - La**
  - Composición tomada **completa del APU P-34** (Δ vs presupuesto +0.0%).
- **4.02 Muro tipo 2 y 3 (medianera, caja de escaleras y ascensor) e:**
  - Composición tomada **completa del APU P-38** (Δ vs presupuesto +0.0%).
- **4.03 Muro tipo 4 (divisorio de unidades y fachas) e: 15 cm - Ladr**
  - Composición tomada **completa del APU P-35** (Δ vs presupuesto +0.5%).
- **4.04 Enchape medianeras existentes - Contemplamos picado zonas su**
  - Composición del **APU P-33 escalada ×0.500** — el presupuesto usa una fracción de la partida (Caso 7: el factor se aplica a las cantidades, no a los precios). Δ +0.0%.
- **4.05 Mamposteria cribada de ladrillo visto en balcones**
  - Composición del **APU P-33 escalada ×1.500** — el presupuesto usa una fracción de la partida (Caso 7: el factor se aplica a las cantidades, no a los precios). Δ -0.0%.
- **4.06 Bloque de H° con masillado de hormigon**
  - Composición del **APU P-119 escalada ×2.000** — el presupuesto usa una fracción de la partida (Caso 7: el factor se aplica a las cantidades, no a los precios). Δ +0.0%.
- **4.07 Cordón de hormigón en umbrales carpinterías**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ +0.0%.
- **4.08 Pozo de bombeo pluvial y cloacal**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ -0.0%.

### Rubro 5 — AISLACIONES
- **5.01 Aislación hidrófuga horizontal (baños) - Inc. membrana geote**
  - Composición tomada **completa del APU P-70** (Δ vs presupuesto +0.0%).
- **5.02 Azotado hidrofugo - Sobre medianeras existentes**
  - Composición tomada **completa del APU P-42** (Δ vs presupuesto +0.0%).
- **5.03 Azotado hidrofugo - Contrapiso de vereda**
  - Composición tomada **completa del APU P-42** (Δ vs presupuesto +0.0%).
- **5.04 Aislación térmica en terrazas, eps e:2,00 cm**
  - Resuelto directo desde: Cotizaciones. Δ +0.0%.
- **5.05 Barrera de vapor**
  - Composición tomada **completa del APU P-113** (Δ vs presupuesto +0.0%).
- **5.06 Membrana asfaltica geotextil 4mm - Balcones y azotea - Inc. **
  - Composición tomada **completa del APU P-70** (Δ vs presupuesto +0.0%).
- **5.07 Impermeabilización de subsuelo**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): Impermeabilización de subsuelo.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Impermeabilización de subsuelo._

### Rubro 6 — CUBIERTAS
- **6.02 Babeta de chapa galvanizada en medianeras**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ +0.0%.

### Rubro 7 — REVOQUES
- **7.01 Revoque Grueso Impermeable Exterior proyectable**
  - Composición tomada **completa del APU P-44** (Δ vs presupuesto -0.0%).
- **7.02 Revoque Grueso Impermeable Exterior a mas de 3m proyectable **
  - Composición tomada **completa del APU P-45** (Δ vs presupuesto +0.0%).
- **7.03 Buña en revoque**
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Buña en revoque.
- **7.04 Revoque Grueso Interior + fino**
  - Composición tomada **completa del APU P-43** (Δ vs presupuesto +0.0%).
- **7.05 Yeso interior**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ -0.0%.
  - MO subcontratada (OTR): Yeso.
- **7.06 Arista en yeso**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ +0.0%.
  - MO subcontratada (OTR): Arista / Buña.
- **7.07 Provisión y colocación de guardacanto yesero**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ +0.0%.
  - MO subcontratada (OTR): Cantonera.
- **7.08 Revoque Grueso Impermeable Interior b/ revestimiento**
  - Composición tomada **completa del APU P-44** (Δ vs presupuesto -0.0%).

### Rubro 8 — CONTRAPISOS Y CARPETAS
- **8.01 Contrapiso de cascotes en SS e: 15 cm**
  - Composición del **APU P-46 escalada ×0.150** — el presupuesto usa una fracción de la partida (Caso 7: el factor se aplica a las cantidades, no a los precios). Δ +0.0%.
- **8.02 Contrapiso de cascote s/terreno natural e: 20 cm - Incluye f**
  - Composición del **APU P-46 escalada ×0.208** — el presupuesto usa una fracción de la partida (Caso 7: el factor se aplica a las cantidades, no a los precios). Δ +0.0%.
- **8.03 Contrapiso de cascotes en azoteas c/pendiente e: 15 cm**
  - Composición del **APU P-46 escalada ×0.180** — el presupuesto usa una fracción de la partida (Caso 7: el factor se aplica a las cantidades, no a los precios). Δ -0.0%.
- **8.04 Contrapiso - Carpeta monolitico e: 7 cm**
  - Composición tomada **completa del APU P-48** (Δ vs presupuesto +0.0%).
- **8.05 Carpeta en PB y balcones, baños y azoteas e: 3,00 cm**
  - Composición tomada **completa del APU P-47** (Δ vs presupuesto +0.0%).
- **8.06 Carpeta sobre membrana**
  - Composición tomada **completa del APU P-47** (Δ vs presupuesto +0.0%).
- **8.07 Banquinas para cocinas**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ -0.0%.
- **8.08 Banquinas para bombas y tanques en SB**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ -0.0%.

### Rubro 9 — ESCALERAS
- **9.01 Cemento alisado arrodillado en escaleras**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ -0.0%.
- **9.02 Provisión nariz escalera, hierro angulo 5/8 x 1/8"**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ +0.0%.
- **9.03 Zócalo de concreto**
  - Composición tomada **completa del APU P-42** (Δ vs presupuesto +0.0%).
- **9.04 Provisión y colocación de Rodapie/ Zócalo rampante en placa **
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ +0.0%.

### Rubro 10 — VENTILACIONES
- **10.01 Ventilación Conducto Humos. Incluye toma de aire en PB - No **
  - Costo 0 en el presupuesto (cantidad 0 o no cotizado).
- **10.02 Ventilación Baños - En caño Ø 110**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): Ventilación Baños - En caño Ø 110.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Ventilación Baños - En caño Ø 110._
- **10.03 Colocación de rejillas de inyección y extracción - No aplica**
  - Costo 0 en el presupuesto (cantidad 0 o no cotizado).
- **10.04 Sombreretes en chapa prepintada C25**
  - Resuelto directo desde: hojas auxiliares (COVE). Δ +0.0%.
  - MO subcontratada (OTR): COVE: Sombreretes en chapa prepintad.
  - Expandido de hoja(s) auxiliar(es) COVE — se asume costo de **1 unidad** (confirmado por vos).

### Rubro 11 — PISOS - PROVISION A CARGO DEL COMITENTE
- **11.01 Colocación de travertino en hall PB - Provisión a cargo del **
  - Composición tomada **completa del APU P-56** (Δ vs presupuesto +0.0%).
- **11.02 Colocación de porcelanato en paliers, terraza y espacios com**
  - Composición tomada **completa del APU P-56** (Δ vs presupuesto +0.0%).
- **11.03 Colocación de porcelanato en UF - Provisión a cargo del comi**
  - Composición tomada **completa del APU P-56** (Δ vs presupuesto +0.0%).
- **11.04 Colocación de porcelanato en baños - Provisión a cargo del c**
  - Composición tomada **completa del APU P-57** (Δ vs presupuesto +0.0%).
- **11.05 Provisión y ejecución de alisado de cemento rodillado**
  - Composición tomada **completa del APU P-50** (Δ vs presupuesto -0.0%).
- **11.06 Colocación de baldoson de vereda - Provisión a cargo del com**
  - Composición tomada **completa del APU P-56** (Δ vs presupuesto +0.0%).
- **11.07 Provisión y ejecución de pavimento e: 18 cm, incluye malla Q**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ +0.0%.
  - MO subcontratada (OTR): Alquiler de aserradora, Alquiler de helicoptero.

### Rubro 12 — ZOCALOS Y SOLIAS - PROVISION A CARGO DEL COMITENTE
- **12.01 Provisión y colocación de zocalos de Madera (MDF) h: 7 cm**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ +0.0%.
  - (Ítem cuyo número en el presupuesto es una fórmula `=+A..+0.01`; se recuperó leyendo el valor.)
- **12.02 Zócalo de concreto**
  - Composición tomada **completa del APU P-42** (Δ vs presupuesto +0.0%).
- **12.03 Colocación de zocalo de porcelanico - Provisión a cargo del **
  - Composición tomada **completa del APU P-58** (Δ vs presupuesto -0.0%).
- **12.04 Colocación de zocalo de porcelanato en palieres - Provisión **
  - Composición tomada **completa del APU P-58** (Δ vs presupuesto -0.0%).
- **12.05 Colocación de zocalo de porcelanato en terraza y espacios co**
  - Composición tomada **completa del APU P-58** (Δ vs presupuesto -0.0%).

### Rubro 13 — REVESTIMIENTOS - PROVISION A CARGO DEL COMITENTE
- **13.01 Revestimiento en baños - Provisión a cargo del comitente**
  - Composición tomada **completa del APU P-57** (Δ vs presupuesto +0.0%).
- **13.02 Revestimiento en cocinas - Provisión a cargo del comitente**
  - Composición tomada **completa del APU P-57** (Δ vs presupuesto +0.0%).
- **13.03 Revestimiento tejuela exterior - Provisión a cargo del comit**
  - Composición tomada **completa del APU P-56** (Δ vs presupuesto +0.0%).
- **13.04 Provisión y colocación de perfileria de aluminio tipo ATRIM **
  - Resuelto directo desde: Cotizaciones. Δ +0.0%.

### Rubro 14 — CIELORRASOS
- **14.01 Cielorraso junta tomada placa STD**
  - Composición tomada **completa del APU P-60** (Δ vs presupuesto +0.0%).
  - (Ítem cuyo número en el presupuesto es una fórmula `=+A..+0.01`; se recuperó leyendo el valor.)
- **14.02 Cielorraso junta tomada placa RH**
  - Composición tomada **completa del APU P-61** (Δ vs presupuesto +0.0%).
  - (Ítem cuyo número en el presupuesto es una fórmula `=+A..+0.01`; se recuperó leyendo el valor.)
- **14.03 Cajon en junta tomada placa STD**
  - Composición tomada **completa del APU P-60** (Δ vs presupuesto +0.0%).
- **14.04 Buña perimetral / Cantoneras**
  - Composición tomada **completa del APU P-117** (Δ vs presupuesto +0.0%).
- **14.05 Aplicado de yeso interior**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ -0.0%.
  - MO subcontratada (OTR): Yeso.
- **14.06 Buña en yeso**
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Arista / Buña.
- **14.07 H° Visto - Maquillaje para recibir pintura**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ +0.0%.

### Rubro 15 — PINTURA
- **15.01 Látex interior para paredes Bco. mate (enduido parcial)**
  - **Excluida — PINTURA** (el presupuesto es "sin pintura": costo 0). El detalle de insumos está en el APU si luego se cotiza.
- **15.02 Látex interior para paredes Bco. mate (s/enduido)**
  - **Excluida — PINTURA** (el presupuesto es "sin pintura": costo 0). El detalle de insumos está en el APU si luego se cotiza.
- **15.03 Látex para cielorraso Bco. mate (enduido parcial)**
  - **Excluida — PINTURA** (el presupuesto es "sin pintura": costo 0). El detalle de insumos está en el APU si luego se cotiza.
- **15.04 Látex para cielorraso Bco. mate (enduido completo)**
  - **Excluida — PINTURA** (el presupuesto es "sin pintura": costo 0). El detalle de insumos está en el APU si luego se cotiza.
- **15.05 Latex interior cielorraso sobre H°**
  - **Excluida — PINTURA** (el presupuesto es "sin pintura": costo 0). El detalle de insumos está en el APU si luego se cotiza.
- **15.07 Revestimiento plastico tipo Quimtex en exteriores y PB**
  - **Excluida — PINTURA** (el presupuesto es "sin pintura": costo 0). El detalle de insumos está en el APU si luego se cotiza.
- **15.08 Revestimiento plastico tipo Quimtex en exteriores a mas de 3**
  - **Excluida — PINTURA** (el presupuesto es "sin pintura": costo 0). El detalle de insumos está en el APU si luego se cotiza.
- **15.09 Esmalte sintético en puertas placa, chapa y de ascensor**
  - **Excluida — PINTURA** (el presupuesto es "sin pintura": costo 0). El detalle de insumos está en el APU si luego se cotiza.
- **15.1 Convertidor y esmalte sintentico en barandas - Escalera, bal**
  - **Excluida — PINTURA** (el presupuesto es "sin pintura": costo 0). El detalle de insumos está en el APU si luego se cotiza.

### Rubro 17 — CARPINTERIA - PROVISION A CARGO DEL COMITENTE
- **17.01 Amure de puertas placa Provisión a cargo del comitente**
  - Composición tomada **completa del APU P-39** (Δ vs presupuesto +0.0%).
  - (Ítem cuyo número en el presupuesto es una fórmula `=+A..+0.01`; se recuperó leyendo el valor.)
- **17.02 Amure de puertas de chapa e ingresos depto - Provisión a car**
  - Composición tomada **completa del APU P-39** (Δ vs presupuesto +0.0%).
- **17.03 Amure de premarcos - Provisión a cargo del comitente**
  - Composición tomada **completa del APU P-40** (Δ vs presupuesto +0.0%).
- **17.04 Amure Puertas de Ascensor - Provisión a cargo del comitente**
  - Resuelto directo. Δ -0.0%.

### Rubro 18 — INSTALACION ELECTRICA
- **18.01 Tendido y cableado boca Iluminación**
  - Composición tomada **completa del APU P-120** (Δ vs presupuesto +0.0%).
  - (Ítem cuyo número en el presupuesto es una fórmula `=+A..+0.01`; se recuperó leyendo el valor.)
- **18.02 Tendido y cableado boca Iluminación - Caja mignon para Led**
  - Composición tomada **completa del APU P-120** (Δ vs presupuesto +0.0%).
- **18.03 Tendido y cableado boca tomacorriente**
  - Composición tomada **completa del APU P-121** (Δ vs presupuesto +0.0%).
- **18.04 Tendido y cableado boca tomacorriente especial (AA.CC)**
  - Composición del **APU P-121 escalada ×1.500** — el presupuesto usa una fracción de la partida (Caso 7: el factor se aplica a las cantidades, no a los precios). Δ +0.0%.
- **18.05 Tendido y cableado boca MBT Timbre**
  - Composición tomada **completa del APU P-121** (Δ vs presupuesto +0.0%).
- **18.06 Tendido y cableado boca de temostato - Sin instalación de te**
  - Composición tomada **completa del APU P-121** (Δ vs presupuesto +0.0%).
- **18.07 Boca de TV - Cañería c/cable testigo**
  - Composición del **APU P-120 escalada ×0.750** — el presupuesto usa una fracción de la partida (Caso 7: el factor se aplica a las cantidades, no a los precios). Δ -0.0%.
- **18.08 Boca de PE - Cañería c/cable testigo**
  - Composición del **APU P-120 escalada ×0.750** — el presupuesto usa una fracción de la partida (Caso 7: el factor se aplica a las cantidades, no a los precios). Δ -0.0%.
- **18.09 Boca de CCTV - Cañería c/cable testigo**
  - Composición del **APU P-120 escalada ×0.750** — el presupuesto usa una fracción de la partida (Caso 7: el factor se aplica a las cantidades, no a los precios). Δ -0.0%.
- **18.1 Tablero Servicios generales - TSG**
  - Resuelto directo desde: SUBCONTRATOS, hojas auxiliares (ELECT). Δ +0.0%.
  - MO subcontratada (OTR): Tablero seccional de 36 a 54 polos.
  - Expandido de hoja(s) auxiliar(es) ELECT — se asume costo de **1 unidad** (confirmado por vos).
- **18.11 Tablero Bombas impulsión - TS BI**
  - Resuelto directo desde: SUBCONTRATOS, hojas auxiliares (ELECT). Δ +0.0%.
  - MO subcontratada (OTR): Tablero seccional de 8 a 36 polos.
  - Expandido de hoja(s) auxiliar(es) ELECT — se asume costo de **1 unidad** (confirmado por vos).
- **18.12 Tablero Seccional ascensor - TS.ASC.**
  - Resuelto directo desde: SUBCONTRATOS, hojas auxiliares (ELECT). Δ +0.0%.
  - MO subcontratada (OTR): Tablero seccional de 8 a 36 polos.
  - Expandido de hoja(s) auxiliar(es) ELECT — se asume costo de **1 unidad** (confirmado por vos).
- **18.13 Tablero de Bomba presurizadora - TS BR**
  - Resuelto directo desde: SUBCONTRATOS, hojas auxiliares (ELECT). Δ +0.0%.
  - MO subcontratada (OTR): Tablero seccional de 8 a 36 polos.
  - Expandido de hoja(s) auxiliar(es) ELECT — se asume costo de **1 unidad** (confirmado por vos).
- **18.14 Tablero TS Local**
  - Resuelto directo desde: SUBCONTRATOS, hojas auxiliares (ELECT). Δ -0.0%.
  - MO subcontratada (OTR): Tablero seccional de 8 a 36 polos.
  - Expandido de hoja(s) auxiliar(es) ELECT — se asume costo de **1 unidad** (confirmado por vos).
- **18.15 Tablero de UF (monoambiente)**
  - Resuelto directo desde: SUBCONTRATOS, hojas auxiliares (ELECT). Δ -0.0%.
  - MO subcontratada (OTR): Tablero seccional de 8 a 36 polos.
  - Expandido de hoja(s) auxiliar(es) ELECT — se asume costo de **1 unidad** (confirmado por vos).
- **18.16 Tablero de UF (2 y 3 ambientes)**
  - Resuelto directo desde: SUBCONTRATOS, hojas auxiliares (ELECT). Δ +0.0%.
  - MO subcontratada (OTR): Tablero seccional de 8 a 36 polos.
  - Expandido de hoja(s) auxiliar(es) ELECT — se asume costo de **1 unidad** (confirmado por vos).
- **18.17 Montante eléctrica**
  - Resuelto directo desde: jornales P.MO. Δ +0.0%.
  - MO subcontratada (OTR): ESPECIALIZADO, MEDIO OFICIAL.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Montante eléctrica._
- **18.18 Montante TV + Tablero TV - Cañería c/cable testigo**
  - Resuelto directo desde: hojas auxiliares (ELECT), jornales P.MO. Δ -0.0%.
  - MO subcontratada (OTR): AYUDANTE, OFICIAL.
  - Expandido de hoja(s) auxiliar(es) ELECT — se asume costo de **1 unidad** (confirmado por vos).
- **18.19 Montante PE + Tablero PE- Cañería c/cable testigo**
  - Resuelto directo desde: hojas auxiliares (ELECT), jornales P.MO. Δ -0.0%.
  - MO subcontratada (OTR): AYUDANTE, OFICIAL.
  - Expandido de hoja(s) auxiliar(es) ELECT — se asume costo de **1 unidad** (confirmado por vos).
- **18.2 Colocación de sensor de movimiento - Provisión a cargo del c**
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Colocación artefacto.
- **18.21 Colocación de teclas simples y/o combinadas - Provisión a ca**
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Conexión de punto y toma.
- **18.22 Colocación de pulsadores, circulación + timbres - Provisión **
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Conexión de punto y toma.
- **18.23 Colocación de tomacorriente simple y doble 10 A - Provisión **
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Conexión de punto y toma.
- **18.24 Colocación de luz de emergencia - Provisión a cargo del comi**
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Luz de emergencia.
- **18.25 Colocación de zumbador - Provisión a cargo del comitente**
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Colocación artefacto.
- **18.26 Colocación artefactos en espacios comunes y balcones - Provi**
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Colocación artefacto.
- **18.27 Colocación de fotocelula - Provisión a cargo del comitente**
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Colocación artefacto.
- **18.28 Acometida y gabiente de medidores**
  - Resuelto directo desde: SUBCONTRATOS, hojas auxiliares (ELECT). Δ -0.0%.
  - MO subcontratada (OTR): Caja de toma, Caño de acometida, Gabinete 1 medidor trif, Gabinete 4 medidores.
  - Expandido de hoja(s) auxiliar(es) ELECT — se asume costo de **1 unidad** (confirmado por vos).
- **18.29 Puesta a tierra, jabalinas y cableados**
  - Resuelto directo desde: SUBCONTRATOS, hojas auxiliares (ELECT). Δ -0.0%.
  - MO subcontratada (OTR): PAT de Servicio.
  - Expandido de hoja(s) auxiliar(es) ELECT — se asume costo de **1 unidad** (confirmado por vos).
- **18.3 Certificado DCI para servicios generales**
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Servicios grales T1.

### Rubro 19 — INSTALACION SANITARIA, GRIFERIA Y SANITARIOS
- **19.01 Tendido caño cloacal en planta baja y ss**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): Tendido caño cloacal en planta baja y ss.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Tendido caño cloacal en planta baj._
- **19.02 Armado de pozo de bombeo cloacal**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): Armado de pozo de bombeo cloacal.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Armado de pozo de bombeo cloacal._
- **19.03 Por armar CDV en planta tipo**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): Por armar CDV en planta tipo.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Por armar CDV en planta tipo._
- **19.04 Montantes, remate y ventilación a los 4 vientos**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): Montantes, remate y ventilación a los 4 .
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Montantes, remate y ventilación a ._
- **19.05 Tendido caño pluvial en planta baja y ss**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): Tendido caño pluvial en planta baja y ss.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Tendido caño pluvial en planta baj._
- **19.06 Tendido caño pluvial por pisos**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): Tendido caño pluvial por pisos.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Tendido caño pluvial por pisos._
- **19.07 Instalación tanque de recupero y bombeo pluvial**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): Instalación tanque de recupero y bombeo .
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Instalación tanque de recupero y b._
- **19.08 Tendido caño de agua en SS hasta TB. Colocación de TB, armad**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): Tendido caño de agua en SS hasta TB. Col.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Tendido caño de agua en SS hasta T._
- **19.09 Colocación TR, armado de colector, subida y bajadas de AF**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): Colocación TR, armado de colector, subid.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Colocación TR, armado de colector,._
- **19.1 Colocación de bomba presurizadora, armado de colector y mont**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): Colocación de bomba presurizadora, armad.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Colocación de bomba presurizadora,._
- **19.11 Distribución agua fria y caliente en planta tipo**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): Distribución agua fria y caliente en pla.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Distribución agua fria y caliente ._
- **19.12 Colocación de artefactos y griferias - Provisión a cargo del**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): Colocación de artefactos y griferias - P.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Colocación de artefactos y griferi._
- **19.13 Armado y conexionado de desagües AA.CC**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): Armado y conexionado de desagües AA.CC.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Armado y conexionado de desagües A._
- **19.14 Tendido de cañerías de mando y retorno para calefacción**
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Tendido de cañerías.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Tendido de cañerías de mando y ret._
- **19.15 Montaje de radiadores - Provisión a cargo del comitente**
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Montaje de radiadores.
- **19.16 Montaje de caldera y puesta en marcha - Provisión a cargo de**
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Puesta en marcha de caldera.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Montaje de caldera y puesta en mar._
- **19.17 Tendido cañeria de incendio - Gabinetes, mangueras, lanzas y**
  - Resuelto directo desde: hojas auxiliares (INCEND). Δ +0.0%.
  - MO subcontratada (OTR): INCEND: Tendido cañeria de incendio - .
  - Expandido de hoja(s) auxiliar(es) INCEND — se asume costo de **1 unidad** (confirmado por vos).
- **19.18 Provisión y tendido de cañerías de gas a cada UF**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): Provisión y tendido de cañerías de gas a.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Provisión y tendido de cañerías de._
- **19.19 Tramites gas - Prefactibilidad, inspección parcial, final**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): Tramites gas - Prefactibilidad, inspecci.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Tramites gas - Prefactibilidad, in._

### Rubro 20 — AIRE ACONDICIONADO - PROVISION A CARGO DEL COMITENTE
- **20.01 Preinstalación para AA.CC**
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Preinstalacion M.O.
- **20.02 Montaje, colocación y puesta en marcha de equipos - Provisió**
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Instalacion y puesta en marcha.

### Rubro 21 — ASCENSOR - PROVISION A CARGO DEL COMITENTE
- **21.01 Ascensores - Provisión y colocación a cargo del comitente**
  - Sin costo (no cotiza / provisión a cargo del comitente).

### Rubro 22 — EQUIPAMIENTO - PROVISION A CARGO DEL COMITENTE
- **22.01 Artefactos de cocina, instalacion anafes y hornos - Provisió**
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Colocación extractor de aire en baño.
- **22.02 Instalacion de extractores de baños - Provisión a cargo del **
  - Resuelto directo desde: SUBCONTRATOS. Δ +0.0%.
  - MO subcontratada (OTR): Colocación extractor de aire en baño.

### Rubro 23 — TRABAJOS COMPLEMENTARIOS
- **23.01 Albañilería parrila completa** ⚠
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ -0.0%.
  - ⚠ **MAT escalado x2.000** — la fuente tiene un quirk en su propio armado; la composición se escaló al monto presupuestado preservando ítems y proporciones. **Validar el monto del presupuesto.**
- **23.02 Colocación de ladrillos de vidrio - Provisión a cargo del co**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ +0.0%.
- **23.03 Provisión y amure de tapas para pleno electricos y gas en pa**
  - Resuelto directo desde: hojas auxiliares (COVE). Δ +0.0%.
  - MO subcontratada (OTR): COVE: Provisión y amure de tapas par.
  - Expandido de hoja(s) auxiliar(es) COVE — se asume costo de **1 unidad** (confirmado por vos).

### Rubro 24 — AYUDA DE GREMIOS
- **24.01 Sereno**
  - Resuelto directo desde: hojas auxiliares (GGBB). Δ +0.0%.
  - MO subcontratada (OTR): GGBB: Sereno.
  - Expandido de hoja(s) auxiliar(es) GGBB — se asume costo de **1 unidad** (confirmado por vos).
- **24.02 Tecnico de seguridad & higiene permanente en Obra**
  - Resuelto directo desde: hojas auxiliares (GGBB). Δ +0.0%.
  - MO subcontratada (OTR): GGBB: Tecnico de seguridad & higiene.
  - Expandido de hoja(s) auxiliar(es) GGBB — se asume costo de **1 unidad** (confirmado por vos).
- **24.03 Higiene y seguridad Res 51**
  - Resuelto directo desde: hojas auxiliares (GGBB). Δ +0.0%.
  - MO subcontratada (OTR): GGBB: Higiene y seguridad Res 51.
  - Expandido de hoja(s) auxiliar(es) GGBB — se asume costo de **1 unidad** (confirmado por vos).
- **24.04 Protecciones y defensas**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ -0.0%.
- **24.05 Ayuda de gremios**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ -0.0%.
- **24.06 Limpieza periodica**
  - Expandido de la hoja **Tareas**: materiales por línea + jornales UOCRA (M/N/O/P) + MO/otros (col L). Δ -0.0%.
- **24.07 Limpieza final de Obra**
  - Costo 0 en el presupuesto (cantidad 0 o no cotizado).
- **24.08 Fletes**
  - Resuelto directo. Δ +0.0%.
  - MO subcontratada (OTR): Fletes.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Fletes._
- **24.09 Alquiler de equipos - Montacargas, tubos de descarga y balan**
  - Costo 0 en el presupuesto (cantidad 0 o no cotizado).
- **24.1 Volquetes**
  - Resuelto directo desde: jornales P.MO. Δ +0.0%.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Volquetes._

### Rubro 25 — JEFATURA DE OBRA
- **25.01 Supervisión profesional de Obra**
  - Resuelto directo desde: hojas auxiliares (GGBB). Δ +0.0%.
  - MO subcontratada (OTR): GGBB: Supervisión profesional de Obr.
  - Expandido de hoja(s) auxiliar(es) GGBB — se asume costo de **1 unidad** (confirmado por vos).
- **25.02 Movilidad y viaticos**
  - Resuelto directo desde: hojas auxiliares (GGBB). Δ +0.0%.
  - MO subcontratada (OTR): GGBB: Movilidad y viaticos.
  - Expandido de hoja(s) auxiliar(es) GGBB — se asume costo de **1 unidad** (confirmado por vos).

### Rubro 26 — COMPRA DIRECTA COMITENTE
- **26.01 Hierro c/ corte y doblado**
  - Resuelto directo. Δ +0.0%.
- **26.02 H° - inc hidrofugo, bombeo, piedra 6/12**
  - Resuelto directo. Δ +0.0%.
- **26.03 Tanques y bombas - No cotiza**
  - Sin costo (no cotiza / provisión a cargo del comitente).
- **26.04 Matafuego ABC x 5 kg - No cotiza**
  - Sin costo (no cotiza / provisión a cargo del comitente).
- **26.05 Matafuego CO2 x 3,5 kg - No cotiza**
  - Sin costo (no cotiza / provisión a cargo del comitente).
- **26.06 Boca de incencio - No cotiza**
  - Sin costo (no cotiza / provisión a cargo del comitente).
- **26.07 Boca de impulsión - No cotiza**
  - Sin costo (no cotiza / provisión a cargo del comitente).
- **26.08 Gestión de compras**
  - Costo 0 en el presupuesto (cantidad 0 o no cotizado).

### Rubro 27 — VARIOS
- **27.01 Colocación de artefactos a gas - Anafe/Horno**
  - Resuelto directo desde: jornales P.MO. Δ +0.0%.
  - MO subcontratada (OTR): ESPECIALIZADO.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Colocación de artefactos a gas - A._
- **27.02 Provisión y colicación de campanas de parrilla y ventilacion**
  - Resuelto directo desde: hojas auxiliares (COVE). Δ -0.0%.
  - MO subcontratada (OTR): COVE: Provisión y colicación de camp.
  - Expandido de hoja(s) auxiliar(es) COVE — se asume costo de **1 unidad** (confirmado por vos).
- **27.03 Provisión de teclas, tomacorrientes, pulsadores marca Cambre**
  - Resuelto directo desde: hojas auxiliares (ELECT). Δ +0.0%.
  - Expandido de hoja(s) auxiliar(es) ELECT — se asume costo de **1 unidad** (confirmado por vos).

### Rubro 28 — CALEFACCION
- **28.01 Tendido de cañería por piso, manta y malla**
  - Resuelto directo desde: SUBCONTRATOS, hojas auxiliares (CALEFA). Δ +0.0%.
  - MO subcontratada (OTR): Piso radiante + caldera.
  - Expandido de hoja(s) auxiliar(es) CALEFA — se asume costo de **1 unidad** (confirmado por vos).
- **28.02 Colectores y gabinetes**
  - Resuelto directo desde: hojas auxiliares (CALEFA). Δ +0.0%.
  - Expandido de hoja(s) auxiliar(es) CALEFA — se asume costo de **1 unidad** (confirmado por vos).
- **28.03 Flexibles caldera**
  - Resuelto directo. Δ +0.0%.
  - _Nota: costo sin desglose de insumos (valor del presupuesto como una línea): Flexibles caldera._