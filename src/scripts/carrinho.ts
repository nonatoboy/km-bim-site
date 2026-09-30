// Seleção de soluções para o pedido de orçamento, guardada no navegador do visitante.
const CHAVE = 'kmbim:solucoes';

export function lerSelecao(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? '[]');
    return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function gravarSelecao(slugs: string[]) {
  const unicos = [...new Set(slugs)];
  try { localStorage.setItem(CHAVE, JSON.stringify(unicos)); } catch { /* navegação privada */ }
  document.dispatchEvent(new CustomEvent('kmbim:selecao', { detail: unicos }));
}

export function alternar(slug: string) {
  const atual = lerSelecao();
  gravarSelecao(atual.includes(slug) ? atual.filter((s) => s !== slug) : [...atual, slug]);
}

function atualizarTela(sel: string[]) {
  document.querySelectorAll<HTMLElement>('[data-carrinho-contador]').forEach((el) => {
    el.textContent = String(sel.length);
    el.hidden = sel.length === 0;
  });
  document.querySelectorAll<HTMLButtonElement>('[data-selecionar]').forEach((b) => {
    const ativo = sel.includes(b.dataset.selecionar!);
    b.setAttribute('aria-pressed', String(ativo));
    const rotulo = b.querySelector('[data-rotulo]');
    if (rotulo) rotulo.textContent = ativo ? 'Incluída no orçamento' : 'Incluir no orçamento';
  });
  document.querySelectorAll<HTMLElement>('[data-barra-selecao]').forEach((el) => { el.hidden = sel.length === 0; });
}

export function iniciarCarrinho() {
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-selecionar]');
    if (b) alternar(b.dataset.selecionar!);
  });
  document.addEventListener('kmbim:selecao', (e) => atualizarTela((e as CustomEvent<string[]>).detail));
  atualizarTela(lerSelecao());
}
