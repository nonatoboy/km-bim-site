// Painel administrativo: edita o conteúdo no Supabase e acompanha os pedidos de orçamento.
// Toda a segurança está nas políticas RLS do banco; esta tela só organiza as operações.
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type TipoCampo = 'texto' | 'textoLongo' | 'lista' | 'opcoes' | 'booleano' | 'numero' | 'imagem' | 'pdf' | 'url';
interface Campo { nome: string; rotulo: string; tipo: TipoCampo; opcoes?: [string, string][]; obrigatorio?: boolean; ajuda?: string }
interface Tabela { nome: string; rotulo: string; chave: string; titulo: string; subtitulo?: string; campos: Campo[] }

const categoriasOpcoes: [string, string][] = [];

const TABELAS: Tabela[] = [
  {
    nome: 'solucoes', rotulo: 'Soluções', chave: 'id', titulo: 'titulo', subtitulo: 'categoria',
    campos: [
      { nome: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true },
      { nome: 'slug', rotulo: 'Endereço (slug)', tipo: 'texto', obrigatorio: true, ajuda: 'Letras minúsculas, números e hífens. Vira /solucoes/slug.' },
      { nome: 'categoria', rotulo: 'Etapa', tipo: 'opcoes', opcoes: categoriasOpcoes, obrigatorio: true },
      { nome: 'modalidade', rotulo: 'Modalidade', tipo: 'opcoes', opcoes: [['propria', 'Execução KM BIM'], ['parceiro', 'Com parceiro'], ['mista', 'KM BIM + parceiro']] },
      { nome: 'resumo', rotulo: 'Resumo (card)', tipo: 'textoLongo' },
      { nome: 'descricao', rotulo: 'Descrição completa', tipo: 'textoLongo' },
      { nome: 'entregaveis', rotulo: 'Entregáveis', tipo: 'lista', ajuda: 'Um por linha.' },
      { nome: 'publico', rotulo: 'Para quem é', tipo: 'textoLongo' },
      { nome: 'destaque', rotulo: 'Destacar na página inicial', tipo: 'booleano' },
      { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero' },
      { nome: 'ativo', rotulo: 'Visível no site', tipo: 'booleano' },
    ],
  },
  {
    nome: 'categorias', rotulo: 'Etapas', chave: 'slug', titulo: 'nome',
    campos: [
      { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
      { nome: 'slug', rotulo: 'Identificador (slug)', tipo: 'texto', obrigatorio: true },
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'textoLongo' },
      { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero' },
      { nome: 'ativo', rotulo: 'Visível no site', tipo: 'booleano' },
    ],
  },
  {
    nome: 'parceiros', rotulo: 'Parceiros', chave: 'id', titulo: 'nome',
    campos: [
      { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'textoLongo' },
      { nome: 'logo', rotulo: 'Logotipo', tipo: 'imagem' },
      { nome: 'site', rotulo: 'Site', tipo: 'url' },
      { nome: 'solucoes', rotulo: 'Soluções em que atua (slugs)', tipo: 'lista', ajuda: 'Um slug por linha, ex.: captura-da-realidade' },
      { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero' },
      { nome: 'ativo', rotulo: 'Visível no site', tipo: 'booleano' },
    ],
  },
  {
    nome: 'palestras', rotulo: 'Palestras', chave: 'id', titulo: 'titulo', subtitulo: 'evento',
    campos: [
      { nome: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true },
      { nome: 'evento', rotulo: 'Evento', tipo: 'texto' },
      { nome: 'ano', rotulo: 'Ano', tipo: 'numero' },
      { nome: 'cidade', rotulo: 'Cidade', tipo: 'texto' },
      { nome: 'link', rotulo: 'Link (vídeo ou material)', tipo: 'url' },
      { nome: 'imagem', rotulo: 'Foto', tipo: 'imagem' },
      { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero' },
      { nome: 'ativo', rotulo: 'Visível no site', tipo: 'booleano' },
    ],
  },
  {
    nome: 'publicacoes', rotulo: 'Publicações', chave: 'id', titulo: 'titulo', subtitulo: 'veiculo',
    campos: [
      { nome: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true },
      { nome: 'veiculo', rotulo: 'Veículo ou tipo', tipo: 'texto' },
      { nome: 'ano', rotulo: 'Ano', tipo: 'numero' },
      { nome: 'link', rotulo: 'Arquivo PDF ou link', tipo: 'pdf', ajuda: 'Envie o PDF do artigo ou cole o link de onde ele está publicado.' },
      { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero' },
      { nome: 'ativo', rotulo: 'Visível no site', tipo: 'booleano' },
    ],
  },
  {
    nome: 'reconhecimentos', rotulo: 'Trajetória', chave: 'id', titulo: 'titulo', subtitulo: 'tipo',
    campos: [
      { nome: 'tipo', rotulo: 'Tipo', tipo: 'opcoes', opcoes: [['formacao', 'Formação'], ['certificacao', 'Certificação'], ['atuacao', 'Atuação técnica'], ['premio', 'Prêmio']] },
      { nome: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true },
      { nome: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
      { nome: 'ano', rotulo: 'Ano ou período', tipo: 'texto' },
      { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero' },
      { nome: 'ativo', rotulo: 'Visível no site', tipo: 'booleano' },
    ],
  },
  {
    nome: 'depoimentos', rotulo: 'Depoimentos', chave: 'id', titulo: 'autor', subtitulo: 'empresa',
    campos: [
      { nome: 'autor', rotulo: 'Autor', tipo: 'texto', obrigatorio: true },
      { nome: 'cargo', rotulo: 'Cargo', tipo: 'texto' },
      { nome: 'empresa', rotulo: 'Empresa', tipo: 'texto' },
      { nome: 'texto', rotulo: 'Depoimento', tipo: 'textoLongo', obrigatorio: true },
      { nome: 'foto', rotulo: 'Foto', tipo: 'imagem' },
      { nome: 'autorizado', rotulo: 'Autorização do depoente registrada', tipo: 'booleano', ajuda: 'Sem isso o depoimento não aparece no site.' },
      { nome: 'ordem', rotulo: 'Ordem', tipo: 'numero' },
      { nome: 'ativo', rotulo: 'Visível no site', tipo: 'booleano' },
    ],
  },
];

const ROTULOS_CONFIG: Record<string, string> = {
  tagline: 'Assinatura (tagline)', home_titulo: 'Título da página inicial', home_subtitulo: 'Subtítulo da página inicial',
  sobre_empresa: 'Texto sobre a empresa', socio_nome: 'Nome do sócio', socio_cargo: 'Cargo do sócio', socio_bio: 'Biografia do sócio',
  socio_foto: 'Foto do sócio (URL)', linkedin_url: 'LinkedIn', cnpj: 'CNPJ (rodapé)', aviso_privacidade: 'Aviso de privacidade do formulário',
};

const STATUS: [string, string][] = [['novo', 'Novo'], ['em_analise', 'Em análise'], ['respondido', 'Respondido'], ['arquivado', 'Arquivado']];

const $ = <T extends HTMLElement = HTMLElement>(sel: string, raiz: ParentNode = document) => raiz.querySelector<T>(sel)!;
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

let db: SupabaseClient;
let abaAtual = 'pedidos';

function aviso(msg: string, tipo: 'ok' | 'erro' = 'ok') {
  const el = $('#aviso');
  el.textContent = msg;
  el.dataset.tipo = tipo;
  el.hidden = false;
  clearTimeout((el as any)._t);
  (el as any)._t = setTimeout(() => { el.hidden = true; }, tipo === 'erro' ? 8000 : 3500);
}

export async function iniciarAdmin() {
  db = supabase();
  $('#form-login').addEventListener('submit', entrar);
  $('#sair').addEventListener('click', async () => { await db.auth.signOut(); location.reload(); });
  $('#publicar').addEventListener('click', publicar);
  const { data } = await db.auth.getSession();
  if (data.session) await abrirPainel();
  else $('#login').hidden = false;
}

async function entrar(e: Event) {
  e.preventDefault();
  const email = ($('#login-email') as HTMLInputElement).value.trim();
  const senha = ($('#login-senha') as HTMLInputElement).value;
  const { error } = await db.auth.signInWithPassword({ email, password: senha });
  if (error) { aviso('E-mail ou senha incorretos.', 'erro'); return; }
  await abrirPainel();
}

async function abrirPainel() {
  const { data: admin, error } = await db.rpc('is_admin');
  if (error || !admin) {
    aviso('Este usuário não tem permissão de administrador. Veja o README, seção "Criar seu usuário".', 'erro');
    await db.auth.signOut();
    $('#login').hidden = false;
    return;
  }
  $('#login').hidden = true;
  $('#painel').hidden = false;
  const { data: cats } = await db.from('categorias').select('slug, nome').order('ordem');
  categoriasOpcoes.splice(0, categoriasOpcoes.length, ...(cats ?? []).map((c) => [c.slug, c.nome] as [string, string]));

  const abas: [string, string][] = [['pedidos', 'Pedidos'], ...TABELAS.map((t) => [t.nome, t.rotulo] as [string, string]), ['configuracoes', 'Textos gerais']];
  const nav = $('#abas');
  nav.innerHTML = abas.map(([id, r]) => `<button type="button" data-aba="${id}">${esc(r)}</button>`).join('');
  nav.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-aba]');
    if (b) abrirAba(b.dataset.aba!);
  });
  abrirAba('pedidos');
}

function abrirAba(id: string) {
  abaAtual = id;
  document.querySelectorAll<HTMLButtonElement>('[data-aba]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.aba === id)));
  if (id === 'pedidos') return listarPedidos();
  if (id === 'configuracoes') return listarConfiguracoes();
  listarTabela(TABELAS.find((t) => t.nome === id)!);
}

// ---------------------------------------------------------------- pedidos
async function listarPedidos() {
  const area = $('#area');
  area.innerHTML = '<p class="carregando">Carregando pedidos…</p>';
  const { data, error } = await db.from('pedidos_orcamento').select('*').order('criado_em', { ascending: false }).limit(200);
  if (error) { area.innerHTML = `<p class="erro">${esc(error.message)}</p>`; return; }
  if (!data.length) { area.innerHTML = '<div class="vazio"><h2>Nenhum pedido ainda</h2><p>Os pedidos enviados pelo formulário do site aparecem aqui.</p></div>'; return; }
  const novos = data.filter((p) => p.status === 'novo').length;
  area.innerHTML = `
    <header class="area__cabeca"><h2>Pedidos de orçamento</h2><p>${data.length} pedido(s), ${novos} novo(s)</p></header>
    <div class="pedidos">${data.map((p) => `
      <details class="pedido" data-status="${esc(p.status)}">
        <summary>
          <span class="pedido__status">${esc(STATUS.find(([v]) => v === p.status)?.[1])}</span>
          <strong>${esc(p.empresa)}</strong><span>${esc(p.nome)}</span>
          <time>${new Date(p.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</time>
        </summary>
        <div class="pedido__corpo">
          <dl>
            <dt>E-mail</dt><dd><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></dd>
            <dt>Telefone</dt><dd>${esc(p.telefone) || '—'}</dd>
            <dt>Segmento</dt><dd>${esc(p.segmento) || '—'}</dd>
            <dt>Porte</dt><dd>${esc(p.porte) || '—'}</dd>
            <dt>Cidade/UF</dt><dd>${esc(p.cidade_uf) || '—'}</dd>
            <dt>Fase</dt><dd>${esc(p.fase) || '—'}</dd>
            <dt>Soluções</dt><dd>${(p.solucoes ?? []).map((s: any) => esc(s.titulo ?? s.slug)).join('<br>') || '—'}</dd>
            <dt>Mensagem</dt><dd class="pre">${esc(p.mensagem) || '—'}</dd>
          </dl>
          <form class="pedido__acoes" data-id="${esc(p.id)}">
            <label>Status <select name="status">${STATUS.map(([v, r]) => `<option value="${v}" ${v === p.status ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
            <label>Notas internas <textarea name="notas_internas" rows="3">${esc(p.notas_internas)}</textarea></label>
            <button class="botao botao--primario" type="submit">Salvar</button>
          </form>
        </div>
      </details>`).join('')}
    </div>`;
  area.querySelectorAll<HTMLFormElement>('.pedido__acoes').forEach((f) => f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const { error } = await db.from('pedidos_orcamento').update({ status: fd.get('status'), notas_internas: fd.get('notas_internas') }).eq('id', f.dataset.id!);
    if (error) aviso(error.message, 'erro'); else { aviso('Pedido atualizado.'); listarPedidos(); }
  }));
}

// ---------------------------------------------------------------- textos gerais
async function listarConfiguracoes() {
  const area = $('#area');
  const { data, error } = await db.from('configuracoes').select('chave, valor').order('chave');
  if (error) { area.innerHTML = `<p class="erro">${esc(error.message)}</p>`; return; }
  const ordem = Object.keys(ROTULOS_CONFIG);
  const linhas = [...data].sort((a, b) => (ordem.indexOf(a.chave) + 1 || 99) - (ordem.indexOf(b.chave) + 1 || 99));
  area.innerHTML = `
    <header class="area__cabeca"><h2>Textos gerais</h2><p>Depois de salvar, use "Publicar alterações" para atualizar o site.</p></header>
    <form id="form-config" class="editor">
      ${linhas.map((c) => `<label class="campo"><span>${esc(ROTULOS_CONFIG[c.chave] ?? c.chave)}</span>
        <textarea name="${esc(c.chave)}" rows="${c.valor.length > 90 ? 4 : 1}">${esc(c.valor)}</textarea></label>`).join('')}
      <div class="editor__acoes"><button class="botao botao--primario" type="submit">Salvar textos</button></div>
    </form>`;
  $('#form-config').addEventListener('submit', async (e) => {
    e.preventDefault();
    const linhasNovas = [...new FormData(e.target as HTMLFormElement)].map(([chave, valor]) => ({ chave, valor: String(valor) }));
    const { error } = await db.from('configuracoes').upsert(linhasNovas);
    if (error) aviso(error.message, 'erro'); else aviso('Textos salvos.');
  });
}

// ---------------------------------------------------------------- tabelas de conteúdo
async function listarTabela(t: Tabela) {
  const area = $('#area');
  const { data, error } = await db.from(t.nome).select('*').order('ordem');
  if (error) { area.innerHTML = `<p class="erro">${esc(error.message)}</p>`; return; }
  area.innerHTML = `
    <header class="area__cabeca"><h2>${esc(t.rotulo)}</h2><button type="button" class="botao botao--cta" id="novo">Adicionar</button></header>
    ${data.length ? `<ul class="itens">${data.map((l) => `
      <li><button type="button" data-editar="${esc(l[t.chave])}">
        <strong>${esc(l[t.titulo])}</strong>
        <span>${esc(t.subtitulo ? l[t.subtitulo] : '')}${l.ativo === false ? ' · <em>oculto</em>' : ''}${t.nome === 'depoimentos' && !l.autorizado ? ' · <em>sem autorização</em>' : ''}</span>
      </button></li>`).join('')}</ul>` : '<div class="vazio"><p>Nenhum item cadastrado.</p></div>'}
    <div id="editor"></div>`;
  $('#novo').addEventListener('click', () => editar(t, null));
  area.querySelectorAll<HTMLButtonElement>('[data-editar]').forEach((b) => b.addEventListener('click', () => {
    editar(t, data.find((l) => String(l[t.chave]) === b.dataset.editar) ?? null);
  }));
}

function campoHtml(c: Campo, v: any) {
  const id = `f-${c.nome}`;
  const req = c.obrigatorio ? 'required' : '';
  const ajuda = c.ajuda ? `<small>${esc(c.ajuda)}</small>` : '';
  switch (c.tipo) {
    case 'booleano':
      return `<label class="campo campo--check"><input type="checkbox" id="${id}" name="${c.nome}" ${v ? 'checked' : ''}><span>${esc(c.rotulo)}</span>${ajuda}</label>`;
    case 'textoLongo':
      return `<label class="campo"><span>${esc(c.rotulo)}</span><textarea id="${id}" name="${c.nome}" rows="4" ${req}>${esc(v)}</textarea>${ajuda}</label>`;
    case 'lista':
      return `<label class="campo"><span>${esc(c.rotulo)}</span><textarea id="${id}" name="${c.nome}" rows="4">${esc((v ?? []).join('\n'))}</textarea>${ajuda}</label>`;
    case 'opcoes':
      return `<label class="campo"><span>${esc(c.rotulo)}</span><select id="${id}" name="${c.nome}" ${req}>${(c.opcoes ?? []).map(([o, r]) => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>${ajuda}</label>`;
    case 'numero':
      return `<label class="campo campo--curto"><span>${esc(c.rotulo)}</span><input type="number" id="${id}" name="${c.nome}" value="${esc(v)}"></label>`;
    case 'imagem':
      return `<div class="campo"><label for="${id}">${esc(c.rotulo)}</label>
        <div class="imagem">${v ? `<img src="${esc(v)}" alt="">` : ''}<input id="${id}" name="${c.nome}" value="${esc(v)}" placeholder="URL da imagem">
        <label class="botao botao--contorno imagem__enviar">Enviar arquivo<input type="file" accept="image/*" data-upload="${c.nome}" hidden></label></div></div>`;
    case 'pdf':
      return `<div class="campo"><label for="${id}">${esc(c.rotulo)}</label>
        <div class="imagem imagem--pdf">${v ? `<a href="${esc(v)}" target="_blank" rel="noopener">Abrir</a>` : ''}<input id="${id}" name="${c.nome}" value="${esc(v)}" placeholder="https://…">
        <label class="botao botao--contorno imagem__enviar">Enviar PDF<input type="file" accept="application/pdf" data-upload="${c.nome}" hidden></label></div>${ajuda}</div>`;
    default:
      return `<label class="campo"><span>${esc(c.rotulo)}</span><input type="${c.tipo === 'url' ? 'url' : 'text'}" id="${id}" name="${c.nome}" value="${esc(v)}" ${req}>${ajuda}</label>`;
  }
}

function editar(t: Tabela, linha: Record<string, any> | null) {
  const ed = $('#editor');
  const novo = !linha;
  const padrao: Record<string, any> = { ativo: true, ordem: 0, modalidade: 'propria', tipo: 'formacao', categoria: categoriasOpcoes[0]?.[0] };
  const v = (n: string) => (linha ? linha[n] : padrao[n]);
  ed.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="editor-titulo">
      <form class="editor">
        <header class="editor__cabeca"><h2 id="editor-titulo">${novo ? 'Adicionar' : 'Editar'}: ${esc(t.rotulo)}</h2><button type="button" class="fechar" aria-label="Fechar">×</button></header>
        ${t.campos.map((c) => campoHtml(c, v(c.nome))).join('')}
        <div class="editor__acoes">
          <button class="botao botao--primario" type="submit">Salvar</button>
          ${novo ? '' : '<button class="botao botao--perigo" type="button" data-excluir>Excluir</button>'}
        </div>
        <p class="confirmar" hidden>Excluir definitivamente? Prefira desmarcar "Visível no site" se quiser só esconder.
          <button type="button" class="botao botao--perigo" data-confirmar>Sim, excluir</button></p>
      </form>
    </div>`;
  const form = $<HTMLFormElement>('form', ed);
  const fechar = () => { ed.innerHTML = ''; };
  $('.fechar', ed).addEventListener('click', fechar);
  ed.querySelector('.modal')!.addEventListener('click', (e) => { if (e.target === e.currentTarget) fechar(); });
  (form.querySelector('input, textarea, select') as HTMLElement | null)?.focus();

  form.querySelectorAll<HTMLInputElement>('[data-upload]').forEach((inp) => inp.addEventListener('change', async () => {
    const arq = inp.files?.[0];
    if (!arq) return;
    const caminho = `${t.nome}/${Date.now()}-${arq.name.normalize('NFD').replace(/[^\w.-]+/g, '-').toLowerCase()}`;
    const { error } = await db.storage.from('midia').upload(caminho, arq, { cacheControl: '31536000', upsert: false });
    if (error) { aviso(`Falha no envio: ${error.message}`, 'erro'); return; }
    const url = db.storage.from('midia').getPublicUrl(caminho).data.publicUrl;
    (form.elements.namedItem(inp.dataset.upload!) as HTMLInputElement).value = url;
    aviso('Arquivo enviado. Clique em Salvar para confirmar.');
  }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const dados: Record<string, any> = {};
    for (const c of t.campos) {
      const el = form.elements.namedItem(c.nome) as HTMLInputElement;
      if (c.tipo === 'booleano') dados[c.nome] = el.checked;
      else if (c.tipo === 'numero') dados[c.nome] = el.value === '' ? (c.nome === 'ordem' ? 0 : null) : Number(el.value);
      else if (c.tipo === 'lista') dados[c.nome] = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
      else dados[c.nome] = el.value.trim();
    }
    const q = novo ? db.from(t.nome).insert(dados) : db.from(t.nome).update(dados).eq(t.chave, linha![t.chave]);
    const { error } = await q;
    if (error) { aviso(traduzirErro(error.message), 'erro'); return; }
    aviso('Salvo. Use "Publicar alterações" para atualizar o site.');
    fechar();
    abrirAba(abaAtual);
  });

  form.querySelector('[data-excluir]')?.addEventListener('click', () => { $('.confirmar', form).hidden = false; });
  form.querySelector('[data-confirmar]')?.addEventListener('click', async () => {
    const { error } = await db.from(t.nome).delete().eq(t.chave, linha![t.chave]);
    if (error) { aviso(traduzirErro(error.message), 'erro'); return; }
    aviso('Item excluído.');
    fechar();
    abrirAba(abaAtual);
  });
}

function traduzirErro(msg: string) {
  if (msg.includes('duplicate key')) return 'Já existe um item com esse identificador (slug).';
  if (msg.includes('foreign key')) return 'Este item está em uso por outro (por exemplo, uma etapa com soluções).';
  if (msg.includes('check constraint')) return 'Algum campo está em formato inválido. Slugs aceitam só letras minúsculas, números e hífens.';
  return msg;
}

// ---------------------------------------------------------------- publicação
async function publicar() {
  const b = $<HTMLButtonElement>('#publicar');
  b.disabled = true;
  b.textContent = 'Solicitando…';
  const { error } = await db.functions.invoke('publicar', { method: 'POST' });
  b.disabled = false;
  b.textContent = 'Publicar alterações';
  if (error) aviso('Não foi possível iniciar a publicação. Verifique a função "publicar" no Supabase (README).', 'erro');
  else aviso('Publicação iniciada. O site atualiza em cerca de 2 minutos.');
}
