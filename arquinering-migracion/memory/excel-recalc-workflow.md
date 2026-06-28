---
name: excel-recalc-workflow
description: Editar los .xlsx v8 con openpyxl borra los valores cacheados que lee el dashboard; recalcular con scripts/excel_recalc.py
metadata:
  type: project
---

**Gotcha crítico:** guardar un Resumen v8 con openpyxl **borra los valores cacheados de TODAS
las celdas de fórmula** (openpyxl escribe fórmulas pero no sus resultados). El dashboard lee esos
valores (`openpyxl data_only=True`) y `recalc.py` también → tras un save de openpyxl, el dashboard
ve celdas de fórmula VACÍAS hasta que se recalcula en Excel.

**Solución (instalada 2026-06-14):** `scripts/excel_recalc.py` maneja Excel por COM (pywin32 +
Excel instalado) para abrir → `CalculateFullRebuild` → guardar, repoblando los valores cacheados.
Patrón de edición programática de los v8:
1. editar con openpyxl (append al final, nunca insert/delete_rows) y `wb.save()`
2. `python scripts/excel_recalc.py <archivo>`  ← restaura valores cacheados
3. `python scripts/recalc.py <archivo>`         ← valida 0 errores de fórmula
4. sincronizar copias (GDR: dashboard/data ↔ archivos/referencia; CH: dashboard/data ↔ archivos/output)

No hay LibreOffice; sí Excel 16.0. `pywin32` es dev-tool local (no runtime del dashboard).
Imprimir con `sys.stdout.reconfigure(encoding="utf-8")` o la consola cp1252 rompe con emojis/✓.
