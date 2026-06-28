# Reconciliación Plan de Cuentas Tezamat ↔ GDR 3760

> Generado por `scripts/reconciliar_plan_cuentas_gdr.py`. Plan: `AING - Plan de Cuentas.xlsx`; obra: `GDR_3760_Resumen_de_Obra_v8.xlsx` (referencia).
> Espeja el criterio usado en CH (`reconciliar_plan_cuentas.py`).

Rama **53 OBRA** = rubros de obra (split MT/MO en el nombre). Ramas **50/51/52** = indirectos. Cruce por NOMBRE normalizado.

## 1. Rubros de GDR `1_Presupuesto` (cols A/B/C/D) ↔ plan

| Rubro en GDR | n | Cols | Match plan | Código | Rama |
|---|---|---|---|---|---|
| Agrimensura | 2 | AC | ✗ | — | **revisar** |
| Albañilería | 115 | ACD | ✗ | — | **revisar** |
| Durlock/Yeso | 16 | AC | ✗ | — | **revisar** |
| Electricidad | 70 | ACD | ✗ | — | **revisar** |
| Excavación y Mov. de Suelos | 5 | AC | ✗ | — | **revisar** |
| Gastos Generales Obra | 3 | AC | ✗ | — | **revisar** |
| Hormigón | 45 | ACD | ✗ | — | **revisar** |
| Movilidad | 4 | AC | ✗ | — | **revisar** |
| Pintura | 24 | ACD | ✗ | — | **revisar** |
| Preliminar | 15 | ACD | ✗ | — | **revisar** |
| Revestimiento | 34 | ACD | ✗ | — | **revisar** |
| Sanitaria | 38 | AC | ✗ | — | **revisar** |
| Seguridad e Higiene | 4 | AC | ✓ | 53026 | 53 |
| Supervisión de Obra | 2 | AC | ✗ | — | **revisar** |

**Sin match exacto (13/14):** Agrimensura, Albañilería, Durlock/Yeso, Electricidad, Excavación y Mov. de Suelos, Gastos Generales Obra, Hormigón, Movilidad, Pintura, Preliminar, Revestimiento, Sanitaria, Supervisión de Obra

## 2. `_Listas` de GDR ↔ plan

| Rubro _Listas GDR | Match plan | Código |
|---|---|---|
| Seguridad e Higiene | ✓ | 53026 |
| Agrimensura | ✗ | — |
| Supervisión de Obra | ✗ | — |
| Movilidad | ✗ | — |
| Preliminar | ✗ | — |
| Excavación y Mov. de Suelos | ✗ | — |
| Hormigón | ✗ | — |
| Albañilería | ✗ | — |
| Durlock/Yeso | ✗ | — |
| Aberturas | ✓ | 53012 |
| Revestimiento | ✗ | — |
| Pintura | ✗ | — |
| Electricidad | ✗ | — |
| Sanitaria | ✗ | — |
| Termomecánica | ✗ | — |
| Gastos Generales Obra | ✗ | — |
| Gastos en Personal | ✓ | 5108 |
| Equipos | ✗ | — |
| Consumibles y Ferretería | ✗ | — |
| Artefactos Sanitarios | ✗ | — |
| Instalación Incendio | ✗ | — |
| VitroBlock | ✗ | — |
| Mantenimiento | ✗ | — |

**Sin match (20/23):** Agrimensura, Supervisión de Obra, Movilidad, Preliminar, Excavación y Mov. de Suelos, Hormigón, Albañilería, Durlock/Yeso, Revestimiento, Pintura, Electricidad, Sanitaria, Termomecánica, Gastos Generales Obra, Equipos, Consumibles y Ferretería, Artefactos Sanitarios, Instalación Incendio, VitroBlock, Mantenimiento

## 3. `_Listas` de CH ya alineado al plan (referencia / objetivo)

| Rubro canónico CH | Código |
|---|---|
| Preliminares | 53001 |
| Demolición | 53002 |
| Movimiento de Suelos | 53003 |
| Hormigón MT | 53004 |
| Homigón MO | 53005 |
| Metálica MT | 53006 |
| Metálica MO | 53007 |
| Albañilería MT | 53008 |
| Albañilería MO | 53009 |
| Durlock MT | 53010 |
| Durlock MO | 53011 |
| Aberturas | 53012 |
| Revestimiento MT | 53013 |
| Revestimiento MO | 53014 |
| Pintura MT | 53015 |
| Pintura MO | 53016 |
| Sanitaria MT | 53017 |
| Sanitaria MO | 53018 |
| Eléctrico MT | 53019 |
| Eléctrico MO | 53020 |
| Provisiones | 53021 |
| Gastos Generales | 53022 |
| Varios Ferreteria | 53023 |
| Termomecánica MT | 53024 |
| Termomecánica MO | 53025 |
| Seguridad e Higiene | 53026 |
| Herrería MT | 53027 |
| Herrería MO | 53028 |
| Alquiler de Equipos | 53980 |
| Gastos a Reintegrar | 53990 |
| Gastos GCBA Construccion | 53999 |
| Mov. Variables | 52302 |
| Supervisión de Obra MO | 52209 |

## 4. Rama 53 OBRA del plan (universo de rubros de obra)

| Código | Desc |
|---|---|
| 53001 | Preliminares |
| 53002 | Demolición |
| 53003 | Movimiento de Suelos |
| 53004 | Hormigón MT |
| 53005 | Homigón MO |
| 53006 | Metálica MT |
| 53007 | Metálica MO |
| 53008 | Albañilería MT |
| 53009 | Albañilería MO |
| 53010 | Durlock MT |
| 53011 | Durlock MO |
| 53012 | Aberturas |
| 53013 | Revestimiento MT |
| 53014 | Revestimiento MO |
| 53015 | Pintura MT |
| 53016 | Pintura MO |
| 53017 | Sanitaria MT |
| 53018 | Sanitaria MO |
| 53019 | Eléctrico MT |
| 53020 | Eléctrico MO |
| 53021 | Provisiones |
| 53022 | Gastos Generales |
| 53023 | Varios Ferreteria |
| 53024 | Termomecánica MT |
| 53025 | Termomecánica MO |
| 53026 | Seguridad e Higiene |
| 53027 | Herrería MT |
| 53028 | Herrería MO |
| 53980 | Alquiler de Equipos |
| 53990 | Gastos a Reintegrar |
| 53999 | Gastos GCBA Construccion |
