# Guía de Setup — Proyecto Migración Resumen de Obra
## Arquinering S.R.L.

---

## PASO 1 — Crear la carpeta del proyecto en tu computadora

Abrí el **Explorador de Windows** y navegá a donde querés guardar el proyecto.
Se recomienda `C:\Users\TuNombre\Documents\` o donde tengas tus proyectos.

Creá esta estructura de carpetas (podés copiar y pegar en la barra de direcciones
del Explorador para llegar a cada lugar y crear las subcarpetas):

```
arquinering-migracion\
├── archivos\
│   ├── fuente\          ← Acá van los archivos ORIGINALES (solo lectura)
│   ├── referencia\      ← Acá van los archivos MIGRADOS que sirven de modelo
│   └── output\          ← Acá Claude Code guarda los archivos que genera
├── scripts\             ← Scripts Python (ya están incluidos)
├── docs\                ← Documentación (Playbook, Manuales)
└── logs\                ← Logs de sesiones
```

**Forma rápida de crear todo desde PowerShell:**
Abrí PowerShell (buscar "PowerShell" en el menú Inicio) y pegá esto:

```powershell
$base = "$env:USERPROFILE\Documents\arquinering-migracion"
New-Item -ItemType Directory -Force -Path "$base\archivos\fuente"
New-Item -ItemType Directory -Force -Path "$base\archivos\referencia"
New-Item -ItemType Directory -Force -Path "$base\archivos\output"
New-Item -ItemType Directory -Force -Path "$base\scripts"
New-Item -ItemType Directory -Force -Path "$base\docs"
New-Item -ItemType Directory -Force -Path "$base\logs"
Write-Host "✅ Carpetas creadas en: $base"
```

---

## PASO 2 — Copiar los archivos del proyecto

### Archivos que van en `archivos\fuente\` (originales, NO modificar)

| Archivo | Descripción |
|---------|-------------|
| `CH_2171_Pres_02.xlsx` | Presupuesto CH Chivilcoy (fuente de cantidades) |
| `ARQING_APU_0625.xlsx` | APU junio 2025 (referencia precios CH) |
| `ARQING_APU_1224.xlsx` | APU diciembre 2024 (referencia precios GDR) |
| `GDR_Prev_02_JP.xlsx` | Presupuesto GDR legacy |
| `GDR_3760__Resumen_de_Obra_6may.xlsx` | Resumen de Obra GDR en formato legacy |

### Archivos que van en `archivos\referencia\` (modelos, NO modificar)

| Archivo | Descripción |
|---------|-------------|
| `GDR_3760_Resumen_de_Obra_v8.xlsx` | Resumen de Obra GDR **migrado** — referencia maestra |
| `APU_Unificado_GDR3760_VF_6.xlsx` | APU Unificado GDR (fórmulas modelo) |
| `APU_Unificado_CH2171_v5_1.xlsx` | APU Unificado CH (en proceso) |

### Archivos que van en `scripts\`

Los scripts `recalc.py` y `utils.py` ya están incluidos en esta carpeta.
No es necesario copiar nada extra aquí.

### Archivos que van en `docs\`

Copiar los documentos de referencia:
- `Playbook_Migracion_v1.1.md` (o .docx si está en ese formato)
- Cualquier otro manual que tengas

### Archivos que van en la raíz del proyecto (ya incluidos)

- `CLAUDE.md` — El contexto de arranque para Claude Code ✅

---

## PASO 3 — Instalar Python y openpyxl

Si ya tenés Python instalado, saltá al punto 3.2.

### 3.1 Instalar Python

1. Ir a https://www.python.org/downloads/
2. Descargar la versión más reciente (Python 3.11 o superior)
3. En el instalador, **marcar la casilla "Add Python to PATH"** antes de instalar
4. Completar la instalación con las opciones por defecto

### 3.2 Instalar openpyxl

Abrí PowerShell y ejecutá:

```powershell
pip install openpyxl
```

Verificar que funcionó:
```powershell
python -c "import openpyxl; print('openpyxl OK, versión:', openpyxl.__version__)"
```

Debe mostrar algo como: `openpyxl OK, versión: 3.1.x`

---

## PASO 4 — Instalar VS Code y la extensión Claude Code

### 4.1 Instalar VS Code

Si no lo tenés:
1. Ir a https://code.visualstudio.com/
2. Descargar e instalar (opciones por defecto)

### 4.2 Instalar la extensión Claude Code

1. Abrir VS Code
2. Click en el ícono de extensiones en la barra izquierda (o `Ctrl+Shift+X`)
3. Buscar "Claude" en el buscador
4. Instalar la extensión oficial de Anthropic

---

## PASO 5 — Abrir el proyecto en VS Code

### Opción A — Desde el menú de VS Code
1. Abrir VS Code
2. `Archivo` → `Abrir carpeta...`
3. Navegar hasta `arquinering-migracion\` y seleccionarla
4. Click en "Seleccionar carpeta"

### Opción B — Desde PowerShell
```powershell
cd "$env:USERPROFILE\Documents\arquinering-migracion"
code .
```

---

## PASO 6 — Verificar que Claude Code lee el proyecto

1. En VS Code, abrí el panel de Claude Code (ícono en la barra lateral)
2. En el chat, escribí:
   ```
   Leé el archivo CLAUDE.md y confirmame el objetivo del proyecto
   y los 3 principios técnicos no negociables.
   ```
3. Claude Code debe responder mencionando:
   - Migración de Resumen de Obra al formato v8
   - Formula-pure (sin valores pegados)
   - Sin macros
   - Excel 2016+ / batch saves con recalc.py

Si responde correctamente, el proyecto está configurado y listo para trabajar.

---

## PASO 7 — Test de recalc.py

Para confirmar que el script funciona, ejecutar desde PowerShell:

```powershell
cd "$env:USERPROFILE\Documents\arquinering-migracion"
python scripts/recalc.py archivos/referencia/GDR_3760_Resumen_de_Obra_v8.xlsx
```

Debe mostrar:
```
🔍 Verificando: GDR_3760_Resumen_de_Obra_v8.xlsx
============================================================
📊 Total celdas escaneadas: X,XXX
📐 Fórmulas detectadas:     XXX

✅ 0 errores de fórmula — archivo listo para continuar
```

---

## Estructura final esperada

```
arquinering-migracion\
├── CLAUDE.md                                    ← Contexto de arranque
├── archivos\
│   ├── fuente\
│   │   ├── CH_2171_Pres_02.xlsx
│   │   ├── ARQING_APU_0625.xlsx
│   │   ├── ARQING_APU_1224.xlsx
│   │   ├── GDR_Prev_02_JP.xlsx
│   │   └── GDR_3760__Resumen_de_Obra_6may.xlsx
│   ├── referencia\
│   │   ├── GDR_3760_Resumen_de_Obra_v8.xlsx     ← REFERENCIA MAESTRA
│   │   ├── APU_Unificado_GDR3760_VF_6.xlsx
│   │   └── APU_Unificado_CH2171_v5_1.xlsx
│   └── output\                                  ← vacío al inicio
├── scripts\
│   ├── recalc.py
│   └── utils.py
├── docs\
│   └── [manuales y playbook]
└── logs\
    ├── pendientes.md
    └── sesion_YYYY-MM-DD.md                     ← template
```

---

## Resolución de problemas comunes

**"python no se reconoce como comando"**
→ Python no fue agregado al PATH. Desinstalar y reinstalar marcando "Add Python to PATH".

**"No module named openpyxl"**
→ Ejecutar `pip install openpyxl` en PowerShell.

**Claude Code no encuentra el CLAUDE.md**
→ Verificar que abriste la CARPETA `arquinering-migracion` en VS Code,
  no un archivo individual. `Archivo` → `Abrir carpeta...`

**recalc.py muestra errores en el archivo de referencia GDR**
→ Es posible que el archivo necesite ser abierto y guardado desde Excel primero
  para que los valores calculados queden grabados. Abrir en Excel → `Ctrl+S` → cerrar.
