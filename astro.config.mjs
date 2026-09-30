import { defineConfig } from 'astro/config';

// Site 100% estático: a Hostinger (plano Single Web Hosting) só serve arquivos.
export default defineConfig({
  site: 'https://kmbim.com.br',
  output: 'static',
  build: { format: 'directory' },
  trailingSlash: 'ignore',
});
