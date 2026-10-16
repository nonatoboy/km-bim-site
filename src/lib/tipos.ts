export type Modalidade = 'propria' | 'parceiro' | 'mista';

export interface Categoria { slug: string; nome: string; descricao: string; ordem: number }
export interface Solucao {
  slug: string; titulo: string; resumo: string; descricao: string; entregaveis: string[];
  publico: string; categoria: string; modalidade: Modalidade; destaque: boolean; ordem: number;
}
export interface Parceiro { nome: string; descricao: string; logo: string; site: string; solucoes: string[]; ordem: number }
export interface Palestra { titulo: string; evento: string; ano: number | null; cidade: string; link: string; imagem: string; ordem: number }
export interface Publicacao { titulo: string; veiculo: string; ano: number | null; link: string; ordem: number }
export interface Reconhecimento { tipo: 'formacao' | 'certificacao' | 'atuacao' | 'premio'; titulo: string; descricao: string; ano: string; ordem: number }
export interface Depoimento { autor: string; cargo: string; empresa: string; texto: string; foto: string; ordem: number }

export type TipoEvento = 'webinar' | 'treinamento' | 'roda_conversa' | 'workshop' | 'outro';
export interface Evento {
  id: string; slug: string; titulo: string; tipo: TipoEvento; modalidade: 'online' | 'presencial' | 'hibrido';
  resumo: string; descricao: string; publico_alvo: string; palestrante: string; local: string;
  inicio: string; fim: string; vagas: number | null; inscricoes_abertas: boolean; inscricoes_ate: string | null;
  preco: number | null; imagem: string; solucao_relacionada: string; ordem: number;
  listado: boolean; // false = só quem tem o link chega à página
}

export interface Conteudo {
  configuracoes: Record<string, string>;
  categorias: Categoria[];
  solucoes: Solucao[];
  parceiros: Parceiro[];
  palestras: Palestra[];
  publicacoes: Publicacao[];
  reconhecimentos: Reconhecimento[];
  depoimentos: Depoimento[];
  eventos: Evento[];
}

export const rotuloModalidade: Record<Modalidade, string> = {
  propria: 'Execução KM BIM',
  parceiro: 'Com parceiro',
  mista: 'KM BIM + parceiro',
};

export const rotuloTipoEvento: Record<TipoEvento, string> = {
  webinar: 'Webinar', treinamento: 'Treinamento', roda_conversa: 'Roda de conversa', workshop: 'Workshop', outro: 'Evento',
};
export const rotuloModalidadeEvento = { online: 'Online', presencial: 'Presencial', hibrido: 'Híbrido' } as const;

const FUSO = 'America/Sao_Paulo';
export const formatarData = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso));
export const formatarDataCurta = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: 'short' }).format(new Date(iso)).replace('.', '');
export const formatarHora = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export const formatarPreco = (v: number | null) => (!v ? 'Gratuito' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
export const formatarDia = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit' }).format(new Date(iso));
export const formatarMes = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, month: 'short' }).format(new Date(iso)).replace('.', '');
