// Gera public/img/og-kmbim.png (imagem de compartilhamento 1200x630).
// Uso: node brand/scripts/gerar-og.cjs
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const raiz = path.join(__dirname, '..', '..');
const logo = fs.readFileSync(path.join(raiz, 'brand/logo/km-bim-vertical-negativo.svg'), 'utf8');
const saira = fs.readFileSync(path.join(raiz, 'node_modules/@fontsource/saira/files/saira-latin-700-normal.woff2')).toString('base64');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(`<style>
    @font-face{font-family:S;src:url(data:font/woff2;base64,${saira}) format('woff2');font-weight:700}
    body{margin:0;width:1200px;height:630px;background:#1C2A31;display:grid;grid-template-columns:460px 1fr;align-items:center;font-family:S,sans-serif}
    .l{display:grid;place-items:center;height:100%;border-right:2px solid #2E3E46}.l svg{width:340px;height:auto}
    .r{padding:0 72px;color:#EEF3F4}.r p{margin:0;font-size:64px;line-height:1.05}.r span{display:block;margin-top:28px;font-size:28px;color:#F2A33A;letter-spacing:.04em}
  </style><div class="l">${logo}</div><div class="r"><p>Conhecimento que constrói.</p><span>kmbim.com.br</span></div>`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(raiz, 'public/img/og-kmbim.png') });
  await b.close();
})();
