---
name: validate-parser
description: Valida que el import/parser haya cargado bien los Excel de obra en la DB local — compara número por número y nombre por nombre los APU Unificados contra lo que quedó en Postgres. Usar cuando el usuario diga "/validate-parser", pida verificar que los datos de la web coinciden con los Excel, o quiera chequear el parser de GDR/Chivilcoy. No modifica nada (solo lee).
---

# /validate-parser — Excel de obra ⟷ DB (verificación número por número)

Compara los **APU Unificados `_conAprobado.xlsx`** (lo que se importa) contra lo que el import dejó
en la DB local, para GDR 3760 y Chivilcoy 2171. Solo lectura — no toca la base.

El motor ya está escrito en **`backend/scripts/validate-parser.ts`**. Este skill = correrlo,
leer el reporte y contarle al usuario qué cuadra y qué no.

## Datos base (rutas, ya configuradas en el script)

| Obra | APU Unificado (con aprobado) — fuente que se importa |
|------|------|
| GDR3760 | `~/Downloads/APU_Unificado_GDR3760_VF_conAprobado.xlsx` |
| CH2171  | `~/Downloads/APU_Unificado_CH2171_v4_4_conAprobado.xlsx` |

(Los `_conAprobado` los genera `backend/scripts/inject-aprobado.ts` desde los archivos crudos
aprobado+cashflow. Los archivos crudos originales: `AING - GDR3760 01 APROBADO.xlsx`,
`AING - CH 2171 02 Y CASHFLOW 02 jp.xlsx`.)

## Qué compara (por obra)

1. **Presupuesto GENERADOR** — por ítem: cantidad, CD/ud, MAT/MO/EQ por ud · + Σ costo directo.
2. **Presupuesto APROBADO** — por ítem (agregado por nº): cantidad Σ, precio de venta total · + Σ PV.
   Aplica tolerancia (±$1 o 0.1% en plata, 0.01 en cantidad).
3. **Cronograma** — % de ejecución por mes calendario, por ítem (tolerancia 0.5pp).
4. **Catálogo** — conteos de Materiales/MO/Equipos/Subcontratos, Partidas y Composición.

> El nº de ítem puede repetirse en la hoja del aprobado (CH rubro 24/25). El script **agrega por
> item#** en ambos lados — es la única comparación correcta y reporta los repetidos como aviso.
> Los **precios de insumos del catálogo son compartidos** entre obras (gana el último import), así
> que ese conteo es informativo; los números per-obra (presupuesto/cronograma) son los que importan.

## Cómo correrlo

Prerrequisito: DB local levantada y **ambas obras importadas** con los `_conAprobado.xlsx`.
- Levantar DB + backend si hace falta (igual que test-ui: `docker compose up -d` en la raíz; el
  backend usa `backend/.env` → `localhost:5434`).
- Si la DB no tiene las obras, importarlas primero (vía la UI `/catalogo/importar` o llamando a
  `importApuXlsx` con cada `_conAprobado.xlsx`).

Correr (desde `backend/`):
```bash
cd backend
npx tsx scripts/validate-parser.ts            # ambas obras
npx tsx scripts/validate-parser.ts GDR3760    # una sola
npx tsx scripts/validate-parser.ts CH2171
```

## Cómo leer / reportar

- `✓ <categoría>: N/N OK` → coincide dentro de tolerancia.
- `✗ … difieren / faltan en DB / sobran en DB` → seguido de hasta 8 ejemplos
  `✗ <item> [<campo>] excel=… ≠ db=…`. Reportá esos ejemplos textualmente.
- Las líneas `Σ …: excel=… db=… ✓/✗` son los totales (lo primero que mira el usuario).
- Reportá también el aviso de ítems repetidos si aparece.

Si algo da `✗`, distinguí: ¿es un bug del parser/import (corregir en `apu-import.service.ts`),
un dato podrido en el Excel de origen (corregir en la fuente / `inject-aprobado.ts`), o un
desfasaje porque la obra no se re-importó tras un cambio? Proponé el fix concreto.

## Sección "Sanity" — interpretá, no auto-falles

La comparación Excel⟷DB cuadra perfecto incluso con datos absurdos (si el Excel dice 8192 escaleras,
la DB también). Por eso hay una sección **Sanity** que NO compara contra el Excel: marca candidatos
para que **vos (Claude) los interpretes con criterio del rubro**. No son errores automáticos.

Qué emite y cómo razonarlo:
- **Top insumos por monto (% del total):** mirá si alguno está desproporcionado *para lo que es*.
  La clave es **unidad + precio unitario + magnitud**, no el número solo:
  - Unidades baratas y a granel (ladrillos, cemento, arena, tornillos, bocas) **pueden** ser
    cantidades enormes → un millón de ladrillos es plausible.
  - Ítems caros y discretos (escaleras, equipos, aberturas, artefactos) en cantidades enormes son
    **sospechosos** → un millón de escaleras no.
  - Una sola categoría de MO que sea, p.ej., >40% del costo total de la obra: puede ser real (obra
    intensiva en mano de obra) pero vale señalarlo para revisión humana.
- **💥 costo por unidad de partida explosivo** (≥$20M por UNA unidad): es el patrón del bug Escalera
  (cant/ud × precio absurdo). Casi siempre es un dato podrido (insumo o cantidad mal en la composición).
- **Concentración (1 insumo ≥90% de una partida):** normal cuando la partida ES un subcontrato o una
  MO única (Sereno, Supervisión, "Arista en yeso", apuntalamiento). Sospechoso si es una partida que
  debería tener varios insumos (un material caro comiéndose una tarea de albañilería).

Reportá tu lectura: por cada candidato, "tiene sentido porque…" o "revisar: …". El objetivo es que un
número raro pase solo si es explicable por la naturaleza del insumo.

## Estado de referencia (2026-05-30, datos correctos)

Con ambas obras recién importadas, el resultado esperado es **todo ✓**:
- GDR: generador 183/183, aprobado 191/191 (Σ PV $1.345.752.968), cronograma 621/621.
- CH: generador 187/187, aprobado 173/173 (Σ PV $1.540.623.004), cronograma 780/780, + aviso de
  11 ítems repetidos (24.01–24.09, 25.01–25.02).

Si te aparta de esto, hay algo nuevo que revisar.
