// Enquetes ao vivo: tipos, identificação anônima do participante, aviso em tempo real e
// desenho dos resultados (barras e nuvem de palavras), usados pelo celular, pela projeção e pelo painel.
import type { SupabaseClient } from '@supabase/supabase-js';
import { renderSVG } from 'uqr';

export type TipoEnquete = 'escolha_unica' | 'escolha_multipla' | 'nuvem_palavras';
export type EstadoPergunta = 'aguardando' | 'aberta' | 'encerrada';

export interface Palavra { palavra: string; n: number; oculta?: boolean }
export interface Resultado { respondentes: number; votos: number[]; palavras: Palavra[] }
export interface PerguntaAoVivo {
  id: string; texto: string; opcoes: string[]; estado: EstadoPergunta; resultado_liberado: boolean;
  numero: number; total: number; resultado: Resultado | null;
}
/** Resposta de entrar_enquete (celular). */
export interface EstadoParticipante {
  aberta: boolean; titulo: string; tipo?: TipoEnquete; max_escolhas?: number | null; max_palavras?: number;
  pergunta?: PerguntaAoVivo | null; resposta?: { escolhas: number[]; palavras: string[] } | null;
}
/** Resposta de projecao_enquete. */
export interface EstadoProjecao { titulo: string; tipo: TipoEnquete; codigo: string; aberta: boolean; pergunta: PerguntaAoVivo | null }

export const TIPOS_ENQUETE: [TipoEnquete, string][] = [
  ['escolha_unica', 'Múltipla escolha (uma alternativa)'],
  ['escolha_multipla', 'Várias alternativas'],
  ['nuvem_palavras', 'Nuvem de palavras'],
];
export const MAX_CARACTERES_PALAVRA = 25;

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Endereço que o participante abre (link direto e QR code). */
export function linkParticipante(codigo: string, origem = location.origin) {
  return `${origem}/enquete?c=${codigo}`;
}

/** QR code em SVG, nas cores da marca. */
export function qrCode(texto: string, escuro = '#1C2A31', claro = '#FFFFFF') {
  return renderSVG(texto, { border: 2, ecc: 'M', pixelSize: 10, blackColor: escuro, whiteColor: claro });
}

/** Identificador aleatório deste navegador: evita voto duplicado sem guardar dado pessoal. */
export function participanteId() {
  const chave = 'kmbim-enquete-participante';
  try {
    const salvo = localStorage.getItem(chave);
    if (salvo) return salvo;
    const novo = crypto.randomUUID();
    localStorage.setItem(chave, novo);
    return novo;
  } catch {
    return ((window as any).__participante ??= crypto.randomUUID()) as string;
  }
}

/**
 * Escuta o canal público "enquete:{código}", onde o banco avisa cada comando do palestrante.
 * aoConectar(true|false) informa se o tempo real está ativo, para o chamador ajustar a frequência de consulta.
 */
export function ouvirEnquete(db: SupabaseClient, codigo: string, aoMudar: () => void, aoConectar: (ok: boolean) => void) {
  const canal = db.channel(`enquete:${codigo}`)
    .on('broadcast', { event: 'mudou' }, aoMudar)
    .subscribe((status) => aoConectar(status === 'SUBSCRIBED'));
  return () => { db.removeChannel(canal); };
}

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

/** Barras horizontais: uma por alternativa; o comprimento é a porcentagem dos respondentes. */
export function htmlBarras(opcoes: string[], r: Resultado, marcadas: number[] = []) {
  return `<ol class="res-barras">${opcoes.map((o, i) => {
    const n = r.votos[i] ?? 0;
    return `<li${marcadas.includes(i) ? ' data-minha' : ''}>
      <span class="res-barras__rotulo">${esc(o)}</span>
      <span class="res-barras__valor">${pct(n, r.respondentes)}% <small>(${n})</small></span>
      <span class="res-barras__trilho"><span style="width:${pct(n, r.respondentes)}%"></span></span>
    </li>`;
  }).join('')}</ol>`;
}

/**
 * Nuvem de palavras sem biblioteca: tamanho proporcional à frequência, as mais citadas no centro.
 * Com moderar, cada palavra vira um botão (data-palavra) para ocultar ou mostrar de novo.
 */
export function htmlNuvem(palavras: Palavra[], moderar = false) {
  if (!palavras.length) return '<p class="res-vazio">Nenhuma palavra ainda.</p>';
  const maior = palavras[0].n;
  const menor = palavras[palavras.length - 1].n;
  const escala = (n: number) => (maior === menor ? 1 : (n - menor) / (maior - menor));
  // Intercala dos dois lados: maiores no meio, menores nas pontas
  const ordem: Palavra[] = [];
  palavras.forEach((p, i) => (i % 2 ? ordem.push(p) : ordem.unshift(p)));
  return `<div class="res-nuvem">${ordem.map((p, i) => {
    const t = escala(p.n);
    const estilo = `font-size:${(1 + Math.sqrt(t) * 2.6).toFixed(2)}em`;
    const tom = `data-tom="${i % 4}"`;
    return moderar
      ? `<button type="button" data-palavra="${esc(p.palavra)}" ${p.oculta ? 'data-oculta' : ''} ${tom} style="${estilo}" title="${p.oculta ? 'Mostrar de novo' : 'Ocultar'} (${p.n})">${esc(p.palavra)}</button>`
      : `<span ${tom} style="${estilo}" title="${p.n}">${esc(p.palavra)}</span>`;
  }).join('')}</div>`;
}

export function htmlResultado(tipo: TipoEnquete, pergunta: Pick<PerguntaAoVivo, 'opcoes'>, r: Resultado, marcadas: number[] = []) {
  return tipo === 'nuvem_palavras' ? htmlNuvem(r.palavras) : htmlBarras(pergunta.opcoes, r, marcadas);
}

export const respondentes = (n: number) => `${n} ${n === 1 ? 'resposta' : 'respostas'}`;
