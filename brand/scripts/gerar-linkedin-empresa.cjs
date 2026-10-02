// Gera logo (400x400) e capa (1128x191) da página da empresa no LinkedIn em brand/linkedin/.
// Uso: node brand/scripts/gerar-linkedin-empresa.cjs
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const raiz = path.join(__dirname, '..', '..');
const fonte = (arq) => fs.readFileSync(path.join(raiz, 'node_modules/@fontsource', arq)).toString('base64');
const fontes = `
@font-face{font-family:Saira;src:url(data:font/woff2;base64,${fonte('saira/files/saira-latin-800-normal.woff2')}) format('woff2');font-weight:800}
@font-face{font-family:Saira;src:url(data:font/woff2;base64,${fonte('saira/files/saira-latin-600-normal.woff2')}) format('woff2');font-weight:600}
@font-face{font-family:Plex;src:url(data:font/woff2;base64,${fonte('ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2')}) format('woff2');font-weight:400}
@font-face{font-family:Mono;src:url(data:font/woff2;base64,${fonte('ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2')}) format('woff2');font-weight:500}`;
const vertical = fs.readFileSync(path.join(raiz, 'brand/logo/km-bim-vertical-negativo.svg'), 'utf8');

// Logo: versão vertical negativa sobre grafite, com margem para o recorte do LinkedIn.
const logo = `<!doctype html><style>html,body{margin:0}.l{width:400px;height:400px;background:#1C2A31;display:grid;place-items:center}
.l svg{width:300px;height:auto}</style><div class="l">${vertical}</div>`;

// Capa: pista em perspectiva no centro, mensagem à direita. O logo da página cobre o canto inferior esquerdo.
const W = 1128, H = 191, vx = 470, vy = 22;
const linhas = Array.from({ length: 13 }, (_, i) => `<line x1="${vx}" y1="${vy}" x2="${-300 + i * 140}" y2="${H + 20}"/>`).join('');
const horizontais = [50, 80, 120, 175].map((y) => `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke-dasharray="2 7"/>`).join('');
const marcas = [[150, 191, 4.5], [105, 128, 2.8], [78, 90, 1.8], [62, 68, 1.1]]
  .map(([a, b, w]) => `<polygon points="${vx - w},${b} ${vx + w},${b} ${vx + w * 0.7},${a} ${vx - w * 0.7},${a}" fill="#F2A33A"/>`).join('');
const capa = `<!doctype html><style>${fontes}
html,body{margin:0}.c{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#1C2A31}
svg{position:absolute;inset:0}.v{position:absolute;inset:0;background:linear-gradient(90deg,rgba(28,42,49,0) 52%,rgba(28,42,49,.9) 60%,#1C2A31 66%)}
.t{position:absolute;right:48px;top:0;bottom:0;width:400px;display:flex;flex-direction:column;justify-content:center;gap:6px;color:#EEF3F4}
.r{font:500 11px Mono,monospace;letter-spacing:.14em;text-transform:uppercase;color:#F2A33A}
h1{margin:0;font:800 34px/1.05 Saira,sans-serif}p{margin:0;font:400 14px/1.4 Plex,sans-serif;color:#B9C8CD}
</style><div class="c"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<g stroke="#2E4A55" stroke-width="1" fill="none">${linhas}${horizontais}</g>
<polygon points="${vx - 190},${H} ${vx - 22},${H} ${vx - 2},${vy + 18} ${vx - 6},${vy + 18}" fill="#2F5563"/>
<polygon points="${vx + 22},${H} ${vx + 190},${H} ${vx + 6},${vy + 18} ${vx + 2},${vy + 18}" fill="#2F5563"/>
<rect x="${vx - 95}" y="${vy + 30}" width="190" height="10" rx="2" fill="#1BA8B8"/>
<rect x="${vx - 75}" y="${vy + 40}" width="9" height="7" fill="#1BA8B8"/><rect x="${vx + 66}" y="${vy + 40}" width="9" height="7" fill="#1BA8B8"/>
${marcas}</svg><div class="v"></div>
<div class="t"><span class="r">Consultoria BIM · AEC</span><h1>Conhecimento que constrói.</h1>
<p>BIM aplicado a projeto, obra e gestão de dados · kmbim.com.br</p></div></div>`;

(async () => {
  const b = await chromium.launch();
  const tarefas = [[logo, 400, 400, 'km-bim-linkedin-empresa-logo.png'], [capa, W, H, 'km-bim-linkedin-empresa-capa.png'], [capa, W, H, 'km-bim-linkedin-empresa-capa@2x.png', 2]];
  for (const [html, w, h, nome, escala = 1] of tarefas) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: escala });
    await p.setContent(html); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(raiz, 'brand/linkedin', nome) }); await p.close();
  }
  await b.close();
})();
