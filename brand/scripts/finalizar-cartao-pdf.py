"""Ajusta o PDF do cartão ao gabarito da Printi (96 × 54 mm com 3 mm de sangria) e converte para CMYK.

Uso: python3 finalizar-cartao-pdf.py entrada-rgb.pdf saida.pdf
Requer: pymupdf (pip install pymupdf) e Ghostscript (gs).
"""
import subprocess, sys, tempfile, os
import pymupdf

MM = 72 / 25.4
LARG, ALT, SANGRIA = 96 * MM, 54 * MM, 3 * MM

entrada, saida = sys.argv[1], sys.argv[2]
origem = pymupdf.open(entrada)
exato = pymupdf.open()
for i in range(len(origem)):
    pg = exato.new_page(width=LARG, height=ALT)
    pg.show_pdf_page(pg.rect, origem, i)  # encaixa no tamanho exato (diferença < 0,2 mm)
tmp = os.path.join(tempfile.gettempdir(), 'km-bim-cartao-exato.pdf')
exato.save(tmp)

cmyk = os.path.join(tempfile.gettempdir(), 'km-bim-cartao-cmyk.pdf')
subprocess.run(['gs', '-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=pdfwrite',
                '-dPDFSETTINGS=/prepress', '-dEmbedAllFonts=true', '-dSubsetFonts=true',
                '-sColorConversionStrategy=CMYK', '-sProcessColorModel=DeviceCMYK',
                '-dCompatibilityLevel=1.4', f'-sOutputFile={cmyk}', tmp], check=True)

final = pymupdf.open(cmyk)
for pg in final:
    mb = pg.mediabox  # o Ghostscript arredonda o tamanho para pontos inteiros
    pg.set_bleedbox(mb)
    pg.set_trimbox(pymupdf.Rect(mb.x0 + SANGRIA, mb.y0 + SANGRIA, mb.x1 - SANGRIA, mb.y1 - SANGRIA))
final.save(saida, garbage=3, deflate=True)
print('PDF do cartão:', saida, f'{len(final)} páginas, 96 × 54 mm, CMYK')
