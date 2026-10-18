// Convites individuais: leitura da lista colada do Excel, telefones para o WhatsApp e textos padrão.
// O texto padrão do e-mail é o mesmo da Edge Function "convites" (supabase/functions/convites/index.ts).

export interface NovoConvidado { nome: string; email: string; telefone: string }

export const TEXTO_EMAIL_PADRAO = `Olá, {nome}!

Quero convidar você para {titulo}, {data}, pelo {local}.

{resumo}

O convite é pessoal e as vagas são limitadas. Para garantir a sua, inscreva-se pelo link:

{link}

Um abraço,
{palestrante}`;

export const ASSUNTO_PADRAO = 'Convite: {titulo}';

export const TEXTO_WHATSAPP_PADRAO = `Oi, {nome}! Aqui é o {quem}.

Quero convidar você para {tipo} *{titulo}*, {data}, pelo {local}.

O convite é pessoal e as vagas são limitadas. Para garantir a sua: {link}`;

// {tipo}: "a roda de conversa", "o webinar"… (com artigo, para caber em "convidar você para {tipo}")
export const TIPO_COM_ARTIGO: Record<string, string> = {
  webinar: 'o webinar', treinamento: 'o treinamento', roda_conversa: 'a roda de conversa', workshop: 'o workshop', outro: 'o evento',
};

// {quem}: nome curto de quem convida ("Marcelo Nonato Santos" → "Marcelo Nonato")
export const nomeCurto = (nome: string) => nome.trim().split(/\s+/).slice(0, 2).join(' ');

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Só dígitos, com DDI. Com "+" (formato do WhatsApp: +55 11 99907-1788, +1 (248) 760-6955) o DDI já vem no número;
// sem "+", números brasileiros com DDD (10 ou 11 dígitos) ganham o 55 na frente.
export function normalizarTelefone(v: string): string {
  const internacional = /^\s*(\+|00)/.test(v);
  let d = v.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (!internacional && (d.length === 10 || d.length === 11)) d = `55${d}`;
  return d.slice(0, 20);
}

// Número completo com DDI (o WhatsApp aceita de 10 a 15 dígitos)
export const telefoneValido = (t: string) => t.length >= 10 && t.length <= 15;

export function formatarTelefone(t: string): string {
  const m = t.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : t ? `+${t}` : '';
}

// Lista colada do Excel (colunas separadas por tabulação), CSV (; ou ,) ou digitada.
// As colunas podem vir em qualquer ordem: o e-mail tem @, o celular é feito de dígitos, o resto é o nome.
export function lerLista(texto: string): { convidados: NovoConvidado[]; ignoradas: string[] } {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const convidados: NovoConvidado[] = [];
  const ignoradas: string[] = [];
  for (const linha of linhas) {
    let nome = '';
    let email = '';
    let telefone = '';
    const sep = linha.includes('\t') ? '\t' : linha.includes(';') ? ';' : ',';
    for (const bruto of linha.split(sep)) {
      const c = bruto.trim().replace(/^"(.*)"$/, '$1').trim();
      if (!c) continue;
      if (!email && EMAIL.test(c)) email = c.toLowerCase();
      else if (!telefone && /^[\d\s()+.\-]+$/.test(c) && c.replace(/\D/g, '').length >= 8) telefone = normalizarTelefone(c);
      else if (!nome) nome = c.replace(/\s+/g, ' ');
    }
    if (!email && !telefone) {
      if (!/^nome\b/i.test(nome)) ignoradas.push(linha); // a linha de cabeçalho não conta como erro
      continue;
    }
    if (!nome) nome = email ? email.split('@')[0] : formatarTelefone(telefone);
    convidados.push({ nome: nome.slice(0, 120), email: email.slice(0, 200), telefone });
  }
  return { convidados, ignoradas };
}

// Troca {nome}, {titulo}, {data}… pelos valores; o que não for conhecido fica como está.
export const preencher = (modelo: string, valores: Record<string, string>) =>
  modelo.replace(/\{(\w+)\}/g, (m, k) => valores[k] ?? m);

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? '';

// "quarta-feira, 18 de novembro, às 18:00" (horário de Brasília)
export function dataConvite(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso)).replace(' às ', ', às ');
}
