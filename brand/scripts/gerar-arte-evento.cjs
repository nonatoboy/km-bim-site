// Gera as artes de divulgação de um evento a partir de brand/eventos/{slug}/evento.json:
//   arte-site.png       1200x627  (campo "Arte de divulgação" do painel; também serve para post do LinkedIn)
//   arte-quadrada.png   1080x1080 (feed do LinkedIn/Instagram, WhatsApp)
//   arte-stories.png    1080x1920 (stories e status do WhatsApp)
// Uso: node brand/scripts/gerar-arte-evento.cjs brand/eventos/{slug}/evento.json
//
// evento.json: { "slug", "tipo", "titulo", "subtitulo"?, "inicio", "fim", "local", "palestrante", "preco"? }
//   inicio/fim em ISO com fuso, ex.: "2026-11-12T19:00:00-03:00"; preco vazio ou 0 = gratuito.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');

const arquivo = process.argv[2];
if (!arquivo) { console.error('Uso: node brand/scripts/gerar-arte-evento.cjs brand/eventos/{slug}/evento.json'); process.exit(1); }
const ev = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
const pasta = path.dirname(path.resolve(arquivo));
const raiz = path.join(__dirname, '..', '..');

const fonte = (arq) => fs.readFileSync(path.join(raiz, 'node_modules/@fontsource', arq)).toString('base64');
const fontes = `
@font-face{font-family:Saira;src:url(data:font/woff2;base64,${fonte('saira/files/saira-latin-800-normal.woff2')}) format('woff2');font-weight:800}
@font-face{font-family:Saira;src:url(data:font/woff2;base64,${fonte('saira/files/saira-latin-600-normal.woff2')}) format('woff2');font-weight:600}
@font-face{font-family:Plex;src:url(data:font/woff2;base64,${fonte('ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2')}) format('woff2');font-weight:400}
@font-face{font-family:Mono;src:url(data:font/woff2;base64,${fonte('ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2')}) format('woff2');font-weight:500}`;
const logo = fs.readFileSync(path.join(raiz, 'brand/logo/km-bim-horizontal-negativo.svg'), 'utf8');

const TIPOS = { webinar: 'Webinar', treinamento: 'Treinamento', roda_conversa: 'Roda de conversa', workshop: 'Workshop', outro: 'Evento' };
const fmt = (iso, o) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', ...o }).format(new Date(iso));
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const dia = fmt(ev.inicio, { day: '2-digit' });
const mes = fmt(ev.inicio, { month: 'short' }).replace('.', '').toUpperCase();
const semana = fmt(ev.inicio, { weekday: 'long' });
const horario = `${fmt(ev.inicio, { hour: '2-digit', minute: '2-digit' })} às ${fmt(ev.fim, { hour: '2-digit', minute: '2-digit' })}`;
const preco = !ev.preco ? 'Gratuito' : `R$ ${Number(ev.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const link = `kmbim.com.br/eventos/${ev.slug}`;

// Pista em perspectiva (assinatura visual da marca), desenhada para cada formato.
function pista(W, H, vx, vy) {
  const linhas = Array.from({ length: 15 }, (_, i) => `<line x1="${vx}" y1="${vy}" x2="${vx - W * 1.4 + i * W * 0.2}" y2="${H}"/>`).join('');
  const hz = [0.3, 0.45, 0.65, 0.9].map((f) => vy + (H - vy) * f).map((y) => `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke-dasharray="2 8"/>`).join('');
  const marcas = [[0.72, 1, 0.022], [0.46, 0.6, 0.014], [0.27, 0.36, 0.009], [0.14, 0.19, 0.006]]
    .map(([a, b, w]) => { const ya = vy + (H - vy) * a, yb = vy + (H - vy) * b, ww = W * w;
      return `<polygon points="${vx - ww},${yb} ${vx + ww},${yb} ${vx + ww * 0.7},${ya} ${vx - ww * 0.7},${ya}" fill="#F2A33A"/>`; }).join('');
  return `<svg class="pista" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <g stroke="#2E4A55" stroke-width="1.2" fill="none">${linhas}${hz}</g>
    <polygon points="${vx - W * 0.42},${H} ${vx - W * 0.05},${H} ${vx - 3},${vy + 10} ${vx - 8},${vy + 10}" fill="#24404B"/>
    <polygon points="${vx + W * 0.05},${H} ${vx + W * 0.42},${H} ${vx + 8},${vy + 10} ${vx + 3},${vy + 10}" fill="#24404B"/>
    ${marcas}</svg>`;
}

function arte(W, H, l) {
  return `<!doctype html><style>${fontes}
  html,body{margin:0}*{box-sizing:border-box}
  .a{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#1C2A31;color:#EEF3F4;font-family:Plex,sans-serif}
  .pista{position:absolute;inset:0;opacity:.9}
  .veu{position:absolute;inset:0;background:${l.veu}}
  .barra{position:absolute;left:0;right:0;bottom:0;height:${l.barra}px;background:#F2A33A}
  .c{position:absolute;inset:${l.pad}px;display:flex;flex-direction:column;gap:${l.gap}px}
  .logo svg{height:${l.logo}px;width:auto;display:block}
  .tipo{align-self:flex-start;font:500 ${l.tipo}px Mono,monospace;letter-spacing:.16em;text-transform:uppercase;color:#1C2A31;background:#1BA8B8;padding:${l.tipo * 0.45}px ${l.tipo * 0.9}px;border-radius:4px}
  h1{margin:0;font:800 ${l.titulo}px/1.04 Saira,sans-serif;max-width:${l.larguraTitulo}px;text-wrap:balance}
  .sub{margin:0;font:400 ${l.sub}px/1.35 Plex,sans-serif;color:#B9C8CD;max-width:${l.larguraTitulo}px}
  .info{display:flex;gap:${l.gap}px;align-items:center;margin-top:auto}
  .data{display:grid;place-items:center;width:${l.data}px;height:${l.data * 1.08}px;background:#F2A33A;color:#1C2A31;border-radius:8px;flex:none}
  .data b{font:800 ${l.data * 0.46}px/1 Saira,sans-serif}.data span{font:500 ${l.data * 0.17}px Mono,monospace;letter-spacing:.12em}
  .det{display:grid;gap:${l.gap * 0.2}px;font-size:${l.det}px}.det strong{font:600 ${l.det * 1.08}px Saira,sans-serif}
  .det .m{font:500 ${l.det * 0.8}px Mono,monospace;color:#F2A33A;letter-spacing:.06em}
  .link{font:500 ${l.link}px Mono,monospace;color:#EEF3F4;padding-top:${l.gap * 0.6}px;border-top:1px solid #2E4A55}
  .link b{color:#F2A33A;font-weight:500}
  </style><div class="a">${pista(W, H, l.vx, l.vy)}<div class="veu"></div><div class="barra"></div>
  <div class="c"><div class="logo">${logo}</div>
    <span class="tipo">${esc(TIPOS[ev.tipo] ?? 'Evento')} · ${esc(preco)}</span>
    <h1>${esc(ev.titulo)}</h1>${ev.subtitulo ? `<p class="sub">${esc(ev.subtitulo)}</p>` : ''}
    <div class="info"><div class="data"><b>${dia}</b><span>${mes}</span></div>
      <div class="det"><strong>${esc(semana)}, ${horario}</strong><span>${esc(ev.local)} · com ${esc(ev.palestrante)}</span><span class="m">HORÁRIO DE BRASÍLIA</span></div></div>
    <div class="link">Inscrições: <b>${esc(link)}</b></div></div></div>`;
}

const formatos = [
  ['arte-site.png', 1200, 627, { pad: 56, gap: 18, logo: 52, tipo: 15, titulo: 50, sub: 20, larguraTitulo: 760, data: 92, det: 19, link: 17, barra: 8, vx: 960, vy: 40,
    veu: 'linear-gradient(90deg,#1C2A31 52%,rgba(28,42,49,.55) 75%,rgba(28,42,49,.2))' }],
  ['arte-quadrada.png', 1080, 1080, { pad: 72, gap: 26, logo: 64, tipo: 18, titulo: 74, sub: 26, larguraTitulo: 920, data: 120, det: 25, link: 22, barra: 12, vx: 760, vy: 300,
    veu: 'linear-gradient(180deg,#1C2A31 38%,rgba(28,42,49,.6) 62%,rgba(28,42,49,.85))' }],
  ['arte-stories.png', 1080, 1920, { pad: 90, gap: 34, logo: 76, tipo: 22, titulo: 96, sub: 32, larguraTitulo: 900, data: 150, det: 30, link: 27, barra: 16, vx: 540, vy: 760,
    veu: 'linear-gradient(180deg,#1C2A31 34%,rgba(28,42,49,.55) 55%,rgba(28,42,49,.9) 85%)' }],
];

(async () => {
  const b = await chromium.launch();
  for (const [nome, w, h, l] of formatos) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.setContent(arte(w, h, l)); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(pasta, nome) }); await p.close();
    console.log('✓', path.join(path.relative(raiz, pasta), nome));
  }
  await b.close();
})();
