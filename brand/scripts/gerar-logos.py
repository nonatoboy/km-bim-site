"""Gera os arquivos SVG da marca KM BIM (conceito A · Via).

Tipografia Saira convertida em curvas, para os SVGs não dependerem de fonte instalada.
Uso: python3 brand/scripts/gerar-logos.py brand/fontes  (requer: pip install fonttools)
"""
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen

FONTES = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "fontes"
SAIDA = Path(__file__).resolve().parent.parent

CORES = {
    "grafite": "#1C2A31", "petroleo": "#0B5563", "ciano": "#1BA8B8",
    "ambar": "#F2A33A", "nevoa": "#EEF3F4", "branco": "#FFFFFF",
}

def texto_em_curvas(ttf, texto, tamanho, x, y_base, espaco_extra=0.0, largura_alvo=None):
    """Retorna (path_d, largura) do texto posicionado com linha de base em y_base."""
    fonte = TTFont(ttf)
    gs = fonte.getGlyphSet()
    cmap = fonte.getBestCmap()
    upm = fonte["head"].unitsPerEm
    esc = tamanho / upm
    nomes = [cmap[ord(c)] for c in texto]
    avancos = [gs[n].width * esc for n in nomes]
    natural = sum(avancos) + espaco_extra * (len(nomes) - 1)
    if largura_alvo is not None and len(nomes) > 1:
        espaco_extra = espaco_extra + (largura_alvo - natural) / (len(nomes) - 1)
    pen = SVGPathPen(gs)
    cx = x
    for n, a in zip(nomes, avancos):
        tp = TransformPen(pen, (esc, 0, 0, -esc, cx, y_base))
        gs[n].draw(tp)
        cx += a + espaco_extra
    return pen.getCommands(), cx - espaco_extra - x

def simbolo(principal, destaque):
    """Pista em perspectiva (ponto de fuga em 60,4), viga de viaduto e marcas quilométricas. Caixa 120x120."""
    return f"""<g>
    <rect x="10" y="30" width="100" height="9" rx="2" fill="{principal}"/>
    <rect x="22" y="39" width="8" height="6" fill="{principal}"/>
    <rect x="90" y="39" width="8" height="6" fill="{principal}"/>
    <polygon points="16,112 50,112 55.9,48 42.1,48" fill="{principal}"/>
    <polygon points="70,112 104,112 77.9,48 64.1,48" fill="{principal}"/>
    <polygon points="51.9,24 58.1,24 59.3,12 56.7,12" fill="{principal}"/>
    <polygon points="61.9,24 68.1,24 63.3,12 60.7,12" fill="{principal}"/>
    <polygon points="57.5,112 62.5,112 62.1,98 57.9,98" fill="{destaque}"/>
    <polygon points="58.2,90 61.8,90 61.5,79 58.5,79" fill="{destaque}"/>
    <polygon points="58.8,72 61.2,72 61,64 59,64" fill="{destaque}"/>
    <polygon points="59.3,58 60.7,58 60.6,52 59.4,52" fill="{destaque}"/>
  </g>"""

def svg(w, h, corpo, titulo, fundo=None):
    bg = f'<rect width="{w}" height="{h}" fill="{fundo}"/>' if fundo else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img">'
            f"<title>{titulo}</title>{bg}{corpo}</svg>\n")

F800 = FONTES / "saira-800.ttf"
F600 = FONTES / "saira-600.ttf"

def vertical(c_simb, c_km, c_bim, c_sub, c_dest, fundo=None):
    # "KM " e "BIM" separados para colorir diferente, largura total 200 centrada em 120
    d_km, w_km = texto_em_curvas(F800, "KM", 48, 0, 0)
    d_bim, w_bim = texto_em_curvas(F800, "BIM", 48, 0, 0)
    gap = 12
    total = w_km + gap + w_bim
    x0 = 120 - total / 2
    d_km, _ = texto_em_curvas(F800, "KM", 48, x0, 168)
    d_bim, _ = texto_em_curvas(F800, "BIM", 48, x0 + w_km + gap, 168)
    d_sub, _ = texto_em_curvas(F600, "CONSULTORIA", 15, x0 + 2, 194, largura_alvo=total - 4)
    corpo = (f'<g transform="translate(55 0) scale(1.0833)">{simbolo(c_simb, c_dest)}</g>'
             f'<path d="{d_km}" fill="{c_km}"/><path d="{d_bim}" fill="{c_bim}"/>'
             f'<path d="{d_sub}" fill="{c_sub}"/>')
    return svg(240, 206, corpo, "KM BIM Consultoria", fundo)

def horizontal(c_simb, c_km, c_bim, c_sub, c_dest, fundo=None):
    d_km, w_km = texto_em_curvas(F800, "KM", 44, 0, 0)
    d_bim, w_bim = texto_em_curvas(F800, "BIM", 44, 0, 0)
    gap = 11
    total = w_km + gap + w_bim
    x0 = 104
    d_km, _ = texto_em_curvas(F800, "KM", 44, x0, 58)
    d_bim, _ = texto_em_curvas(F800, "BIM", 44, x0 + w_km + gap, 58)
    d_sub, _ = texto_em_curvas(F600, "CONSULTORIA", 14, x0 + 2, 84, largura_alvo=total - 4)
    corpo = (f'<g transform="translate(4 4) scale(0.8)">{simbolo(c_simb, c_dest)}</g>'
             f'<path d="{d_km}" fill="{c_km}"/><path d="{d_bim}" fill="{c_bim}"/>'
             f'<path d="{d_sub}" fill="{c_sub}"/>')
    w = int(x0 + total + 8)
    return svg(w, 100, corpo, "KM BIM Consultoria", fundo)

def icone(c_simb, c_dest, fundo, raio=22):
    corpo = (f'<rect width="120" height="120" rx="{raio}" fill="{fundo}"/>'
             f'<g transform="translate(12 10) scale(0.8)">{simbolo(c_simb, c_dest)}</g>')
    return svg(120, 120, corpo, "KM BIM")

C = CORES
variantes = {
    # nome: (simbolo, KM, BIM, CONSULTORIA, destaque)
    "positivo": (C["grafite"], C["grafite"], C["petroleo"], "#5A6B72", C["ambar"]),
    "negativo": (C["nevoa"], C["nevoa"], C["ciano"], "#A9BBC1", C["ambar"]),
    "mono-escuro": (C["grafite"],) * 4 + (C["grafite"],),
    "mono-branco": (C["branco"],) * 4 + (C["branco"],),
}
out = SAIDA / "logo"
out.mkdir(exist_ok=True)
for nome, cores in variantes.items():
    (out / f"km-bim-vertical-{nome}.svg").write_text(vertical(*cores))
    (out / f"km-bim-horizontal-{nome}.svg").write_text(horizontal(*cores))
(out / "km-bim-simbolo-positivo.svg").write_text(svg(120, 120, simbolo(C["grafite"], C["ambar"]), "KM BIM"))
(out / "km-bim-simbolo-negativo.svg").write_text(svg(120, 120, simbolo(C["nevoa"], C["ambar"]), "KM BIM"))
(out / "km-bim-icone.svg").write_text(icone(C["nevoa"], C["ambar"], C["petroleo"]))
print("ok", sorted(p.name for p in out.iterdir()))
