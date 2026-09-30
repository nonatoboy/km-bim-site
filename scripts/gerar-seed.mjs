// Gera supabase/seed.sql a partir de src/data/conteudo-inicial.json.
// Uso: npm run seed  → depois cole o arquivo no SQL Editor do Supabase.
import { readFileSync, writeFileSync } from 'node:fs';

const dados = JSON.parse(readFileSync(new URL('../src/data/conteudo-inicial.json', import.meta.url), 'utf8'));

const lit = (v) => {
  if (v === null || v === undefined || v === '') return v === '' ? "''" : 'null';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return `array[${v.map(lit).join(', ')}]::text[]`;
  return `'${String(v).replaceAll("'", "''")}'`;
};

const insert = (tabela, linhas, colunas, conflito) => {
  if (!linhas.length) return `-- ${tabela}: sem registros iniciais\n`;
  const valores = linhas.map((l) => `  (${colunas.map((c) => lit(l[c])).join(', ')})`).join(',\n');
  const acao = conflito ? `on conflict (${conflito}) do nothing` : '';
  return `insert into public.${tabela} (${colunas.join(', ')}) values\n${valores}\n${acao};\n`;
};

const config = Object.entries(dados.configuracoes).map(([chave, valor]) => ({ chave, valor }));

const sql = [
  '-- Gerado por scripts/gerar-seed.mjs. Não edite à mão.',
  '-- Carga inicial de conteúdo. Pode ser executado mais de uma vez sem duplicar configurações, categorias e soluções.',
  insert('configuracoes', config, ['chave', 'valor'], 'chave'),
  insert('categorias', dados.categorias, ['slug', 'nome', 'descricao', 'ordem'], 'slug'),
  insert('solucoes', dados.solucoes, ['slug', 'titulo', 'resumo', 'descricao', 'entregaveis', 'publico', 'categoria', 'modalidade', 'destaque', 'ordem'], 'slug'),
  '-- As tabelas abaixo não têm chave natural: rode este bloco só uma vez.',
  insert('parceiros', dados.parceiros, ['nome', 'descricao', 'logo', 'site', 'solucoes', 'ordem']),
  insert('palestras', dados.palestras, ['titulo', 'evento', 'ano', 'cidade', 'link', 'imagem', 'ordem']),
  insert('publicacoes', dados.publicacoes, ['titulo', 'veiculo', 'ano', 'link', 'ordem']),
  insert('reconhecimentos', dados.reconhecimentos, ['tipo', 'titulo', 'descricao', 'ano', 'ordem']),
  insert('depoimentos', dados.depoimentos, ['autor', 'cargo', 'empresa', 'texto', 'foto', 'autorizado', 'ordem']),
].join('\n');

writeFileSync(new URL('../supabase/seed.sql', import.meta.url), sql);
console.log('supabase/seed.sql gerado');
