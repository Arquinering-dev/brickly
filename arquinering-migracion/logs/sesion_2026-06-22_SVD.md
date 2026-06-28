# Sesión 2026-06-22 — Migración SVD 4140 (El Salvador 4140) legacy→v8

### Objetivo
Migrar el Resumen de Obra de la 3ª obra (SVD 4140) a la estructura v8 nueva para que cargue en el
dashboard. A diferencia de GDR/CH, SVD **nunca fue migrado a v8** (legacy clásico de 25 hojas) →
construcción legacy→v8 completa, no retrofit.

### Insumos (en `archivos/fuente/`)
- `SVD 4140 - Resumen de Obra.xlsx` (legacy, 25 hojas)
- `SVD 4140 Mayores 2026-06-01.xlsx` (Tezamat, cc SALVA4140, 319 mov)
- `SVD 4140_Pto. 01_Cert.12.xlsx` (12 certs) · `SVD 4140_Pto. 02_Cert. 08.xlsx` (8 certs)

### Enfoque (confirmado con Pedro)
Clonar GDR v8_12 (mismo shape: 3 OCs) y repoblar cada hoja con datos SVD. Mapeo de rubros con mejor
criterio (marcado en pendientes). Split fiscal derivado de `Facturacion`. **Venta = input por tarea**
(markup no uniforme — decisión tomada al detectar PTO01 1,333 vs PTO02 1,268).

### Completado — `archivos/output/SVD_4140_Resumen_de_Obra_v8_1.xlsx`
- [x] B1 inventario + reconciliación rubros (rama 53 plan Tezamat)
- [x] B1b clon GDR v8_12 + `_Listas` (33 rubros plan)
- [x] B2 `1_Presupuesto` 191 tareas, value-preserving (venta $1.158.163.185 exacto)
- [x] B8 `0_Indice_CAC` (base sep-2024) + `0_CONFIG` SVD
- [x] B4 `1_GGBB` (template legacy, markup F66)
- [x] B3 `1_Composicion` placeholder (sin APU Unificado)
- [x] B5 `2_Gastos_DirInd` tabla plana vacía
- [x] B6 `2_Movimientos` 319 mov Tezamat
- [x] B6b `2_Subcontratos` 10 contratos + `2_Quincenas` 163 registros de horas (M.O.; costo vacío → Tezamat)
- [x] B7 circuito `Cert_*` (3 OC, 404 filas avance, 20 certs)
- [x] B9 recalc 0 errores + excel_recalc COM (cacheado)
- [x] B10 alta en dashboard (`obras.yaml`) → Flask 200, reader sin cambios, portfolio 3 obras

### KPIs resultantes (reconcilian)
- Avance físico **62,8%** (OC01 89,5% · OC02 48,8% · OC03 0% sin doc)
- Ppto costo $876,5M controlable / $897,0M total · Ppto venta **$1.158.163.185** (legacy exacto)
- Certificado total $1.054,5M · cobrado $0 (sin cobros cargados) · rubros ∈ plan ✓

### Decisiones tomadas (ver CLAUDE.md §11 y pendientes.md)
- **Venta = input por tarea** (markup no uniforme) — preserva montos de OC y avance venta-vs-venta.
- PV del doc almacenado en `Cert_App_Output` (evita el problema de códigos partidos 2.01.01/02).
- IVA 10,5% (obra civil); split fiscal por OC derivado de `Facturacion`.
- Mapeos de rubro best-effort + split MO OTR/ALB por cuadrilla propia (marcados para confirmar).

### Pendiente para próxima sesión (datos, no estructura)
- Cobros (`Cert_Facturacion`) → habilitar `cobrado`. Quincenas desde hojas M.O. OC03 avance (falta doc).
  Tagueo de pagos a subcontratos en `2_Movimientos` Q/R. Confirmar mapeos de rubro con Arquinering.
- Revisar montos de contrato en `Contratistas` (SC con pagos>presup; SERENO presup=0).
