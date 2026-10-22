// Projeção da enquete: consulta projecao_enquete a cada 1,5 s (um único cliente, sem gastar a cota
// do tempo real) e redesenha só o que mudou, para as barras crescerem de forma contínua.
import { supabase } from '../lib/supabase';
import { htmlBarras, htmlNuvem, linkParticipante, qrCode, respondentes, type EstadoProjecao } from '../lib/enquetes';

const $ = <T extends HTMLElement = HTMLElement>(sel: string, raiz: ParentNode = document) => raiz.querySelector<T>(sel)!;
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const INTERVALO = 1500;

let tela = '';
let nuvem = '';
let codigoQr = '';
let redesenhou = false; // pergunta ou nuvem nova: refaz o ajuste à tela

export function iniciarProjecao() {
  const token = new URLSearchParams(location.search).get('t') ?? '';
  if (!/^[0-9a-f-]{36}$/i.test(token)) { aviso('Link de projeção inválido. Copie o link novamente no painel.'); return; }
  $('#tela-cheia').addEventListener('click', alternarTelaCheia);
  document.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) alternarTelaCheia(); });
  manterTelaAcesa();
  addEventListener('resize', ajustarTela);
  document.addEventListener('fullscreenchange', ajustarTela);
  document.fonts?.ready.then(ajustarTela);
  const db = supabase();
  const ciclo = async () => {
    const { data, error } = await db.rpc('projecao_enquete', { p_token: token });
    if (!error && !data) { aviso('Enquete não encontrada. Ela pode ter sido excluída; copie o link novamente no painel.'); return; }
    if (data) desenhar(data);
    if (error) $('#contagem').textContent = 'Sem conexão. Tentando novamente…';
    setTimeout(ciclo, INTERVALO);
  };
  ciclo();
}

function aviso(msg: string) {
  $('#palco').innerHTML = `<p class="projecao__aviso">${esc(msg)}</p>`;
}

function desenhar(e: EstadoProjecao) {
  const endereco = linkParticipante(e.codigo);
  if (e.codigo !== codigoQr) {
    codigoQr = e.codigo;
    $('[data-endereco]').textContent = `${location.host}/enquete`;
    $('[data-codigo]').textContent = e.codigo;
    $('[data-qr]').innerHTML = qrCode(endereco);
  }
  const p = e.pergunta;
  $('#acesso').hidden = !p; // sem pergunta, o QR code grande ocupa a tela
  const chave = p ? `${p.id}|${p.estado}|${p.texto}|${p.opcoes.join('|')}` : `entrada|${e.aberta}|${e.titulo}`;
  if (chave !== tela) {
    tela = chave;
    nuvem = '';
    $('#palco').innerHTML = `<div class="projecao__conteudo">${!p
      ? `<div class="projecao__entrada">
          <div class="projecao__qr">${qrCode(endereco)}</div>
          <div>
            <span class="rotulo">Enquete</span>
            <h1>${esc(e.titulo)}</h1>
            <p>Aponte a câmera do celular para o QR code ou acesse <strong>${esc(location.host)}/enquete</strong> e use o código</p>
            <strong class="projecao__codigo">${esc(e.codigo)}</strong>
            ${e.aberta ? '' : '<p class="projecao__fechada">A entrada ainda não foi aberta pelo palestrante.</p>'}
          </div>
        </div>`
      : `<span class="rotulo">Pergunta ${p.numero} de ${p.total}</span>
         <h1>${esc(p.texto)}</h1>
         <div id="resultado"></div>`}</div>`;
    redesenhou = true;
  }
  if (!p) { $('#contagem').textContent = ''; ajustarTela(); return; }
  const r = p.resultado ?? { respondentes: 0, votos: [], palavras: [] };
  const alvo = $('#resultado');
  if (e.tipo === 'nuvem_palavras') {
    const nova = JSON.stringify(r.palavras);
    if (nova !== nuvem) { nuvem = nova; alvo.innerHTML = htmlNuvem(r.palavras); redesenhou = true; }
  } else {
    const barras = alvo.querySelectorAll<HTMLElement>('.res-barras li');
    if (barras.length !== p.opcoes.length) {
      // Primeira vez: desenha zeradas e anima até o valor atual
      alvo.innerHTML = htmlBarras(p.opcoes, { respondentes: 0, votos: [], palavras: [] });
      requestAnimationFrame(() => requestAnimationFrame(() => atualizarBarras(alvo, r.votos, r.respondentes)));
    } else atualizarBarras(alvo, r.votos, r.respondentes);
  }
  $('#contagem').textContent = `${respondentes(r.respondentes)} · ${p.estado === 'aberta' ? 'respostas abertas' : 'respostas encerradas'}`;
  if (redesenhou) { redesenhou = false; ajustarTela(); }
}

/**
 * Faz o conteúdo caber na tela: com muitas alternativas, pergunta longa ou nuvem grande,
 * reduz o tamanho do texto (tudo na projeção é medido em em) até não sobrar nada cortado.
 */
function ajustarTela() {
  const palco = $('#palco');
  const conteudo = palco.querySelector<HTMLElement>('.projecao__conteudo');
  if (!conteudo) return;
  const estilo = getComputedStyle(palco);
  const altura = palco.clientHeight - parseFloat(estilo.paddingTop) - parseFloat(estilo.paddingBottom);
  const largura = palco.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
  let escala = 1;
  conteudo.style.fontSize = '';
  while ((conteudo.scrollHeight > altura + 1 || conteudo.scrollWidth > largura + 1) && escala > 0.35) { // +1: arredondamento de subpixel
    escala -= 0.05;
    conteudo.style.fontSize = `${escala}em`;
  }
}

function atualizarBarras(alvo: HTMLElement, votos: number[], total: number) {
  alvo.querySelectorAll<HTMLElement>('.res-barras li').forEach((li, i) => {
    const n = votos[i] ?? 0;
    const pct = total ? Math.round((n / total) * 100) : 0;
    $('.res-barras__trilho span', li).style.width = `${pct}%`;
    $('.res-barras__valor', li).innerHTML = `${pct}% <small>(${n})</small>`;
  });
}

function alternarTelaCheia() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

// Evita que o computador da projeção apague a tela durante a apresentação
async function manterTelaAcesa() {
  const pedir = async () => { try { await (navigator as any).wakeLock?.request('screen'); } catch { /* não suportado */ } };
  await pedir();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pedir(); });
}
