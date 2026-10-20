# -*- coding: utf-8 -*-
"""Amplía assets/plantilla_ficha_terreno.xlsx (ya sembrada con tokens):
  - Fondos a rendir: +2 filas (Alarife líquido, Arriendo de caballos c/IVA) antes de «Otro».
  - Actividades: +6 filas (de 8 a 14).
Se ejecuta UNA vez sobre la plantilla; si ya está ampliada, no hace nada.

Uso: python ampliar_plantilla_ficha.py [plantilla.xlsx]
"""
import sys, copy
from pathlib import Path
import openpyxl
from openpyxl.worksheet.cell_range import CellRange

RAIZ = Path(__file__).resolve().parents[1]
RUTA = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "assets" / "plantilla_ficha_terreno.xlsx"


def insertar(ws, idx, n, fila_modelo, extender=()):
    """Inserta n filas antes de idx, desplazando merges, alturas y área de impresión;
    copia el estilo de fila_modelo (ya desplazada si corresponde) a las filas nuevas."""
    alturas = {r: ws.row_dimensions[r].height for r in range(idx, ws.max_row + 1)}
    merges = [CellRange(str(m)) for m in ws.merged_cells.ranges]
    for m in list(ws.merged_cells.ranges):
        ws.merged_cells.remove(m)
    ws.insert_rows(idx, n)
    for m in merges:
        if m.min_row >= idx:
            m.shift(row_shift=n)
        elif m.max_row >= idx:
            m.expand(down=n)
        ws.merged_cells.add(m)
    for r in range(ws.max_row, idx - 1, -1):
        ws.row_dimensions[r + n].height = alturas.get(r)
    modelo = fila_modelo if fila_modelo < idx else fila_modelo + n
    for k in range(n):
        r = idx + k
        ws.row_dimensions[r].height = ws.row_dimensions[modelo].height or 22.5
        for c in range(1, 21):
            src = ws.cell(modelo, c)
            dst = ws.cell(r, c)
            if src.has_style:
                dst._style = copy.copy(src._style)
    for rango in extender:   # merges nuevos por fila: (col_ini, col_fin)
        for k in range(n):
            ws.merge_cells(start_row=idx + k, start_column=rango[0], end_row=idx + k, end_column=rango[1])


wb = openpyxl.load_workbook(RUTA)
ws = wb.worksheets[0]
if str(ws["C41"].value or "").startswith("Alarife"):
    print("La plantilla ya está ampliada."); sys.exit(0)

# 1) Fondos: 2 filas nuevas en 41-42 (antes de «Otro»); modelo = fila 40 (Peajes)
insertar(ws, 41, 2, 40, extender=[(3, 4), (5, 6), (7, 16)])
ws["C41"] = "Alarife (líquido)"; ws["E41"] = "@@FONDOS_ALARIFE@@"; ws["G41"] = "@@FONDOS_DET_ALARIFE@@"
ws["C42"] = "Arriendo de caballos (c/ IVA)"; ws["E42"] = "@@FONDOS_CABALLOS@@"; ws["G42"] = "@@FONDOS_DET_CABALLOS@@"

# 2) Actividades: 8 -> 14. Ahora la tabla va de 47 a 54 (+2): se insertan 6 filas en 55; modelo = fila 53
insertar(ws, 55, 6, 53, extender=[(5, 16)])
for i in range(9, 15):
    r = 46 + i       # 55..60
    ws.cell(r, 3).value = i
    ws.cell(r, 4).value = f"@@ACT{i}_DIAS@@"
    ws.cell(r, 5).value = f"@@ACT{i}_DESC@@"
# la etiqueta «Detalle de actividades» (B47:B54) se extiende a B47:B60
for m in list(ws.merged_cells.ranges):
    if m.min_col == 2 and m.min_row == 47:
        ws.merged_cells.remove(m)
ws.merge_cells("B47:B60")

# área de impresión
if ws.print_area:
    ws.print_area = "B1:P%d" % (63 + 8)
wb.save(RUTA)
print("Plantilla ampliada:", RUTA)
