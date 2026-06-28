"""
excel_recalc.py — Recalcula y persiste valores cacheados via Excel COM.

PROBLEMA QUE RESUELVE: openpyxl escribe fórmulas pero NO los valores calculados.
El dashboard lee valores cacheados (openpyxl data_only=True); un archivo guardado
solo por openpyxl queda con todas las celdas de fórmula vacías al leerlas así.

Este helper abre el .xlsx en Excel (instalado en la máquina), fuerza un recálculo
completo y guarda — repoblando los valores cacheados — para que el dashboard y
recalc.py vean datos frescos sin que haya que abrir Excel a mano.

Uso:
    python scripts/excel_recalc.py <ruta.xlsx> [<ruta2.xlsx> ...]

O como módulo:
    from scripts.excel_recalc import recalc_save
    recalc_save("dashboard/data/GDR_3760_Resumen_de_Obra_v8.xlsx")

Requiere: pywin32 + Microsoft Excel instalado (Windows).
"""
import os
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass


def recalc_save(path):
    """Abre `path` en Excel, recalcula completo y guarda. Devuelve la ruta abs."""
    import win32com.client as win32

    path = os.path.abspath(path)
    if not os.path.exists(path):
        raise FileNotFoundError(path)

    excel = win32.DispatchEx("Excel.Application")  # instancia aislada
    excel.Visible = False
    excel.DisplayAlerts = False
    excel.AskToUpdateLinks = False
    try:
        wb = excel.Workbooks.Open(path, UpdateLinks=0, ReadOnly=False)
        excel.CalculateFullRebuild()   # recálculo completo de todo el libro
        wb.Save()                       # persiste fórmulas + valores cacheados
        wb.Close(SaveChanges=False)
    finally:
        excel.Quit()
    return path


def main(argv):
    if len(argv) < 2:
        print("Uso: python scripts/excel_recalc.py <ruta.xlsx> [<ruta2.xlsx> ...]")
        return 1
    for p in argv[1:]:
        print(f"↻ Recalculando en Excel: {p}")
        recalc_save(p)
        print(f"  ✓ guardado con valores cacheados")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
