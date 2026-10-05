// Gera o cartão de visita (PDF para gráfica + PNGs de prévia) e os fundos de tela do Teams.
// Uso: node brand/scripts/gerar-cartao-teams.cjs
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const raiz = path.join(__dirname, '..', '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
const b64 = (arq) => fs.readFileSync(path.join(raiz, 'node_modules/@fontsource', arq)).toString('base64');
const fontes = `
@font-face{font-family:Saira;src:url(data:font/woff2;base64,${b64('saira/files/saira-latin-800-normal.woff2')}) format('woff2');font-weight:800}
@font-face{font-family:Saira;src:url(data:font/woff2;base64,${b64('saira/files/saira-latin-600-normal.woff2')}) format('woff2');font-weight:600}
@font-face{font-family:Plex;src:url(data:font/woff2;base64,${b64('ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2')}) format('woff2');font-weight:400}
@font-face{font-family:Plex;src:url(data:font/woff2;base64,${b64('ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2')}) format('woff2');font-weight:600}
@font-face{font-family:Mono;src:url(data:font/woff2;base64,${b64('ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2')}) format('woff2');font-weight:500}`;
const verticalNeg = ler('brand/logo/km-bim-vertical-negativo.svg');
const horizontalNeg = ler('brand/logo/km-bim-horizontal-negativo.svg');
const horizontalPos = ler('brand/logo/km-bim-horizontal-positivo.svg');
const simbolo = ler('brand/logo/km-bim-simbolo-negativo.svg');
const qr = ler('brand/cartao/qr-kmbim.svg');

// ---------------------------------------------------------------- cartão
// Gabarito Printi: 90 × 48 mm + 3 mm de sangria em cada lado = 96 × 54 mm. Conteúdo a 3 mm ou mais do corte (6 mm da borda do arquivo).
const frente = `<section class="pg frente">
  <div class="logo">${verticalNeg}</div>
  <p class="tag">Conhecimento que constrói.</p>
</section>`;
const verso = `<section class="pg verso">
  <div class="dados">
    <p class="nome">Marcelo Nonato Santos</p>
    <p class="cargo">Sócio proprietário · Consultor BIM</p>
    <p class="linha">+55 11 99820-8140</p>
    <p class="linha">contato@kmbim.com.br</p>
    <p class="linha forte">kmbim.com.br</p>
  </div>
  <div class="qr">${qr}<span>kmbim.com.br</span></div>
  <div class="marca">${horizontalPos}</div>
</section>`;
const cartaoCss = `${fontes}
@page{size:96mm 54mm;margin:0}
html,body{margin:0}
.pg{position:relative;width:96mm;height:54mm;overflow:hidden;page-break-after:always;box-sizing:border-box}
.frente{background:#1C2A31;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2mm;padding-bottom:4mm}
.frente .logo svg{width:35mm;height:auto;display:block}
.frente .tag{margin:0;font:600 7.5pt Saira,sans-serif;letter-spacing:.04em;color:#F2A33A}
/* faixa de 6 mm: 3 mm visíveis após o corte + 3 mm de sangria */
.frente::after{content:"";position:absolute;left:0;right:0;bottom:0;height:6mm;background:#0B5563}
.verso{background:#FFFFFF;padding:7mm 7mm 7mm 7mm}
.verso::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6.5mm;background:#F2A33A}
.dados{position:absolute;left:10.5mm;top:8mm;display:flex;flex-direction:column;gap:.4mm;color:#1C2A31}
.nome{margin:0 0 .3mm;font:800 11pt/1.1 Saira,sans-serif}
.cargo{margin:0 0 2.6mm;font:600 7pt Plex,sans-serif;color:#0B5563}
.linha{margin:0;font:400 7pt/1.45 Plex,sans-serif;color:#3C4C53}
.forte{font-weight:600;color:#0B5563}
.qr{position:absolute;right:8mm;top:8mm;display:flex;flex-direction:column;align-items:center;gap:1mm}
.qr svg{width:16mm;height:16mm;display:block}
.qr span{font:500 5pt Mono,monospace;color:#56666D}
.marca{position:absolute;right:8mm;bottom:7mm}
.marca svg{height:7mm;width:auto;display:block}`;
const cartaoHtml = `<!doctype html><meta charset="utf-8"><style>${cartaoCss}</style>${frente}${verso}`;

// ---------------------------------------------------------------- Teams
// 1920 × 1080. O centro fica livre para a pessoa; marca no alto à esquerda, site embaixo à esquerda.
// O Teams mostra a sua própria imagem espelhada só para você; os participantes veem o texto correto.
const W = 1920, H = 1080;
function pista(vx, vy, cor, corLinha, alturaViga = 18) {
  const linhas = Array.from({ length: 17 }, (_, i) => `<line x1="${vx}" y1="${vy}" x2="${-500 + i * 180}" y2="${H + 60}"/>`).join('');
  const horiz = [vy + 70, vy + 140, vy + 240, vy + 400, vy + 640].map((y) => `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke-dasharray="3 10"/>`).join('');
  const marcas = [[vy + 560, H, 11], [vy + 360, vy + 440, 7], [vy + 240, vy + 285, 4.6], [vy + 165, vy + 190, 3], [vy + 115, vy + 130, 2]]
    .map(([a, b, w]) => `<polygon points="${vx - w},${b} ${vx + w},${b} ${vx + w * 0.7},${a} ${vx - w * 0.7},${a}" fill="#F2A33A"/>`).join('');
  return `<svg class="fundo" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <g stroke="${corLinha}" stroke-width="1.2" fill="none">${linhas}${horiz}</g>
    <polygon points="${vx - 560},${H} ${vx - 60},${H} ${vx - 3},${vy + 30} ${vx - 10},${vy + 30}" fill="${cor}"/>
    <polygon points="${vx + 60},${H} ${vx + 560},${H} ${vx + 10},${vy + 30} ${vx + 3},${vy + 30}" fill="${cor}"/>
    <rect x="${vx - 260}" y="${vy + 60}" width="520" height="${alturaViga}" rx="4" fill="#1BA8B8"/>
    <rect x="${vx - 205}" y="${vy + 60 + alturaViga}" width="20" height="16" fill="#1BA8B8"/>
    <rect x="${vx + 185}" y="${vy + 60 + alturaViga}" width="20" height="16" fill="#1BA8B8"/>
    ${marcas}</svg>`;
}
const teamsCss = `${fontes}
html,body{margin:0}.t{position:relative;width:${W}px;height:${H}px;overflow:hidden}
.fundo{position:absolute;inset:0}
.marca{position:absolute;left:72px;top:64px}.marca svg{height:96px;width:auto;display:block}
.tag{position:absolute;left:76px;top:178px;font:600 26px Saira,sans-serif;letter-spacing:.02em}
.site{position:absolute;left:76px;bottom:64px;font:500 22px Mono,monospace;letter-spacing:.06em}
.escuro{background:#1C2A31}.escuro .tag{color:#F2A33A}.escuro .site{color:#A9BBC1}
.claro{background:#EEF3F4}.claro .tag{color:#B86E0A}.claro .site{color:#56666D}`;
const teamsEscuro = `<!doctype html><meta charset="utf-8"><style>${teamsCss}</style>
<div class="t escuro">${pista(1480, 300, '#26414B', '#2A434D')}
<div class="marca">${horizontalNeg}</div><div class="tag">Conhecimento que constrói.</div><div class="site">kmbim.com.br</div></div>`;
const teamsClaro = `<!doctype html><meta charset="utf-8"><style>${teamsCss}</style>
<div class="t claro">${pista(1480, 300, '#DCE6E8', '#D3DEE1')}
<div class="marca">${horizontalPos}</div><div class="tag">Conhecimento que constrói.</div><div class="site">kmbim.com.br</div></div>`;

(async () => {
  const b = await chromium.launch();
  // PDF do cartão (2 páginas: frente e verso) em RGB; depois ajustado e convertido para CMYK
  let p = await b.newPage();
  await p.setContent(cartaoHtml); await p.waitForTimeout(300);
  const rgb = path.join(require('os').tmpdir(), 'km-bim-cartao-rgb.pdf');
  await p.pdf({ path: rgb, width: '96mm', height: '54mm', printBackground: true, preferCSSPageSize: true, pageRanges: '1-2' });
  // Tamanho exato 96 × 54 mm, caixas de corte e sangria, e conversão para CMYK (Ghostscript + PyMuPDF)
  require('child_process').execFileSync('python3', [path.join(__dirname, 'finalizar-cartao-pdf.py'), rgb, path.join(raiz, 'brand/cartao/km-bim-cartao-visita.pdf')], { stdio: 'inherit' });
  // Prévias PNG (300 dpi) de cada face
  const mmPx = 300 / 25.4;
  await p.setViewportSize({ width: Math.round(96 * 3.7795), height: Math.round(56 * 3.7795) * 2 });
  for (const [face, nome] of [[frente, 'frente'], [verso, 'verso']]) {
    // Cada face renderizada sozinha, para a prévia não pegar borda da outra
    const p2 = await b.newPage({ viewport: { width: 363, height: 204 }, deviceScaleFactor: mmPx / 3.7795 });
    await p2.setContent(`<!doctype html><meta charset="utf-8"><style>${cartaoCss}</style>${face}`); await p2.waitForTimeout(300);
    await (await p2.$('.pg')).screenshot({ path: path.join(raiz, `brand/cartao/km-bim-cartao-${nome}.png`) });
    await p2.close();
  }
  await p.close();
  for (const [html, nome] of [[teamsEscuro, 'km-bim-teams-escuro.png'], [teamsClaro, 'km-bim-teams-claro.png']]) {
    p = await b.newPage({ viewport: { width: W, height: H } });
    await p.setContent(html); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(raiz, 'brand/teams', nome) }); await p.close();
  }
  await b.close();
})();
