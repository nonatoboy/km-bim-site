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

export interface Conteudo {
  configuracoes: Record<string, string>;
  categorias: Categoria[];
  solucoes: Solucao[];
  parceiros: Parceiro[];
  palestras: Palestra[];
  publicacoes: Publicacao[];
  reconhecimentos: Reconhecimento[];
  depoimentos: Depoimento[];
}

export const rotuloModalidade: Record<Modalidade, string> = {
  propria: 'Execução KM BIM',
  parceiro: 'Com parceiro',
  mista: 'KM BIM + parceiro',
};
