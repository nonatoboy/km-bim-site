// Exporta PNGs dos SVGs de brand/logo usando o Chromium do Playwright.
// Uso: node brand/scripts/exportar-png.cjs
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const dir = path.join(__dirname, '..', 'logo'); const out = path.join(__dirname, '..', 'png');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.svg'))) {
    const svg = fs.readFileSync(path.join(dir, f), 'utf8');
    const [, w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
    const escalas = f.includes('icone') ? [512, 180, 32] : [Math.round(w * 4)];
    for (const largura of escalas) {
      const alt = Math.round(largura * h / w);
      await p.setViewportSize({ width: largura, height: alt });
      await p.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${largura}px;height:${alt}px}</style>${svg}`);
      const nome = f.replace('.svg', escalas.length > 1 ? `-${largura}.png` : '.png');
      await p.screenshot({ path: path.join(out, nome), omitBackground: true });
    }
  }
  await b.close();
})();
