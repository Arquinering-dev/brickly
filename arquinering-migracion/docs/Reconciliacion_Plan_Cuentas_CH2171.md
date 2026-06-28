# Reconciliación Plan de Cuentas Tezamat ↔ CH 2171

> Generado por `scripts/reconciliar_plan_cuentas.py`. Fuente del plan: `AING - Plan de Cuentas.xlsx`; fuente de la obra: `CH_2171_..._v8_6.xlsx`.

El plan es el plan contable completo de Arquinering. La rama **53 OBRA** contiene los rubros de obra (con split MT/MO explícito). Las ramas **50/51/52** (IMPUESTOS/PERSONAL/ADMINISTRACIÓN) son gastos indirectos.

## 1. Cuentas usadas en `2_Movimientos` (cruce por CÓDIGO)

| Código | Desc Cuenta | Mov. | Neto $ | Rama | ¿En plan? |
|--------|-------------|------|--------|------|-----------|
| 410222 | Obra civil Reforma | 4 | -128,640,152 | Ventas | ✓ |
| 5108 | Gastos en personal | 5 | 392,068 | Personal | ✓ |
| 52104 | Aguas | 2 | 104,545 | Admin (indirecto) | ✓ |
| 52204 | H. Seguridad e Higiene | 5 | 3,523,165 | Admin (indirecto) | ✓ |
| 52210 | H. Gestoria | 1 | 520,000 | Admin (indirecto) | ✓ |
| 52302 | Mov. Variables | 24 | 1,506,981 | Admin (indirecto) | ✓ |
| 53001 | Preliminares | 25 | 6,166,386 | OBRA (rubro) | ✓ |
| 53004 | Hormigón MT | 11 | 29,197,349 | OBRA (rubro) | ✓ |
| 53005 | Homigón MO | 8 | 37,671,344 | OBRA (rubro) | ✓ |
| 53008 | Albañilería MT | 5 | 679,248 | OBRA (rubro) | ✓ |
| 53009 | Albañilería MO | 11 | 8,188,458 | OBRA (rubro) | ✓ |
| 53017 | Sanitaria MT | 1 | 434,539 | OBRA (rubro) | ✓ |
| 53022 | Gastos Generales | 7 | 3,095,000 | OBRA (rubro) | ✓ |
| 53023 | Varios Ferreteria | 12 | 558,609 | OBRA (rubro) | ✓ |
| 53026 | Seguridad e Higiene | 1 | 309,091 | OBRA (rubro) | ✓ |

**Resultado:** 15/15 cuentas resuelven contra el plan por código. ✅ Todas.

## 2. Rubros de `1_Presupuesto` ↔ rama 53 OBRA (cruce por NOMBRE)

| Rubro en 1_Presupuesto | n | Match en plan | Código | Observación |
|------------------------|---|---------------|--------|-------------|
| Agrimensura MO | 1 | ✗ | — | **revisar** |
| Agrimensura MT | 1 | ✗ | — | **revisar** |
| Albañilería MO | 50 | ✓ | 53009 | — |
| Albañilería MT | 42 | ✓ | 53008 | — |
| Durlock MO | 11 | ✓ | 53011 | — |
| Durlock MT | 7 | ✓ | 53010 | — |
| Eléctrico MO | 25 | ✓ | 53020 | — |
| Eléctrico MT | 18 | ✓ | 53019 | — |
| Gastos Generales Obra MO | 1 | ✗ | — | **revisar** |
| Gastos Generales Obra MT | 2 | ✗ | — | **revisar** |
| Homigón MO | 30 | ✓ | 53005 | — |
| Hormigón MT | 21 | ✓ | 53004 | — |
| Mantenimiento MO | 2 | ✗ | — | **revisar** |
| Mov. Variables | 4 | ✓ | 52302 | — |
| Movimiento de Suelos | 2 | ✓ | 53003 | — |
| Pintura MO | 14 | ✓ | 53016 | — |
| Pintura MT | 12 | ✓ | 53015 | — |
| Preliminares | 11 | ✓ | 53001 | — |
| Revestimiento MO | 13 | ✓ | 53014 | — |
| Revestimiento MT | 13 | ✓ | 53013 | — |
| Sanitaria MO | 18 | ✓ | 53018 | — |
| Sanitaria MT | 16 | ✓ | 53017 | — |
| Seguridad e Higiene MO | 3 | ✗ | — | **revisar** |
| Supervisión de Obra MO | 2 | ✗ | — | **revisar** |
| Termomecánica MO | 1 | ✓ | 53025 | — |
| Termomecánica MT | 1 | ✓ | 53024 | — |

**Sin match exacto (7):** Agrimensura MO, Agrimensura MT, Gastos Generales Obra MO, Gastos Generales Obra MT, Mantenimiento MO, Seguridad e Higiene MO, Supervisión de Obra MO

## 3. Cuentas 53 OBRA del plan NO usadas como rubro en `1_Presupuesto`

| Código | Desc | ¿Aparece en 2_Movimientos? |
|--------|------|----------------------------|
| 53002 | Demolición | no |
| 53006 | Metálica MT | no |
| 53007 | Metálica MO | no |
| 53012 | Aberturas | no |
| 53021 | Provisiones | no |
| 53022 | Gastos Generales | sí (gasto) |
| 53023 | Varios Ferreteria | sí (gasto) |
| 53026 | Seguridad e Higiene | sí (gasto) |
| 53027 | Herrería MT | no |
| 53028 | Herrería MO | no |
| 53980 | Alquiler de Equipos | no |
| 53990 | Gastos a Reintegrar | no |
| 53999 | Gastos GCBA Construccion | no |

## 4. Decisiones de mapeo (Pedro, 2026-06-19)

- **Política de nombres:** alinear los nombres de rubro del v8 (_Listas, 1_Presupuesto, 2_Quincenas) EXACTAMENTE al plan, incluido el typo `Homigón MO`. Cruce 1:1 por nombre y por código.
- **Mov. Variables:** se mantiene como rubro de obra (mapea a la cuenta `52302`).

| Rubro v8 actual | → Rubro canónico | Código | Acción |
|-----------------|------------------|--------|--------|
| Gastos Generales Obra MT + MO | Gastos Generales | 53022 | colapsar 2→1 (sin split MT/MO) |
| Mantenimiento MO | Gastos Generales | 53022 | fusionar |
| Seguridad e Higiene MO | Seguridad e Higiene | 53026 | renombrar (drop 'MO') |
| Agrimensura MT + MO | Preliminares | 53001 | fusionar en Preliminares |
| Supervisión de Obra MO | H. Ingeniería (indirecto) | 52209 | reclasificar a indirecto |
| Mov. Variables | Mov. Variables | 52302 | queda rubro (cuenta admin) |
