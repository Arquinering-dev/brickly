# Design System — Industrial Integrity (Arquinering Dashboard)

> Generado desde Google Stitch. Este archivo es la fuente de verdad de diseño
> para el dashboard. Claude Code debe respetar TODOS estos tokens al implementar
> o iterar cualquier componente visual.

---

## Módulos del diseño

El diseño cubre 5 módulos/pantallas:

| Módulo | Carpeta |
|--------|---------|
| Dashboard de Control de Gestión | `design/dashboard_de_control_de_gesti_n/` |
| Control Presupuestario y Desvíos | `design/control_presupuestario_y_desv_os/` |
| Flujo de Caja | `design/flujo_de_caja_control_de_gesti_n/` |
| Avance de Obra y Certificaciones | `design/avance_de_obra_y_certificaciones/` |
| Reporte Ejecutivo para Fideicomiso | `design/reporte_ejecutivo_para_fideicomiso/` |

Cada carpeta contiene:
- `screen.png` → captura visual del módulo (referencia de layout)
- `code.html` → código HTML generado por Stitch (referencia de estructura)

---

## Brand & Personalidad

**Nombre del sistema:** Industrial Integrity  
**Personalidad:** Precisión, Autoridad, Integridad Estructural  
**Dirección estética:** Corporate / Modern con Systematic Minimalism  
**Sensación objetivo:** Control room sofisticado, no decorativo — todo es intencional y orientado al dato.

---

## Paleta de colores

### Colores principales
| Token | Hex | Uso |
|-------|-----|-----|
| `primary` | `#091426` | Sidebar, navegación principal, headers — el "ancla" visual |
| `primary-container` | `#1e293b` | Elementos estructurales secundarios |
| `secondary` | `#9d4300` | Naranja construcción — CTAs de alta prioridad, warnings |
| `secondary-container` | `#fd761a` | Highlights de estado crítico, alertas de obra |
| `tertiary-on-container` | `#00a472` | Verde sage — tendencias positivas, presupuesto OK |
| `error` | `#ba1a1a` | Crimson — desvíos negativos, alertas inmediatas |

### Superficies y fondos
| Token | Hex | Uso |
|-------|-----|-----|
| `background` | `#f8f9ff` | Fondo base de la aplicación |
| `surface-container-lowest` | `#ffffff` | Cards y contenedores de datos (nivel 1) |
| `surface-container-low` | `#eff4ff` | Contenedores secundarios |
| `surface-container` | `#e5eeff` | Contenedores terciarios |
| `on-surface` | `#0b1c30` | Texto principal |
| `on-surface-variant` | `#45474c` | Texto secundario |
| `outline-variant` | `#c5c6cd` | Bordes de cards y separadores |

### Semáforo de estados
| Estado | Color | Uso |
|--------|-------|-----|
| ✅ En tiempo / OK | `#00a472` (sage green) | Avance normal, presupuesto dentro de rango |
| ⚠️ Pendiente / Alerta | `#fd761a` (naranja) | Desvío moderado, item pendiente |
| 🔴 Crítico / Bloqueado | `#ba1a1a` (crimson) | Desvío grave, alerta inmediata |

---

## Tipografía

**Fuente principal:** Inter (todos los textos de interfaz)  
**Fuente de datos:** JetBrains Mono (números en tablas, etiquetas de metadatos)

| Nivel | Font | Size | Weight | Uso |
|-------|------|------|--------|-----|
| `display-lg` | Inter | 48px | 700 | Títulos de pantalla principal |
| `headline-lg` | Inter | 32px | 600 | Headers de sección |
| `headline-md` | Inter | 24px | 600 | Subtítulos de módulo |
| `headline-sm` | Inter | 18px | 600 | Headers de card |
| `body-lg` | Inter | 16px | 400 | Texto descriptivo |
| `body-md` | Inter | 14px | 400 | Texto de tabla, contenido |
| `body-sm` | Inter | 12px | 400 | Texto secundario, hints |
| `label-md` | JetBrains Mono | 12px | 500 | Etiquetas numéricas, tags de estado |
| `label-sm` | JetBrains Mono | 10px | 500 | Metadatos (SITE ID, WBS CODE) |

**Reglas:**
- Números en tablas y KPIs → siempre JetBrains Mono para facilitar escaneo vertical
- Etiquetas de metadatos (WBS, ID de ítem) → UPPERCASE + JetBrains Mono
- Headers → Inter 600-700 para anclar módulos de datos

---

## Layout y espaciado

**Grid:** 12 columnas, centrado en desktop (max 1440px)  
**Gutters:** 16px  
**Grid base:** 4px (todo el espaciado es múltiplo de 4)

| Token | Valor | Equivalente |
|-------|-------|-------------|
| `xs` | 4px | Separación mínima entre elementos inline |
| `sm` | 8px | Padding interno de chips y tags |
| `md` | 16px | Padding estándar de cards y gutters |
| `lg` | 24px | Separación entre secciones, margin de página |
| `xl` | 32px | Separación entre módulos mayores |

**Breakpoints:**
- Desktop (1440px+): Sidebar fijo, grid completo
- Tablet (768–1439px): Sidebar colapsado a íconos, 8 columnas
- Mobile (<768px): Columna única, navegación inferior

---

## Elevación y profundidad

Sistema tonal (sin sombras pesadas — estética "blueprint"):

| Nivel | Superficie | Implementación |
|-------|-----------|----------------|
| 0 — Fondo | `#f8f9ff` | Base de la aplicación |
| 1 — Cards | `#ffffff` + borde 1px `#c5c6cd` | Superficie principal de datos |
| 2 — Modales | Blanco + sombra `0px 4px 12px rgba(30,41,59,0.08)` | Capas temporales |
| Activo | Borde 1px `#091426` inset | Focus states — sin efectos "flotantes" |

---

## Radios de borde (border-radius)

| Token | Valor | Uso |
|-------|-------|-----|
| `sm` | 2px (0.125rem) | Mínimo — casi cuadrado |
| `DEFAULT` | 4px (0.25rem) | Inputs, botones, cards estándar |
| `md` | 6px (0.375rem) | Cards medianas |
| `lg` | 8px (0.5rem) | Cards grandes |
| `xl` | 12px (0.75rem) | Status pills y chips |
| `full` | 9999px | Badges circulares |

**Regla:** Las barras de progreso y gráficos de barra usan 0–2px de radio para mantener integridad de datos.

---

## Componentes clave

### Botones
| Tipo | Estilo |
|------|--------|
| Primary | Fondo `#091426`, texto blanco |
| Secondary | Transparente, borde `#c5c6cd` |
| Warning | Fondo `#fd761a` (naranja) para acciones críticas de obra |

### Tablas de datos
- Alto de fila: 32px (alta densidad)
- Relleno alterno: filas pares con `#eff4ff`
- Columnas numéricas: JetBrains Mono, alineado a la derecha
- Header: Inter 600, borde inferior 1px

### Barras de progreso
- Fondo: `#c5c6cd` (slate)
- Relleno OK: `#00a472` (verde)
- Relleno retrasado: `#ba1a1a` (crimson)
- Dual-tone: mostrar % ejecutado vs % esperado

### Indicadores de estado
- Punto circular pequeño antes del texto
- Verde `#00a472` = Activo / En tiempo
- Naranja `#fd761a` = Pendiente / Alerta
- Rojo `#ba1a1a` = Detenido / Crítico

### Cards
- Fondo blanco `#ffffff`
- Borde 1px `#c5c6cd`
- Divider 1px bajo el header de la card
- Padding interno: 16px (`md`)

### Gráficos de línea (trend charts)
- Línea principal: `#091426` (navy)
- Línea de referencia/benchmark: `#fd761a` (naranja)
- Area fill: muy baja opacidad (≤10%) o sin fill
- Sin grid pesado — énfasis en la tendencia, no el volumen

### Inputs
- Borde: 1px `#c5c6cd` en reposo
- Borde focus: 1px `#091426`
- Label: encima del campo, estilo `label-md`

---

## Instrucciones de implementación para Claude Code

1. **Importar fuentes desde Google Fonts:**
   ```html
   <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
   ```

2. **Definir CSS variables en `:root`** con todos los tokens de color de este documento antes de escribir cualquier componente.

3. **Consultar las imágenes de referencia** en `design/*/screen.png` para el layout de cada módulo antes de implementarlo.

4. **Consultar el HTML de referencia** en `design/*/code.html` para entender la estructura de componentes — no copiar el HTML directamente, usarlo como referencia de jerarquía.

5. **No usar sombras pesadas.** El sistema de elevación es tonal (capas de color), no de sombra.

6. **Todos los números de KPIs y tablas** deben usar JetBrains Mono.

7. **El sidebar** siempre usa fondo `#091426` (navy oscuro).
