// Carrega o conteúdo do site no momento do build.
// Com o Supabase configurado, lê o banco; sem ele (desenvolvimento local), usa o conteúdo inicial do repositório.
import inicial from '../data/conteudo-inicial.json';
import { supabase, supabaseConfigurado } from './supabase';
import type { Conteudo } from './tipos';

let cache: Promise<Conteudo> | null = null;

const colunasEvento = 'id, slug, titulo, tipo, modalidade, resumo, descricao, publico_alvo, palestrante, local, inicio, fim, vagas, inscricoes_abertas, inscricoes_ate, preco, imagem, solucao_relacionada, ordem';

export function carregarConteudo(): Promise<Conteudo> {
  cache ??= supabaseConfigurado ? doBanco() : Promise.resolve({ eventos: [], ...inicial } as Conteudo);
  return cache;
}

async function doBanco(): Promise<Conteudo> {
  const db = supabase();
  const lista = async <T>(tabela: string, colunas: string, filtro?: (q: any) => any): Promise<T[]> => {
    let q = db.from(tabela).select(colunas).order('ordem');
    if (filtro) q = filtro(q);
    const { data, error } = await q;
    // Falha o build em vez de publicar o site com seções vazias.
    if (error) throw new Error(`Supabase: erro ao ler ${tabela}: ${error.message}`);
    return data as T[];
  };

  const { data: cfg, error } = await db.from('configuracoes').select('chave, valor');
  if (error) throw new Error(`Supabase: erro ao ler configuracoes: ${error.message}`);

  const [categorias, solucoes, parceiros, palestras, publicacoes, reconhecimentos, depoimentos, eventos] = await Promise.all([
    lista<Conteudo['categorias'][number]>('categorias', 'slug, nome, descricao, ordem'),
    lista<Conteudo['solucoes'][number]>('solucoes', 'slug, titulo, resumo, descricao, entregaveis, publico, categoria, modalidade, destaque, ordem'),
    lista<Conteudo['parceiros'][number]>('parceiros', 'nome, descricao, logo, site, solucoes, ordem'),
    lista<Conteudo['palestras'][number]>('palestras', 'titulo, evento, ano, cidade, link, imagem, ordem', (q) => q.order('ano', { ascending: false, nullsFirst: false })),
    lista<Conteudo['publicacoes'][number]>('publicacoes', 'titulo, veiculo, ano, link, ordem'),
    lista<Conteudo['reconhecimentos'][number]>('reconhecimentos', 'tipo, titulo, descricao, ano, ordem'),
    lista<Conteudo['depoimentos'][number]>('depoimentos', 'autor, cargo, empresa, texto, foto, ordem'),
    // Só colunas públicas (o link de acesso não é legível pelo site)
    // Tolerante: enquanto a migration de eventos não for aplicada, o site publica sem a seção.
    // Sem a migration de eventos não listados, lê sem a coluna e trata todos como listados.
    lista<Conteudo['eventos'][number]>('eventos', `${colunasEvento}, listado`, (q) => q.order('inicio'))
      .catch(() => lista<Conteudo['eventos'][number]>('eventos', colunasEvento, (q) => q.order('inicio'))
        .then((eventos) => eventos.map((e) => ({ ...e, listado: true }))))
      .catch((e) => { console.warn(`[eventos] ${e.message}`); return []; }),
  ]);

  return {
    // Chaves ausentes no banco caem no texto inicial.
    configuracoes: { ...inicial.configuracoes, ...Object.fromEntries((cfg ?? []).map((c) => [c.chave, c.valor])) },
    categorias, solucoes, parceiros, palestras, publicacoes, reconhecimentos, depoimentos, eventos,
  };
}
