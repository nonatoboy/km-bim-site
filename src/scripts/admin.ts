// Painel administrativo: edita o conteúdo no Supabase e acompanha os pedidos de orçamento.
// Toda a segurança está nas políticas RLS do banco; esta tela só organiza as operações.
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  ASSUNTO_PADRAO, TEXTO_EMAIL_PADRAO, TEXTO_WHATSAPP_PADRAO, dataConvite, formatarTelefone, lerLista, normalizarTelefone, preencher, primeiroNome, telefoneValido,
} from '../lib/convites';

type TipoCampo = 'texto' | 'textoLongo' | 'lista' | 'opcoes' | 'booleano' | 'numero' | 'imagem' | 'pdf' | 'url' | 'dataHora';
interface Campo { nome: string; rotulo: string; tipo: TipoCampo; opcoes?: [string, string][]; obrigatorio?: boolean; ajuda?: string }
interface Tabela { nome: string; rotulo: string; chave: string; titulo: string; subtitulo?: string; campos: Campo[]; padrao?: Record<string, any> }

const categoriasOpcoes: [string, string][] = [];

const TABELAS: Tabela[] = [
  {
    nome: 'eventos', rotulo: 'Eventos', chave: 'id', titulo: 'titulo', subtitulo: 'inicio',
    padrao: { tipo: 'webinar', modalidade: 'online', palestrante: 'Marcelo Nonato Santos', local: 'Microsoft Teams', inscricoes_abertas: true, ativo: true, listado: true, ordem: 0 },
    campos: [
      { nome: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true },
      { nome: 'slug', rotulo: 'Endereço (slug)', tipo: 'texto', obrigatorio: true, ajuda: 'Letras minúsculas, números e hífens. Vira kmbim.com.br/eventos/slug, o link de divulgação.' },
      { nome: 'tipo', rotulo: 'Tipo', tipo: 'opcoes', opcoes: [['webinar', 'Webinar'], ['treinamento', 'Treinamento'], ['roda_conversa', 'Roda de conversa'], ['workshop', 'Workshop'], ['outro', 'Outro']] },
      { nome: 'modalidade', rotulo: 'Modalidade', tipo: 'opcoes', opcoes: [['online', 'Online'], ['presencial', 'Presencial'], ['hibrido', 'Híbrido']] },
      { nome: 'inicio', rotulo: 'Início', tipo: 'dataHora', obrigatorio: true },
      { nome: 'fim', rotulo: 'Término', tipo: 'dataHora', obrigatorio: true },
      { nome: 'local', rotulo: 'Local', tipo: 'texto', ajuda: 'Ex.: Microsoft Teams, ou o endereço do evento presencial.' },
      { nome: 'resumo', rotulo: 'Resumo (lista e compartilhamento)', tipo: 'textoLongo' },
      { nome: 'descricao', rotulo: 'Descrição completa', tipo: 'textoLongo', ajuda: 'Deixe uma linha em branco entre parágrafos.' },
      { nome: 'publico_alvo', rotulo: 'Para quem é', tipo: 'textoLongo' },
      { nome: 'palestrante', rotulo: 'Quem conduz', tipo: 'texto' },
      { nome: 'vagas', rotulo: 'Vagas', tipo: 'numero', ajuda: 'Deixe vazio para não limitar.' },
      { nome: 'inscricoes_ate', rotulo: 'Inscrições até', tipo: 'dataHora', ajuda: 'Vazio = até o início do evento.' },
      { nome: 'inscricoes_abertas', rotulo: 'Inscrições abertas', tipo: 'booleano' },
      { nome: 'preco', rotulo: 'Preço (R$)', tipo: 'numero', ajuda: 'Vazio = gratuito. Pagamento online ainda não está disponível.' },
      { nome: 'link_acesso', rotulo: 'Link de acesso (privado)', tipo: 'url', ajuda: 'Sala do Teams. Enviado só para inscritos confirmados; não aparece no site.' },
      { nome: 'instrucoes_acesso', rotulo: 'Instruções para os confirmados (privado)', tipo: 'textoLongo', ajuda: 'Vai no e-mail de confirmação: material prévio, senha, orientações.' },
      { nome: 'imagem', rotulo: 'Arte de divulgação', tipo: 'imagem' },
      { nome: 'solucao_relacionada', rotulo: 'Solução relacionada (slug)', tipo: 'texto', ajuda: 'Opcional. Ex.: implantacao-bim-iso-19650' },
      { nome: 'ativo', rotulo: 'Visível no site', tipo: 'booleano' },
      { nome: 'listado', rotulo: 'Listado no site', tipo: 'booleano', ajuda: 'Desmarque para um evento exclusivo: a página e as inscrições funcionam, mas o evento não aparece na lista de eventos nem na página inicial. Só chega quem recebe o link.' },
    ],
  },
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
  socio_foto: 'Foto do sócio (URL)', linkedin_url: 'LinkedIn do sócio', linkedin_empresa_url: 'LinkedIn da empresa', cnpj: 'CNPJ (rodapé)', aviso_privacidade: 'Aviso de privacidade do formulário',
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

  const abas: [string, string][] = [['pedidos', 'Pedidos'], ['inscricoes', 'Inscrições'], ['convites', 'Convites'], ...TABELAS.map((t) => [t.nome, t.rotulo] as [string, string]), ['configuracoes', 'Textos gerais']];
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
  if (id === 'inscricoes') return listarInscricoes();
  if (id === 'convites') return listarConvites();
  if (id === 'configuracoes') return listarConfiguracoes();
  listarTabela(TABELAS.find((t) => t.nome === id)!);
}


// Datas: o banco guarda em UTC; o painel mostra no horário do computador (Brasília)
const dataBr = (iso?: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
function paraLocal(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

// ---------------------------------------------------------------- inscrições em eventos
const STATUS_INSC: [string, string][] = [['pendente', 'Pendente'], ['confirmada', 'Confirmada'], ['lista_espera', 'Lista de espera'], ['cancelada', 'Cancelada'], ['aguardando_pagamento', 'Aguardando pagamento']];
let eventoSelecionado = '';

// Preenche vagas livres com a lista de espera (Edge Function "inscricao", que também envia os e-mails).
async function promoverEspera(eventoId: string) {
  const { data, error } = await db.functions.invoke('inscricao', { body: { acao: 'promover', evento_id: eventoId } });
  if (error) { aviso('Não foi possível atualizar a lista de espera. Verifique a função "inscricao" no Supabase.', 'erro'); return; }
  if (data?.promovidos) aviso(`${data.promovidos} pessoa(s) saíram da lista de espera e receberam o e-mail de confirmação.`);
}

async function listarInscricoes() {
  const area = $('#area');
  const { data: eventos, error } = await db.from('eventos').select('id, titulo, inicio, vagas').order('inicio', { ascending: false });
  if (error) { area.innerHTML = `<p class="erro">${esc(error.message)}. Rode a migration de eventos no Supabase (README).</p>`; return; }
  if (!eventos.length) { area.innerHTML = '<div class="vazio"><h2>Nenhum evento cadastrado</h2><p>Cadastre um evento na aba Eventos.</p></div>'; return; }
  if (!eventos.some((e) => e.id === eventoSelecionado)) eventoSelecionado = eventos[0].id;
  const ev = eventos.find((e) => e.id === eventoSelecionado)!;
  const { data: insc = [] } = await db.from('inscricoes_evento').select('*').eq('evento_id', ev.id).order('criado_em');
  // Posição na lista de espera: ordem de entrada na fila
  const fila = insc!.filter((i) => i.status === 'lista_espera')
    .sort((a, b) => (a.espera_desde ?? '').localeCompare(b.espera_desde ?? '') || a.id.localeCompare(b.id));
  const posicao = (i: any) => (i.status === 'lista_espera' ? fila.indexOf(i) + 1 : null);
  const conta = (st: string) => insc!.filter((i) => i.status === st).length;
  const presentes = insc!.filter((i) => i.presente).length;
  area.innerHTML = `
    <header class="area__cabeca">
      <h2>Inscrições</h2>
      <label class="campo"><select id="sel-evento">${eventos.map((e) => `<option value="${e.id}" ${e.id === ev.id ? 'selected' : ''}>${esc(dataBr(e.inicio))} · ${esc(e.titulo)}</option>`).join('')}</select></label>
    </header>
    <p class="resumo-insc"><strong>${conta('confirmada')}</strong> confirmada(s)${ev.vagas ? ` de ${ev.vagas} vagas` : ''} · <strong>${conta('lista_espera')}</strong> na lista de espera · <strong>${conta('pendente')}</strong> pendente(s) · <strong>${conta('cancelada')}</strong> cancelada(s) · <strong>${presentes}</strong> presente(s)
      <button type="button" class="botao botao--contorno" id="exportar">Exportar para Excel (CSV)</button></p>
    ${insc!.length ? `<div class="tabela-insc"><table>
      <thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Empresa</th><th>Inscrição</th><th>Status</th><th>Presente</th></tr></thead>
      <tbody>${insc!.map((i) => `<tr data-id="${i.id}">
        <td>${esc(i.nome)}</td><td>${esc(i.email)}</td><td>${esc(i.telefone)}</td><td>${esc(i.empresa)}</td><td>${esc(dataBr(i.criado_em))}</td>
        <td><select data-campo="status">${STATUS_INSC.map(([v, r]) => `<option value="${v}" ${v === i.status ? 'selected' : ''}>${r}${v === 'lista_espera' && posicao(i) ? ` (${posicao(i)}º)` : ''}</option>`).join('')}</select></td>
        <td><input type="checkbox" data-campo="presente" ${i.presente ? 'checked' : ''} aria-label="Presente"></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="vazio"><p>Nenhuma inscrição neste evento ainda.</p></div>'}`;
  $('#sel-evento').addEventListener('change', (e) => { eventoSelecionado = (e.target as HTMLSelectElement).value; listarInscricoes(); });
  area.querySelectorAll<HTMLElement>('[data-campo]').forEach((el) => el.addEventListener('change', async () => {
    const id = el.closest('tr')!.dataset.id!;
    const campo = el.dataset.campo!;
    const valor = campo === 'presente' ? (el as HTMLInputElement).checked : (el as HTMLSelectElement).value;
    const agora = new Date().toISOString();
    const extra: Record<string, any> = campo !== 'status' ? {}
      : valor === 'confirmada' ? { confirmado_em: agora }
      : valor === 'cancelada' ? { cancelado_em: agora }
      : valor === 'lista_espera' ? { espera_desde: agora } // entra no fim da fila
      : {};
    const { error: e } = await db.from('inscricoes_evento').update({ [campo]: valor, ...extra }).eq('id', id);
    if (e) { aviso(e.message, 'erro'); return; }
    aviso('Inscrição atualizada.');
    if (campo === 'status') await promoverEspera(ev.id); // vaga liberada vai para o primeiro da fila
    listarInscricoes();
  }));
  area.querySelector('#exportar')?.addEventListener('click', () => {
    const cab = ['Nome', 'E-mail', 'Telefone', 'Empresa', 'Status', 'Posição na espera', 'Presente', 'Inscrição', 'Confirmação'];
    const linhas = insc!.map((i) => [i.nome, i.email, i.telefone, i.empresa, STATUS_INSC.find(([v]) => v === i.status)?.[1] ?? i.status, posicao(i) ?? '', i.presente ? 'Sim' : 'Não', dataBr(i.criado_em), dataBr(i.confirmado_em)]);
    // Ponto e vírgula e BOM: abre direto no Excel em português com acentos corretos
    const csv = '\uFEFF' + [cab, ...linhas].map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `inscricoes-${ev.titulo.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

// ---------------------------------------------------------------- convites individuais
// Lista de convidados por evento: importar, enviar por e-mail (Edge Function "convites"), abrir o WhatsApp
// com a mensagem pronta e acompanhar quem recebeu, abriu o link e se inscreveu.
const ST_EMAIL: Record<string, [string, string]> = {
  pendente: ['Não enviado', ''], enviado: ['Enviado', 'info'], entregue: ['Entregue', 'info'], aberto: ['Abriu', 'ok'],
  clicou: ['Clicou', 'ok'], devolvido: ['Inválido', 'erro'], spam: ['Marcou spam', 'erro'], erro: ['Falha no envio', 'erro'],
};
const FILTROS: [string, string][] = [
  ['todos', 'Todos'], ['sem_resposta', 'Ainda não se inscreveram'], ['inscritos', 'Inscritos'],
  ['whatsapp', 'WhatsApp a enviar'], ['invalidos', 'E-mail inválido'], ['sem_email', 'Sem e-mail'],
];
let eventoConvites = '';
let filtroConvites = 'sem_resposta';
const caixasAbertas = new Set<string>(); // passos do painel que ficam abertos ao recarregar a lista

async function chamarConvites(corpo: Record<string, unknown>) {
  const { data, error } = await db.functions.invoke('convites', { body: corpo });
  if (!error) return data;
  let msg = 'Não foi possível falar com a função "convites" no Supabase (README, seção Convites).';
  try { const c = await (error as any).context?.json(); if (c?.erro) msg = c.erro; } catch { /* sem corpo */ }
  aviso(msg, 'erro');
  return null;
}

async function listarConvites() {
  const area = $('#area');
  const rolagem = window.scrollY;
  const { data: eventos, error } = await db.from('eventos')
    .select('id, slug, titulo, resumo, inicio, fim, local, palestrante, convite_assunto, convite_texto, convite_whatsapp')
    .order('inicio', { ascending: false });
  if (error) { area.innerHTML = `<p class="erro">${esc(error.message)}. Rode a migration de convites no Supabase (README, seção Convites).</p>`; return; }
  if (!eventos.length) { area.innerHTML = '<div class="vazio"><h2>Nenhum evento cadastrado</h2><p>Cadastre um evento na aba Eventos.</p></div>'; return; }
  if (!eventos.some((e) => e.id === eventoConvites)) {
    // Padrão: o próximo evento a acontecer
    const futuros = eventos.filter((e) => new Date(e.fim).getTime() >= Date.now());
    eventoConvites = (futuros[futuros.length - 1] ?? eventos[0]).id;
  }
  const ev = eventos.find((e) => e.id === eventoConvites)!;
  const [{ data: lista = [], error: erroLista }, { data: insc = [] }, { data: outros = [] }] = await Promise.all([
    db.from('convidados').select('*').eq('evento_id', ev.id).order('nome'),
    db.from('inscricoes_evento').select('email, status, convidado_id').eq('evento_id', ev.id),
    db.from('convidados').select('evento_id').neq('evento_id', ev.id),
  ]);
  if (erroLista) { area.innerHTML = `<p class="erro">${esc(erroLista.message)}. Rode a migration de convites no Supabase (README, seção Convites).</p>`; return; }

  const site = location.origin.includes('localhost') ? 'https://kmbim.com.br' : location.origin;
  const link = (c: any) => `${site}/eventos/${ev.slug}?c=${c.token}`;
  const inscricao = (c: any) => insc!.find((i) => i.convidado_id === c.id) ?? (c.email ? insc!.find((i) => i.email.toLowerCase() === c.email.toLowerCase()) : undefined);
  const valores = (c: any) => ({
    nome: primeiroNome(c.nome), titulo: ev.titulo, data: dataConvite(ev.inicio), local: ev.local || 'Microsoft Teams',
    resumo: ev.resumo ?? '', palestrante: ev.palestrante ?? '', link: link(c),
  });
  const textoWhats = ev.convite_whatsapp || TEXTO_WHATSAPP_PADRAO;
  const whats = (c: any) => `https://wa.me/${c.telefone}?text=${encodeURIComponent(preencher(textoWhats, valores(c)))}`;

  const L = lista!;
  const recebeu = (c: any) => ['enviado', 'entregue', 'aberto', 'clicou'].includes(c.email_status);
  const pendentesEmail = L.filter((c) => c.email && ['pendente', 'erro'].includes(c.email_status)).length;
  const umDia = Date.now() - 24 * 3600_000; // lembrete só para quem recebeu o convite há 1 dia ou mais
  const paraLembrete = L.filter((c) => c.email && recebeu(c) && !c.lembrete_enviado_em && !inscricao(c) && new Date(c.email_enviado_em).getTime() < umDia).length;
  const n = (f: (c: any) => boolean) => L.filter(f).length;
  const filtrar: Record<string, (c: any) => boolean> = {
    todos: () => true,
    sem_resposta: (c) => !inscricao(c),
    inscritos: (c) => !!inscricao(c),
    whatsapp: (c) => telefoneValido(c.telefone) && !c.whatsapp_enviado_em && !inscricao(c),
    invalidos: (c) => ['devolvido', 'spam', 'erro'].includes(c.email_status),
    sem_email: (c) => !c.email,
  };
  const visiveis = L.filter(filtrar[filtroConvites] ?? filtrar.todos);
  const comConvites = [...new Set(outros!.map((o) => o.evento_id))].map((id) => eventos.find((e) => e.id === id)).filter(Boolean) as any[];
  const STATUS_TXT = Object.fromEntries(STATUS_INSC);

  area.innerHTML = `
    <header class="area__cabeca">
      <h2>Convites</h2>
      <label class="campo"><select id="sel-evento-convite">${eventos.map((e) => `<option value="${e.id}" ${e.id === ev.id ? 'selected' : ''}>${esc(dataBr(e.inicio))} · ${esc(e.titulo)}</option>`).join('')}</select></label>
    </header>
    <div class="painel-convites">
      <div class="numeros">
        <div><strong>${L.length}</strong><span>convidados</span></div>
        <div><strong>${n((c) => recebeu(c) || ['devolvido', 'spam'].includes(c.email_status))}</strong><span>e-mails enviados</span></div>
        <div><strong>${n((c) => ['aberto', 'clicou'].includes(c.email_status))}</strong><span>abriram o e-mail</span></div>
        <div><strong>${n((c) => ['devolvido', 'spam', 'erro'].includes(c.email_status))}</strong><span>e-mails inválidos</span></div>
        <div><strong>${n((c) => !!c.whatsapp_enviado_em)}</strong><span>WhatsApp enviados</span></div>
        <div><strong>${n((c) => !!c.link_aberto_em)}</strong><span>abriram o link</span></div>
        <div><strong>${n((c) => !!inscricao(c))}</strong><span>inscritos</span></div>
      </div>

      <details class="caixa" data-caixa="importar" ${!L.length || caixasAbertas.has('importar') ? 'open' : ''}>
        <summary>1. Importar convidados</summary>
        <p>Copie do Excel as colunas <strong>Nome</strong>, <strong>E-mail</strong> e <strong>Celular</strong> (em qualquer ordem) e cole abaixo. Quem tiver só celular recebe por WhatsApp; quem já está na lista é ignorado.</p>
        <textarea id="lista-colar" rows="6" placeholder="Ana Souza	ana@exemplo.com	(11) 98765-4321"></textarea>
        <div class="linha-botoes">
          <button type="button" class="botao botao--primario" id="importar">Adicionar à lista</button>
          ${comConvites.length ? `<span>ou copie a lista de outro evento:</span>
            <select id="copiar-de">${comConvites.map((e) => `<option value="${e.id}">${esc(e.titulo)}</option>`).join('')}</select>
            <button type="button" class="botao botao--contorno" id="copiar">Copiar lista</button>` : ''}
        </div>
      </details>

      <details class="caixa" data-caixa="textos" ${caixasAbertas.has('textos') ? 'open' : ''}>
        <summary>2. Textos do convite</summary>
        <p>Use <code>{nome}</code> (primeiro nome), <code>{titulo}</code>, <code>{data}</code>, <code>{local}</code>, <code>{resumo}</code>, <code>{palestrante}</code> e <code>{link}</code> (link pessoal de inscrição). No e-mail, uma linha só com <code>{link}</code> vira o botão "Garantir minha vaga".</p>
        <form id="form-textos" class="editor">
          <label class="campo"><span>Assunto do e-mail</span><input name="convite_assunto" value="${esc(ev.convite_assunto || ASSUNTO_PADRAO)}"></label>
          <label class="campo"><span>Texto do e-mail</span><textarea name="convite_texto" rows="12">${esc(ev.convite_texto || TEXTO_EMAIL_PADRAO)}</textarea></label>
          <label class="campo"><span>Mensagem de WhatsApp</span><textarea name="convite_whatsapp" rows="7">${esc(textoWhats)}</textarea></label>
          <div class="linha-botoes">
            <button class="botao botao--primario" type="submit">Salvar textos</button>
            <button class="botao botao--contorno" type="button" data-teste="convite">Enviar convite de teste para mim</button>
            <button class="botao botao--contorno" type="button" data-teste="lembrete">Enviar lembrete de teste para mim</button>
          </div>
        </form>
      </details>

      <div class="caixa caixa--acoes">
        <strong>3. Enviar</strong>
        <div class="linha-botoes">
          <button type="button" class="botao botao--cta" id="enviar-convites" ${pendentesEmail ? '' : 'disabled'}>Enviar convites por e-mail (${pendentesEmail})</button>
          <button type="button" class="botao botao--contorno" id="enviar-lembrete" ${paraLembrete ? '' : 'disabled'}>Enviar lembrete a quem não se inscreveu (${paraLembrete})</button>
        </div>
        <small>Até 80 e-mails por dia (limite do plano gratuito do Resend, com folga para as confirmações de inscrição). O que passar do limite fica pendente: clique de novo no dia seguinte. O lembrete vai só para quem recebeu o convite há pelo menos 1 dia. O WhatsApp é enviado um a um, pela lista abaixo.</small>
      </div>

      <nav class="filtros" aria-label="Filtrar convidados">${FILTROS.map(([v, r]) => `<button type="button" data-filtro="${v}" aria-pressed="${v === filtroConvites}">${r} (${L.filter(filtrar[v]).length})</button>`).join('')}</nav>

      ${visiveis.length ? `<div class="tabela-insc"><table class="tabela-convites">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Situação do e-mail</th><th>Celular</th><th>WhatsApp</th><th>Abriu o link</th><th>Inscrição</th><th></th></tr></thead>
        <tbody>${visiveis.map((c) => {
          const [st, tom] = c.email ? ST_EMAIL[c.email_status] ?? [c.email_status, ''] : ['Sem e-mail', ''];
          const i = inscricao(c);
          return `<tr data-id="${c.id}">
            <td>${esc(c.nome)}</td>
            <td><input type="email" data-editar="email" value="${esc(c.email)}" placeholder="—" aria-label="E-mail de ${esc(c.nome)}"></td>
            <td><span class="etiqueta" data-tom="${tom}" title="${esc(c.email_erro)}">${esc(st)}</span>${c.lembrete_enviado_em ? '<small> · lembrete enviado</small>' : ''}</td>
            <td><input data-editar="telefone" value="${esc(formatarTelefone(c.telefone))}" placeholder="—" aria-label="Celular de ${esc(c.nome)}"></td>
            <td>${telefoneValido(c.telefone)
              ? `<a class="botao botao--contorno botao--mini" href="${esc(whats(c))}" target="_blank" rel="noopener" data-whats>${c.whatsapp_enviado_em ? 'Reenviar' : 'Enviar'}</a>${c.whatsapp_enviado_em ? `<small> ✓ ${esc(dataBr(c.whatsapp_enviado_em))}</small>` : ''}`
              : '<small>—</small>'}</td>
            <td>${c.link_aberto_em ? esc(dataBr(c.link_aberto_em)) : '<small>—</small>'}</td>
            <td>${i ? `<span class="etiqueta" data-tom="${i.status === 'confirmada' ? 'ok' : i.status === 'cancelada' ? 'erro' : 'info'}">${esc(STATUS_TXT[i.status] ?? i.status)}</span>` : '<small>—</small>'}</td>
            <td><button type="button" class="link" data-remover aria-label="Remover ${esc(c.nome)}">×</button></td></tr>`;
        }).join('')}</tbody></table></div>`
      : `<div class="vazio"><p>${L.length ? 'Ninguém nesta lista.' : 'Nenhum convidado neste evento ainda. Comece importando a lista (passo 1).'}</p></div>`}

      ${L.length ? `<div class="linha-botoes">
        <button type="button" class="botao botao--contorno" id="exportar-convites">Exportar para Excel (CSV)</button>
        <button type="button" class="botao botao--perigo" id="apagar-convites">Apagar a lista deste evento</button></div>` : ''}
    </div>`;
  window.scrollTo(0, rolagem);

  $('#sel-evento-convite').addEventListener('change', (e) => { eventoConvites = (e.target as HTMLSelectElement).value; listarConvites(); });
  area.querySelectorAll<HTMLDetailsElement>('[data-caixa]').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) caixasAbertas.add(d.dataset.caixa!); else caixasAbertas.delete(d.dataset.caixa!);
  }));
  area.querySelectorAll<HTMLButtonElement>('[data-filtro]').forEach((b) => b.addEventListener('click', () => { filtroConvites = b.dataset.filtro!; listarConvites(); }));

  // 1. Importar
  $('#importar').addEventListener('click', async () => {
    const { convidados, ignoradas } = lerLista(($('#lista-colar') as HTMLTextAreaElement).value);
    const emails = new Set(L.map((c) => c.email.toLowerCase()).filter(Boolean));
    const fones = new Set(L.map((c) => c.telefone).filter(Boolean));
    const novos = convidados.filter((c) => {
      if ((c.email && emails.has(c.email)) || (c.telefone && fones.has(c.telefone))) return false;
      if (c.email) emails.add(c.email);
      if (c.telefone) fones.add(c.telefone);
      return true;
    });
    if (!novos.length) { aviso(convidados.length ? 'Todos já estavam na lista.' : 'Nenhuma linha com e-mail ou celular encontrada.', 'erro'); return; }
    const { error: e } = await db.from('convidados').insert(novos.map((c) => ({ ...c, evento_id: ev.id })));
    if (e) { aviso(e.message, 'erro'); return; }
    const repetidos = convidados.length - novos.length;
    aviso(`${novos.length} convidado(s) adicionado(s).${repetidos ? ` ${repetidos} já estavam na lista.` : ''}${ignoradas.length ? ` ${ignoradas.length} linha(s) sem e-mail nem celular foram ignoradas.` : ''}`);
    listarConvites();
  });
  area.querySelector('#copiar')?.addEventListener('click', async () => {
    const origem = ($('#copiar-de') as HTMLSelectElement).value;
    const { data: deOutro = [] } = await db.from('convidados').select('nome, email, telefone').eq('evento_id', origem);
    const emails = new Set(L.map((c) => c.email.toLowerCase()).filter(Boolean));
    const fones = new Set(L.map((c) => c.telefone).filter(Boolean));
    const novos = deOutro!.filter((c) => !(c.email && emails.has(c.email.toLowerCase())) && !(c.telefone && fones.has(c.telefone)));
    if (!novos.length) { aviso('Todos já estavam na lista.', 'erro'); return; }
    const { error: e } = await db.from('convidados').insert(novos.map((c) => ({ ...c, evento_id: ev.id })));
    if (e) { aviso(e.message, 'erro'); return; }
    aviso(`${novos.length} convidado(s) copiado(s).`);
    listarConvites();
  });

  // 2. Textos
  $('#form-textos').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const dados = Object.fromEntries(['convite_assunto', 'convite_texto', 'convite_whatsapp'].map((k) => [k, String(fd.get(k) ?? '').trim()]));
    const { error: er } = await db.from('eventos').update(dados).eq('id', ev.id);
    if (er) aviso(er.message, 'erro'); else { aviso('Textos salvos.'); listarConvites(); }
  });
  area.querySelectorAll<HTMLButtonElement>('[data-teste]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    const r = await chamarConvites({ acao: 'teste', tipo: b.dataset.teste, evento_id: ev.id });
    b.disabled = false;
    if (r?.ok) aviso(`Teste enviado para ${r.para}. Salve os textos antes, se tiver mudado algo.`);
  }));

  // 3. Enviar
  const envio = (id: string, acao: string, pergunta: string) => area.querySelector<HTMLButtonElement>(id)?.addEventListener('click', async (e) => {
    if (!confirm(pergunta)) return;
    const b = e.currentTarget as HTMLButtonElement;
    b.disabled = true; b.textContent = 'Enviando…';
    const r = await chamarConvites({ acao, evento_id: ev.id });
    if (r) {
      const partes = [`${r.enviados} e-mail(s) enviado(s).`];
      if (r.falhas) partes.push(`${r.falhas} falharam (tente de novo mais tarde).`);
      if (r.restantes > r.falhas) partes.push(`${r.restantes - r.falhas} ficam para amanhã: o limite de hoje (${r.limite}) foi atingido.`);
      aviso(partes.join(' '), r.falhas ? 'erro' : 'ok');
    }
    listarConvites();
  });
  envio('#enviar-convites', 'enviar', `Enviar o convite por e-mail para ${pendentesEmail} pessoa(s)? Confira antes o e-mail de teste.`);
  envio('#enviar-lembrete', 'lembrete', `Enviar o lembrete para ${paraLembrete} pessoa(s) que receberam o convite e ainda não se inscreveram?`);

  // Tabela: WhatsApp, edição de e-mail/celular, remover
  area.querySelectorAll<HTMLAnchorElement>('[data-whats]').forEach((a) => a.addEventListener('click', async () => {
    const id = a.closest('tr')!.dataset.id!;
    await db.from('convidados').update({ whatsapp_enviado_em: new Date().toISOString() }).eq('id', id);
    setTimeout(listarConvites, 400); // depois que a aba do WhatsApp abrir
  }));
  area.querySelectorAll<HTMLInputElement>('[data-editar]').forEach((inp) => inp.addEventListener('change', async () => {
    const id = inp.closest('tr')!.dataset.id!;
    const valor = inp.value.trim();
    let dados: Record<string, any>;
    if (inp.dataset.editar === 'email') {
      if (valor && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor)) { aviso('E-mail em formato inválido.', 'erro'); return; }
      // E-mail novo: volta para "não enviado", para receber o convite no próximo envio
      dados = { email: valor.toLowerCase(), email_status: 'pendente', email_id: null, email_erro: '', email_enviado_em: null, lembrete_id: null, lembrete_enviado_em: null };
    } else {
      dados = { telefone: normalizarTelefone(valor) };
    }
    const { error: e } = await db.from('convidados').update(dados).eq('id', id);
    if (e) { aviso(e.message.includes('duplicate') ? 'Já existe outro convidado com esse e-mail ou celular.' : e.message, 'erro'); return; }
    aviso('Convidado atualizado.');
    listarConvites();
  }));
  area.querySelectorAll<HTMLButtonElement>('[data-remover]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.closest('tr')!.dataset.id!;
    const c = L.find((x) => x.id === id);
    if (!confirm(`Remover ${c?.nome} da lista de convidados?`)) return;
    const { error: e } = await db.from('convidados').delete().eq('id', id);
    if (e) aviso(e.message, 'erro'); else listarConvites();
  }));

  area.querySelector('#exportar-convites')?.addEventListener('click', () => {
    const cab = ['Nome', 'E-mail', 'Situação do e-mail', 'Lembrete', 'Celular', 'WhatsApp enviado', 'Abriu o link', 'Inscrição', 'Link pessoal'];
    const linhas = L.map((c) => [c.nome, c.email, c.email ? ST_EMAIL[c.email_status]?.[0] : 'Sem e-mail', dataBr(c.lembrete_enviado_em), formatarTelefone(c.telefone),
      dataBr(c.whatsapp_enviado_em), dataBr(c.link_aberto_em), STATUS_TXT[inscricao(c)?.status ?? ''] ?? '', link(c)]);
    const csv = '﻿' + [cab, ...linhas].map((l) => l.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `convidados-${ev.slug}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  area.querySelector('#apagar-convites')?.addEventListener('click', async () => {
    if (!confirm(`Apagar os ${L.length} convidados deste evento? As inscrições não são afetadas. Esta ação não pode ser desfeita.`)) return;
    const { error: e } = await db.from('convidados').delete().eq('evento_id', ev.id);
    if (e) aviso(e.message, 'erro'); else { aviso('Lista apagada.'); listarConvites(); }
  });
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
  const { data, error } = await db.from(t.nome).select('*').order(t.nome === 'eventos' ? 'inicio' : 'ordem', { ascending: t.nome !== 'eventos' });
  if (error) { area.innerHTML = `<p class="erro">${esc(error.message)}</p>`; return; }
  area.innerHTML = `
    <header class="area__cabeca"><h2>${esc(t.rotulo)}</h2><button type="button" class="botao botao--cta" id="novo">Adicionar</button></header>
    ${data.length ? `<ul class="itens">${data.map((l) => `
      <li><button type="button" data-editar="${esc(l[t.chave])}">
        <strong>${esc(l[t.titulo])}</strong>
        <span>${esc(t.subtitulo ? (t.subtitulo === 'inicio' ? dataBr(l.inicio) : l[t.subtitulo]) : '')}${l.ativo === false ? ' · <em>oculto</em>' : ''}${t.nome === 'depoimentos' && !l.autorizado ? ' · <em>sem autorização</em>' : ''}</span>
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
      return `<label class="campo campo--curto"><span>${esc(c.rotulo)}</span><input type="number" step="any" min="0" id="${id}" name="${c.nome}" value="${esc(v)}">${ajuda}</label>`;
    case 'dataHora':
      return `<label class="campo campo--data"><span>${esc(c.rotulo)}</span><input type="datetime-local" id="${id}" name="${c.nome}" value="${esc(paraLocal(v))}" ${req}>${ajuda}</label>`;
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
  const padrao: Record<string, any> = t.padrao ?? { ativo: true, ordem: 0, modalidade: 'propria', tipo: 'formacao', categoria: categoriasOpcoes[0]?.[0] };
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
      else if (c.tipo === 'dataHora') dados[c.nome] = el.value ? new Date(el.value).toISOString() : null;
      else if (c.tipo === 'lista') dados[c.nome] = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
      else dados[c.nome] = el.value.trim();
    }
    const q = novo ? db.from(t.nome).insert(dados) : db.from(t.nome).update(dados).eq(t.chave, linha![t.chave]);
    const { error } = await q;
    if (error) { aviso(traduzirErro(error.message), 'erro'); return; }
    aviso('Salvo. Use "Publicar alterações" para atualizar o site.');
    // Vagas aumentadas: a lista de espera anda e os promovidos recebem o e-mail de confirmação.
    if (t.nome === 'eventos' && !novo && dados.vagas !== linha!.vagas) await promoverEspera(linha!.id);
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
