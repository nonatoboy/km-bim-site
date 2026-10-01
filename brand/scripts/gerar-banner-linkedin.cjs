// Gera o banner do perfil pessoal no LinkedIn (1584x396) em brand/linkedin/.
// Uso: node brand/scripts/gerar-banner-linkedin.cjs
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const raiz = path.join(__dirname, '..', '..');
const fonte = (arq) => fs.readFileSync(path.join(raiz, 'node_modules/@fontsource', arq)).toString('base64');
const saira8 = fonte('saira/files/saira-latin-800-normal.woff2');
const saira6 = fonte('saira/files/saira-latin-600-normal.woff2');
const plex4 = fonte('ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2');
const mono5 = fonte('ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2');
const logo = fs.readFileSync(path.join(raiz, 'brand/logo/km-bim-horizontal-negativo.svg'), 'utf8');

const W = 1584, H = 396;
// Pista em perspectiva com ponto de fuga no horizonte, à direita do centro.
const vx = 590, vy = 64;
const linhas = Array.from({ length: 15 }, (_, i) => {
  const x = -400 + i * 170;
  return `<line x1="${vx}" y1="${vy}" x2="${x}" y2="${H + 40}" />`;
}).join('');
const horizontais = [110, 150, 205, 280, 380].map((y) => `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke-dasharray="2 8" />`).join('');
const marcas = [[300, 396, 7], [220, 262, 4.6], [175, 196, 3], [140, 154, 2], [118, 126, 1.3]]
  .map(([a, b, w]) => `<polygon points="${vx - w},${b} ${vx + w},${b} ${vx + w * 0.7},${a} ${vx - w * 0.7},${a}" fill="#F2A33A"/>`).join('');

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Saira;src:url(data:font/woff2;base64,${saira8}) format('woff2');font-weight:800}
@font-face{font-family:Saira;src:url(data:font/woff2;base64,${saira6}) format('woff2');font-weight:600}
@font-face{font-family:Plex;src:url(data:font/woff2;base64,${plex4}) format('woff2');font-weight:400}
@font-face{font-family:Mono;src:url(data:font/woff2;base64,${mono5}) format('woff2');font-weight:500}
html,body{margin:0}
.b{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#1C2A31}
.b svg.fundo{position:absolute;inset:0}
.texto{position:absolute;right:72px;top:0;bottom:0;width:640px;display:flex;flex-direction:column;justify-content:center;gap:14px;color:#EEF3F4}
.rot{font:500 15px Mono,monospace;letter-spacing:.14em;text-transform:uppercase;color:#F2A33A}
h1{margin:0;font:800 58px/1.02 Saira,sans-serif;letter-spacing:-.01em}
p{margin:0;font:400 21px/1.4 Plex,sans-serif;color:#B9C8CD}
.rodape{display:flex;align-items:center;gap:22px;margin-top:10px}
.rodape svg{height:44px;width:auto}
.rodape span{font:600 20px Saira,sans-serif;color:#EEF3F4;padding-left:22px;border-left:2px solid #34474F}
.vinheta{position:absolute;inset:0;background:linear-gradient(90deg,rgba(28,42,49,0) 50%,rgba(28,42,49,.9) 58%,#1C2A31 64%)}
</style>
<div class="b">
  <svg class="fundo" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <g stroke="#2E4A55" stroke-width="1.2" fill="none">${linhas}${horizontais}</g>
    <polygon points="${vx - 330},${H} ${vx - 40},${H} ${vx - 3},${vy + 30} ${vx - 9},${vy + 30}" fill="#2F5563"/>
    <polygon points="${vx + 40},${H} ${vx + 330},${H} ${vx + 9},${vy + 30} ${vx + 3},${vy + 30}" fill="#2F5563"/>
    <rect x="${vx - 150}" y="${vy + 52}" width="300" height="16" rx="3" fill="#1BA8B8"/>
    <rect x="${vx - 118}" y="${vy + 68}" width="14" height="11" fill="#1BA8B8"/>
    <rect x="${vx + 104}" y="${vy + 68}" width="14" height="11" fill="#1BA8B8"/>
    ${marcas}
  </svg>
  <div class="vinheta"></div>
  <div class="texto">
    <span class="rot">Consultoria BIM · AEC</span>
    <h1>Conhecimento que constrói.</h1>
    <p>Implantação BIM, coordenação de projetos, planejamento 4D/5D e integração de dados para construtoras, incorporadoras e projetistas.</p>
    <div class="rodape">${logo}<span>kmbim.com.br</span></div>
  </div>
</div>`;

(async () => {
  const b = await chromium.launch();
  for (const escala of [1, 2]) {
    const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: escala });
    await p.setContent(html);
    await p.waitForTimeout(300);
    const nome = escala === 1 ? 'km-bim-linkedin-banner.png' : 'km-bim-linkedin-banner@2x.png';
    await p.screenshot({ path: path.join(raiz, 'brand/linkedin', nome) });
    await p.close();
  }
  await b.close();
})();
