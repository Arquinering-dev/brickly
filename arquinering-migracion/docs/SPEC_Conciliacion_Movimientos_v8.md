# SPEC — Conciliación contra `2_Movimientos` (ingresos y egresos-subcontrato)

> Documento de **diseño** para Claude Code. Define el qué y el porqué del cruce entre los movimientos de Tezamat (`2_Movimientos`) y las dos puntas del control: certificaciones al cliente (ingresos) y subcontratos (egresos). Complementa `HANDOFF_flujo_resumen_v8.md` §3.3, §5 y §10 (punto 6).
> **No es spec de ejecución cerrado:** Claude Code tiene libertad en el *cómo* (columnas/fórmulas/hojas), pero es estricto en el *qué* y en los principios. Debe inspeccionar el archivo real (v8_8) y proponer diseño antes de tocar nada.
> **Estado:** diseño consolidado en chat, junio 2026. Pendiente de ejecución.

---

## 0. Objetivo

Hoy `2_Movimientos` (extracto crudo de Tezamat) **no está ligado** a ningún control: el único "conciliado" es un flag manual Sí/No en `Cert_Facturacion!H` que no apunta a ningún movimiento. Este spec construye el puente:

- **Ingresos:** ligar los cobros de cada certificación (`Cert_*`) con los movimientos de Haber de Tezamat.
- **Egresos-subcontrato:** ligar los pagos a subcontratistas (`2_Subcontratos` maestro) con los movimientos de Debe de Tezamat.
- **Estado de conciliación computado** (no flag manual): conciliado = existe movimiento que matchea por ID + monto.
- Respetar la **regla CAC/CS**: el monto CAC y las cargas sociales suman al movimiento pero **no descuentan saldo** disponible (de la OC-Cliente en ingresos, del contrato en egresos).

---

## 1. Restricción de origen (Tezamat)

Tezamat **solo tiene el campo Observaciones de texto abierto** (`2_Movimientos!E`). No se puede agregar una columna estructurada *en Tezamat*. Por lo tanto:

- La estructura se impone **por convención dentro del string de Observaciones**.
- La columna-clave limpia para el match **se deriva en el Excel** (fórmula), después de volcar el extracto. No es carga manual extra.

> `2_Movimientos!P` ("Observaciones original") parece el respaldo sin editar. Verificar su rol; la convención se aplica sobre `E` (Observaciones editable).

---

## 2. Convención de Observaciones (la genera la herramienta; Karina solo pega)

Formato fijo, tres tokens separados por ` | ` (pipe con espacios — carácter que no aparece en descripciones normales, a diferencia del guion que ya vive dentro de los IDs):

```
{ID} | {TIPO} | {descripción libre}
```

- **Token 1 — ID** (match contra el control):
  - Ingresos: ID de certificación con sufijo fiscal, ej. `CH-OC01-C01-B`.
  - Egresos: ID de subcontrato, ej. `CH-SC-001`.
- **Token 2 — TIPO** (vocabulario cerrado): `BASE` · `CAC` · `ANT` (anticipo) · `CS` (cargas sociales).
- **Token 3 — descripción**: texto libre, no se parsea.

Ejemplos:
```
CH-OC01-C01-B | BASE | Cert 1 estructura
CH-OC01-C01-B | CAC | actualización CAC cert 1
CH-SC-003 | BASE | pago micropilotes avance 2
CH-SC-003 | CAC | CAC pago micropilotes
CH-SC-003 | CS | cargas sociales obreros SC
CH-OC01-ANT | ANT | anticipo OC1
```

**Garantía de disciplina:** el string lo arma la herramienta y Karina lo copia entero (incluido el ` | `). El delimitador y el orden no quedan a criterio de la persona.

---

## 3. Parseo en el Excel (columnas derivadas en `2_Movimientos`)

Agregar columnas **calculadas** (no manuales) al final del rango de `2_Movimientos`, que parsean `E`:

- `mov_id` — token 1: todo lo anterior al primer ` | `. Limpio, para match exacto.
- `mov_tipo` — token 2: entre el primer y segundo ` | `. Normalizar a mayúsculas/trim.
- (la descripción token 3 no necesita columna; no se usa para cálculo.)

Match exacto contra los maestros usa `mov_id`, no el texto completo → un espacio de más en la descripción no rompe nada (el corte es en el primer ` | `).

> Parseo compatible Excel 2016 (FIND/MID/LEFT/SUBSTITUTE; XLOOKUP disponible). Filas sin la convención (movimientos que no son cert ni SC) quedan con `mov_id` vacío y simplemente no matchean — no son error.

---

## 4. Regla de oro: qué descuenta saldo y qué no

| TIPO | ¿Suma al movimiento? | ¿Descuenta saldo disponible? |
|------|----------------------|------------------------------|
| `BASE` | sí | **sí** |
| `ANT` | sí | **sí** (es plata contra el contrato/OC) |
| `CAC` | sí | **no** |
| `CS` (cargas sociales) | sí | **no** |

Aplica simétrico a ingresos (saldo a certificar/cobrar de la OC-Cliente) y egresos (saldo disponible del contrato de subcontrato). El CAC y las CS son reales (entran/salen plata) pero no consumen el presupuesto base aprobado.

---

## 5. Punta INGRESOS — conciliación certificaciones ↔ movimientos de Haber

- Movimientos relevantes: `Haber` (`J`) > 0 con `mov_id` que matchea un `id_cert_fact` (`-B`/`-N`) o `id_cert_madre` del circuito `Cert_*`.
- Cruce: por `mov_id` (= ID certificación) + `mov_tipo`.
  - `BASE` → es el cobro que se compara contra `Cert_Facturacion` / lo certificado.
  - `CAC` → suma como ingreso real pero no descuenta saldo a certificar de la OC.
- **Estado conciliado computado** (reemplaza el flag manual `Cert_Facturacion!H`): una fila de cobro está conciliada si existe en `2_Movimientos` un Haber con `mov_id` = su `id_cert_fact` y se cumple la ecuación de retención (abajo) dentro de la tolerancia de redondeo.
- **Retenciones (los cobros con factura entran NETOS):** el Haber de Tezamat es **menor** que el monto certificado, porque entra neto de retención. La conciliación NO espera igualdad bruto-vs-Haber. Modelo:

  ```
  monto certificado (bruto) = Haber cobrado (neto) + Retención
  ```

  - La **retención se carga como dato** en `Cert_Facturacion!Retención` (columna que ya existe). Karina registra cuánto le retuvieron.
  - El match valida: `Haber (neto) + Retención (cargada) = monto certificado`, dentro de la tolerancia de redondeo.
  - Esto distingue **retención** (plata retenida, ecuación cuadra) de **cobro pendiente/parcial** (falta plata y no hay retención que lo explique → no concilia, queda como saldo a cobrar).
- Cierre del loop: "cobrado vs. pendiente por certificación" cruzando `monto_ars_equiv` de `Cert_Facturacion` (forma final del addendum) contra los Haberes BASE conciliados, considerando la retención como cobrado-pero-retenido (no como pendiente).

---

## 6. Punta EGRESOS — conciliación subcontratos ↔ movimientos de Debe

- Maestro: `2_Subcontratos` (`Contrato#` = `CH-SC-NNN`, `Monto Presup.`, `Ajusta CAC` SI/NO, `% Anticipo`).
- Movimientos relevantes: `Debe` (`I`) > 0 con `mov_id` que matchea un `Contrato#`.
- Cruce por `mov_id` (= ID subcontrato) + `mov_tipo`:
  - `BASE` → pago que descuenta saldo disponible del contrato.
  - `ANT` → anticipo, descuenta.
  - `CAC` → suma egreso pero no descuenta saldo del contrato.
  - `CS` → cargas sociales (obreros del SC dados de alta en nómina de Arquinering), suma egreso pero no descuenta saldo del contrato.
- Control resultante por contrato: `Monto Presup. − Σ(BASE + ANT) = saldo disponible`. Separado: total pagado (incl. CAC y CS) para cash-flow.
- **Alerta** (de decisiones previas): si el saldo disponible se acerca a un umbral (~10%) y la tarea no está terminada, marca para revisar antes de seguir pagando.

> Hoy el tracking de pagos a SC "se deriva fuera del Excel" (inventario v8_7). Este spec lo trae adentro, computado desde `2_Movimientos`.

---

## 7. Decisiones cerradas y puntos a confirmar antes de ejecutar

**Cerradas (en chat, junio 2026):**
- **Retenciones:** los cobros con factura entran **netos**. La retención se **carga como dato** en `Cert_Facturacion!Retención`. Ecuación: `Haber neto + Retención = certificado bruto` (§5).
- **Tolerancia de match de monto:** **tolerancia chica por redondeo** (± unos pocos pesos, absoluta — no porcentual), para absorber centavos de CAC/IVA. No match exacto al centavo.

**A confirmar al inspeccionar el archivo:**
- ¿Estructura de `Cert_Facturacion` se mantiene (solo se agregan fórmulas de cruce y se computa el estado, reusando la columna `Retención` existente) o requiere columnas nuevas? Si NO agrega columnas → actualizar el reader del dashboard una sola vez contra este layout. Si agrega → reevaluar.
- Rol exacto de `2_Movimientos!P` (Observaciones original) vs `E`.

---

## 8. Principios (heredados del proyecto)

- Estricto en el QUÉ (convención, regla CAC/CS, estado computado, dos puntas); libre en el CÓMO.
- Formula-pure, sin macros, Excel 2016+ (XLOOKUP ok). Columna manual nueva en Tezamat: imposible (§1) → todo derivado por fórmula.
- Nada de `delete_rows`/`insert_rows`: columnas/filas nuevas al final del rango.
- No reintroducir doble fuente. Estado de conciliación **computado**, no flag manual persistido.
- Match por columna derivada limpia (`mov_id`), nunca por texto libre completo.
- Un solo `wb.save()` por bloque; `recalc.py` a 0 errores.
- Checkpoint: Claude Code propone diseño (qué reusa/modifica/rehace, columnas y roles) y espera confirmación antes de tocar el archivo.
