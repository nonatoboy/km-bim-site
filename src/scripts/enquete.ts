// Enquete ao vivo pelo celular. O banco avisa cada comando do palestrante pelo canal em tempo real
// "enquete:{código}"; o celular então consulta entrar_enquete. A consulta periódica cobre quedas do tempo real.
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { MAX_CARACTERES_PALAVRA, htmlResultado, ouvirEnquete, participanteId, respondentes, type EstadoParticipante } from '../lib/enquetes';

const $ = <T extends HTMLElement = HTMLElement>(sel: string, raiz: ParentNode = document) => raiz.querySelector<T>(sel)!;
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Intervalo entre consultas (ms): com o tempo real ativo, só uma checagem de segurança
const CONSULTA = { tempoReal: 20000, semTempoReal: 4000, resultado: 5000 };

let db: SupabaseClient;
let eu = '';
let codigo = '';
let estado: EstadoParticipante | null = null;
let tela = '';            // o que está desenhado: muda só quando muda a pergunta ou o estado dela
let tempoReal = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let pararCanal: (() => void) | undefined;
let consulta = 0;         // descarta respostas de consultas antigas que chegam fora de ordem

export function iniciarEnquete() {
  db = supabase();
  eu = participanteId();
  $('#form-codigo').addEventListener('submit', (e) => { e.preventDefault(); entrar($<HTMLInputElement>('#codigo').value); });
  $<HTMLInputElement>('#codigo').addEventListener('input', (e) => {
    const campo = e.target as HTMLInputElement;
    campo.value = campo.value.replace(/\D/g, '').slice(0, 4);
    $('#erro-codigo').textContent = '';
    if (campo.value.length === 4) entrar(campo.value);
  });
  $('#sair').addEventListener('click', sair);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && codigo) atualizar(); });
  const doLink = new URLSearchParams(location.search).get('c') ?? '';
  if (/^\d{4}$/.test(doLink)) entrar(doLink);
  else mostrarFormulario();
}

function mostrarFormulario(erro = '') {
  $('#form-codigo').hidden = false;
  $('#tela').hidden = true;
  $('#sair').hidden = true;
  $('#erro-codigo').textContent = erro;
  const campo = $<HTMLInputElement>('#codigo');
  if (erro) campo.select(); else campo.focus();
}

async function entrar(c: string) {
  c = c.replace(/\D/g, '');
  if (c.length !== 4) { mostrarFormulario('Digite os 4 números do código.'); return; }
  const { data, error } = await db.rpc('entrar_enquete', { p_codigo: c, p_participante: eu });
  if (error) { mostrarFormulario('Não foi possível conectar. Verifique a internet e tente de novo.'); return; }
  if (!data) { mostrarFormulario('Código não encontrado. Confira com o palestrante.'); return; }
  codigo = c;
  history.replaceState(null, '', `?c=${c}`); // recarregar a página continua na mesma enquete
  $<HTMLInputElement>('#codigo').value = '';
  $('#form-codigo').hidden = true;
  $('#tela').hidden = false;
  $('#sair').hidden = false;
  pararCanal?.();
  pararCanal = ouvirEnquete(db, c, () => {
    // Espalha as consultas dos celulares em até 1,5 s para não chegarem todas juntas
    clearTimeout(timer);
    timer = setTimeout(atualizar, Math.random() * 1500);
  }, (ok) => { tempoReal = ok; agendar(); });
  tela = '';
  desenhar(data);
  agendar();
}

function sair() {
  pararCanal?.();
  pararCanal = undefined;
  clearTimeout(timer);
  codigo = '';
  estado = null;
  history.replaceState(null, '', location.pathname);
  mostrarFormulario();
}

function agendar() {
  clearTimeout(timer);
  if (!codigo) return;
  const ms = estado?.pergunta?.resultado_liberado ? CONSULTA.resultado : tempoReal ? CONSULTA.tempoReal : CONSULTA.semTempoReal;
  timer = setTimeout(atualizar, ms);
}

async function atualizar() {
  if (!codigo) return;
  const n = ++consulta;
  const { data, error } = await db.rpc('entrar_enquete', { p_codigo: codigo, p_participante: eu });
  if (n !== consulta || !codigo) return;
  $('#conexao').hidden = !error;
  if (!error) {
    if (!data) { sair(); mostrarFormulario('Esta enquete não existe mais.'); return; }
    desenhar(data);
  }
  agendar();
}

function desenhar(e: EstadoParticipante) {
  estado = e;
  const p = e.pergunta;
  const chave = !e.aberta ? 'fechada' : !p ? 'aguardando' : `${p.id}|${p.estado}`;
  if (chave !== tela) {
    tela = chave;
    const t = $('#tela');
    if (!e.aberta) {
      t.innerHTML = `<span class="rotulo">${esc(e.titulo)}</span><h1>Enquete fechada</h1><p>Obrigado pela participação.</p>`;
    } else if (!p) {
      t.innerHTML = `<span class="rotulo">${esc(e.titulo)}</span><h1>Aguarde a próxima pergunta</h1><p class="aguarde">A pergunta aparece aqui assim que o palestrante liberar.</p>`;
    } else {
      t.innerHTML = `<span class="rotulo">Pergunta ${p.numero} de ${p.total}</span><h1>${esc(p.texto)}</h1>
        ${p.estado === 'aberta' ? formulario(e) : respostaDada(e)}
        <div class="resultado" id="resultado" hidden></div>`;
      if (p.estado === 'aberta') ligarFormulario(e);
    }
  }
  // Resultado liberado pelo palestrante: atualiza sem redesenhar o formulário
  const r = $('#resultado');
  if (!r) return;
  r.hidden = !p?.resultado || !p.resultado_liberado;
  if (p?.resultado && p.resultado_liberado) {
    r.innerHTML = `<h2>Resultado</h2>${htmlResultado(e.tipo!, p, p.resultado, e.resposta?.escolhas ?? [])}<p class="dica">${respondentes(p.resultado.respondentes)}</p>`;
  }
}

function formulario(e: EstadoParticipante) {
  const p = e.pergunta!;
  const minha = e.resposta;
  const enviada = minha ? '<p class="enviada" id="enviada">Resposta enviada. Você pode alterar enquanto a pergunta estiver aberta.</p>' : '<p class="enviada" id="enviada" hidden></p>';
  if (e.tipo === 'nuvem_palavras') {
    const max = e.max_palavras ?? 3;
    const palavras = minha?.palavras ?? [];
    return `<form id="form-resposta" class="palavras">
      <p class="dica">${max === 1 ? 'Responda com uma palavra ou expressão curta.' : `Até ${max} palavras ou expressões curtas.`}</p>
      ${Array.from({ length: max }, (_, i) => `<input name="palavra" maxlength="${MAX_CARACTERES_PALAVRA}" autocomplete="off" aria-label="Palavra ${i + 1}" value="${esc(palavras[i] ?? '')}">`).join('')}
      <p class="enquete__erro" id="erro-resposta" role="alert"></p>
      <button class="botao botao--primario" type="submit">${minha ? 'Alterar resposta' : 'Enviar'}</button>
      ${enviada}
    </form>`;
  }
  const multipla = e.tipo === 'escolha_multipla';
  const marcadas = minha?.escolhas ?? [];
  return `<form id="form-resposta">
    <fieldset class="opcoes">
      <legend class="visually-hidden">Alternativas</legend>
      ${multipla ? `<p class="dica">${e.max_escolhas ? `Marque até ${e.max_escolhas} alternativas.` : 'Marque quantas alternativas quiser.'}</p>` : ''}
      ${p.opcoes.map((o, i) => `<label class="opcao"><input type="${multipla ? 'checkbox' : 'radio'}" name="escolha" value="${i}" ${marcadas.includes(i) ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}
    </fieldset>
    <p class="enquete__erro" id="erro-resposta" role="alert"></p>
    <button class="botao botao--primario" type="submit">${minha ? 'Alterar resposta' : 'Enviar'}</button>
    ${enviada}
  </form>`;
}

function respostaDada(e: EstadoParticipante) {
  const p = e.pergunta!;
  const minha = e.resposta;
  const texto = !minha ? 'Você não respondeu a esta pergunta.'
    : e.tipo === 'nuvem_palavras' ? `Sua resposta: ${minha.palavras.map(esc).join(', ')}.`
    : `Sua resposta: ${minha.escolhas.map((i) => esc(p.opcoes[i])).join(', ')}.`;
  return `<p><strong>Respostas encerradas.</strong> ${texto}</p>`;
}

function ligarFormulario(e: EstadoParticipante) {
  const form = $<HTMLFormElement>('#form-resposta');
  const erro = $('#erro-resposta');
  // Várias alternativas com limite: não deixa marcar além do máximo
  if (e.tipo === 'escolha_multipla' && e.max_escolhas) {
    form.addEventListener('change', (ev) => {
      const alvo = ev.target as HTMLInputElement;
      if (alvo.checked && form.querySelectorAll('input:checked').length > e.max_escolhas!) {
        alvo.checked = false;
        erro.textContent = `Marque no máximo ${e.max_escolhas}.`;
      } else erro.textContent = '';
    });
  }
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    erro.textContent = '';
    const nuvem = e.tipo === 'nuvem_palavras';
    const palavras = nuvem ? [...form.querySelectorAll<HTMLInputElement>('input[name="palavra"]')].map((i) => i.value.trim()).filter(Boolean) : [];
    const escolhas = nuvem ? [] : [...form.querySelectorAll<HTMLInputElement>('input:checked')].map((i) => Number(i.value));
    if (nuvem ? !palavras.length : !escolhas.length) { erro.textContent = nuvem ? 'Escreva ao menos uma palavra.' : 'Escolha uma alternativa.'; return; }
    const botao = $<HTMLButtonElement>('button[type="submit"]', form);
    botao.disabled = true;
    const { data, error } = await db.rpc('responder_enquete', {
      p_codigo: codigo, p_participante: eu, p_pergunta: e.pergunta!.id, p_escolhas: escolhas, p_palavras: palavras,
    });
    botao.disabled = false;
    if (error) { erro.textContent = 'Não foi possível enviar. Verifique a internet e tente de novo.'; return; }
    if (!data?.ok) {
      if (data?.erro === 'invalida') { erro.textContent = 'Resposta inválida. Confira e envie de novo.'; return; }
      atualizar(); // pergunta encerrada ou enquete fechada nesse meio-tempo
      return;
    }
    estado!.resposta = { escolhas, palavras };
    botao.textContent = 'Alterar resposta';
    const ok = $('#enviada');
    ok.textContent = 'Resposta enviada. Você pode alterar enquanto a pergunta estiver aberta.';
    ok.hidden = false;
  });
}
