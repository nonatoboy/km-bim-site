// Gera o modelo de proposta técnica e comercial da KM BIM (Word) em brand/proposta/.
// Uso: node brand/scripts/gerar-proposta.cjs   (requer: npm i --no-save docx)
// Campos entre [colchetes], em âmbar, devem ser substituídos a cada proposta.
const fs = require('fs'); const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Header, Footer, AlignmentType, HeadingLevel,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, PageNumber, PageBreak,
  LevelFormat, TabStopType, VerticalAlign, TableLayoutType,
} = require('docx');

const raiz = path.join(__dirname, '..', '..');
const COR = { grafite: '1C2A31', petroleo: '0B5563', ciano: '1BA8B8', ambar: 'F2A33A', ambarTexto: 'B86E0A', nevoa: 'EEF3F4', cinza: '56666D', linha: 'D6DFE1' };
const FONTE = 'Calibri';
const TITULO = 'Segoe UI Semibold';

// A4 com margens de 2,5 cm (1 cm = 567 DXA)
const LARG_UTIL = 11906 - 2 * 1418;

const t = (texto, o = {}) => new TextRun({ text: texto, font: FONTE, size: 21, color: COR.grafite, ...o });
// Campo a preencher: âmbar, itálico
const campo = (texto, o = {}) => new TextRun({ text: `[${texto}]`, font: FONTE, size: 21, color: COR.ambarTexto, italics: true, ...o });
const p = (filhos, o = {}) => new Paragraph({ children: Array.isArray(filhos) ? filhos : [filhos], spacing: { after: 120, line: 300 }, ...o });
const orient = (texto) => p([t(texto, { italics: true, color: COR.cinza, size: 19 })]);
const h1 = (texto) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: texto })] });
const h2 = (texto) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: texto })] });
const item = (filhos) => new Paragraph({ numbering: { reference: 'marcadores', level: 0 }, children: Array.isArray(filhos) ? filhos : [filhos], spacing: { after: 60, line: 288 } });
const etapa = (filhos) => new Paragraph({ numbering: { reference: 'etapas', level: 0 }, children: Array.isArray(filhos) ? filhos : [filhos], spacing: { after: 80, line: 288 } });

const bordaFina = { style: BorderStyle.SINGLE, size: 4, color: COR.linha };
const bordas = { top: bordaFina, bottom: bordaFina, left: bordaFina, right: bordaFina };

function tabela(larguras, cabecalho, linhas, { total } = {}) {
  const soma = larguras.reduce((a, b) => a + b, 0);
  const cel = (conteudo, i, { cab = false, destaque = false } = {}) => new TableCell({
    width: { size: larguras[i], type: WidthType.DXA },
    borders: bordas,
    verticalAlign: VerticalAlign.CENTER,
    shading: cab ? { type: ShadingType.CLEAR, color: 'auto', fill: COR.petroleo } : destaque ? { type: ShadingType.CLEAR, color: 'auto', fill: COR.nevoa } : undefined,
    margins: { top: 80, bottom: 80, left: 110, right: 110 },
    children: [new Paragraph({
      spacing: { after: 0 },
      keepNext: true, // mantém a tabela inteira na mesma página
      children: (Array.isArray(conteudo) ? conteudo : [conteudo]).map((c) => typeof c === 'string'
        ? t(c, cab ? { bold: true, color: 'FFFFFF', size: 19 } : { size: 19, bold: destaque })
        : c),
    })],
  });
  const rows = [
    new TableRow({ tableHeader: true, cantSplit: true, children: cabecalho.map((c, i) => cel(c, i, { cab: true })) }),
    ...linhas.map((l) => new TableRow({ cantSplit: true, children: l.map((c, i) => cel(c, i)) })),
  ];
  if (total) rows.push(new TableRow({ children: total.map((c, i) => cel(c, i, { destaque: true })) }));
  return new Table({ width: { size: soma, type: WidthType.DXA }, columnWidths: larguras, layout: TableLayoutType.FIXED, rows });
}
const c = (texto) => campo(texto, { size: 19 });

const img = (arq, largura, altura) => new ImageRun({ type: 'png', data: fs.readFileSync(path.join(raiz, arq)), transformation: { width: largura, height: altura } });

// ---------------------------------------------------------------- capa
const capa = [
  new Paragraph({ spacing: { before: 1400, after: 600 }, alignment: AlignmentType.LEFT, children: [img('brand/png/km-bim-vertical-positivo.png', 190, 163)] }),
  new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: 'PROPOSTA TÉCNICA E COMERCIAL', font: TITULO, size: 22, color: COR.ambarTexto, characterSpacing: 40 })] }),
  new Paragraph({ spacing: { after: 400 }, border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: COR.ambar, space: 12 } },
    children: [campo('Título da proposta, ex.: Implantação BIM conforme ISO 19650', { font: TITULO, size: 44, italics: false })] }),
  p([t('Cliente: ', { bold: true }), campo('Razão social do cliente')]),
  p([t('A/C: ', { bold: true }), campo('Nome e cargo do contato')]),
  p([t('Proposta nº: ', { bold: true }), campo('KM-AAAA-000')]),
  p([t('Data: ', { bold: true }), campo('dd/mm/aaaa'), t('    Validade: ', { bold: true }), t('30 dias')]),
  new Paragraph({ spacing: { before: 2200 }, children: [t('Conhecimento que constrói.', { font: TITULO, color: COR.petroleo, size: 24 })] }),
  p([t('KM Consultoria BIM Ltda · kmbim.com.br · contato@kmbim.com.br', { color: COR.cinza, size: 18 })]),
  new Paragraph({ children: [new PageBreak()] }),
];

// ---------------------------------------------------------------- corpo
const corpo = [
  h1('1. Apresentação'),
  p([t('A KM BIM Consultoria apoia empresas de arquitetura, engenharia e construção na digitalização de seus processos de projeto, planejamento e obra. Atuamos do diagnóstico à operação assistida, com método, normas (ABNT NBR ISO 19650) e foco em resultado de obra.')]),
  p([t('A empresa é conduzida por Marcelo Nonato Santos, engenheiro civil pela Escola Politécnica da USP, com mais de 30 anos de experiência em canteiro, planejamento, custos, sistemas corporativos e construção virtual, palestrante em três edições da Autodesk University e certificado buildingSMART.')]),
  p([t('Agradecemos a oportunidade de apresentar esta proposta a '), campo('nome do cliente'), t('.')]),

  h1('2. Entendimento da necessidade'),
  orient('Descreva com as palavras do cliente o contexto e o problema. Mostrar que entendeu é o que mais pesa na decisão.'),
  p([t('Contexto: '), campo('porte da empresa, tipo de empreendimento, fase atual, ferramentas em uso')]),
  p([t('Desafio: '), campo('o que motivou o contato, ex.: interferências descobertas em obra, retrabalho, falta de padrão nas entregas')]),
  p([t('Objetivo: '), campo('resultado esperado, ex.: padronizar a coordenação dos projetos recebidos e reduzir retrabalho em obra')]),

  h1('3. Escopo dos serviços'),
  orient('Use as soluções do catálogo do site (kmbim.com.br/solucoes). Remova as linhas que não se aplicam.'),
  tabela([700, 2600, 3870, 1900], ['Nº', 'Solução', 'Descrição do serviço', 'Entregáveis'], [
    ['1', [c('Diagnóstico de maturidade BIM')], [c('Mapeamento de processos, pessoas e ferramentas')], [c('Relatório e plano de evolução')]],
    ['2', [c('Implantação BIM conforme ISO 19650')], [c('Requisitos de informação, BEP, padrões e templates')], [c('OIR/AIR/EIR, BEP, templates')]],
    ['3', [c('Solução')], [c('Descrição')], [c('Entregáveis')]],
  ]),
  p([], { spacing: { after: 60 } }),
  h2('Fora do escopo'),
  item([campo('ex.: modelagem de disciplinas, aquisição de licenças de software, execução de obra')]),
  item([campo('ex.: deslocamentos fora da Grande São Paulo, salvo se previstos no item 8')]),

  h1('4. Metodologia e etapas'),
  etapa([t('Mobilização: ', { bold: true }), t('reunião de partida, alinhamento de expectativas, definição do ponto focal e do cronograma detalhado.')]),
  etapa([t('Levantamento: ', { bold: true }), t('entrevistas, análise de documentos, modelos e processos atuais.')]),
  etapa([t('Desenvolvimento: ', { bold: true }), campo('atividades principais do escopo')]),
  etapa([t('Validação: ', { bold: true }), t('apresentação dos resultados, ajustes e aprovação dos entregáveis.')]),
  etapa([t('Transferência: ', { bold: true }), t('capacitação da equipe e operação assistida, quando prevista.')]),

  h1('5. Cronograma'),
  tabela([3870, 1900, 3300], ['Etapa', 'Prazo', 'Marco / entregável'], [
    ['Mobilização', [c('semana 1')], 'Reunião de partida e plano detalhado'],
    ['Levantamento', [c('semanas 2 a 3')], [c('Relatório de levantamento')]],
    ['Desenvolvimento', [c('semanas 4 a 8')], [c('Entregáveis do escopo')]],
    ['Validação e transferência', [c('semanas 9 a 10')], 'Aprovação final e capacitação'],
  ]),
  p([t('Prazo total estimado: ', { bold: true }), campo('10 semanas'), t(', contado a partir da reunião de partida.')], { spacing: { before: 120, after: 120 } }),

  h1('6. Equipe e responsabilidade técnica'),
  p([t('Coordenação técnica e responsabilidade: ', { bold: true }), t('Eng. Marcelo Nonato Santos, '), campo('CREA-SP nº')]),
  p([t('Parceiros: ', { bold: true }), campo('quando houver, ex.: modelagem ou captura da realidade por parceiro qualificado, sob coordenação da KM BIM')]),
  p([t('Será emitida Anotação de Responsabilidade Técnica (ART) junto ao CREA para os serviços desta proposta.')]),

  h1('7. Responsabilidades do cliente'),
  item(t('Indicar um ponto focal com autonomia para decisões e aprovações.')),
  item(t('Fornecer projetos, modelos, documentos e acessos necessários (CDE, sistemas) nos prazos combinados.')),
  item(t('Garantir a participação das equipes nas entrevistas, reuniões e capacitações.')),
  item(t('Aprovar ou comentar os entregáveis em até 5 dias úteis após o recebimento.')),

  h1('8. Investimento'),
  tabela([700, 4870, 1500, 2000], ['Nº', 'Descrição', 'Quantidade', 'Valor (R$)'], [
    ['1', [c('Solução / etapa')], [c('xx h')], [c('0,00')]],
    ['2', [c('Solução / etapa')], [c('xx h')], [c('0,00')]],
    ['3', [c('Despesas de deslocamento, se houver')], [c('verba')], [c('0,00')]],
  ], { total: ['', 'Total', '', [campo('0,00', { size: 19, bold: true, italics: false })]] }),
  p([], { spacing: { after: 60 } }),
  h2('Condições de pagamento'),
  item([campo('ex.: 30% na assinatura e 70% em parcelas mensais, conforme entrega das etapas')]),
  item(t('Faturamento por nota fiscal de serviços, com vencimento em 15 dias da emissão.')),
  item([t('Valores com impostos inclusos.')]),

  h1('9. Condições gerais'),
  item([t('Validade da proposta: ', { bold: true }), t('30 dias a partir da data de emissão.')]),
  item([t('Alterações de escopo: ', { bold: true }), t('serviços não previstos no item 3 serão orçados à parte e iniciados após aprovação.')]),
  item([t('Reajuste: ', { bold: true }), t('contratos com duração superior a 12 meses serão reajustados anualmente pelo IPCA.')]),
  item([t('Confidencialidade: ', { bold: true }), t('as informações do cliente serão usadas exclusivamente para a execução dos serviços e não serão divulgadas a terceiros.')]),
  item([t('Propriedade intelectual: ', { bold: true }), t('os entregáveis produzidos para o cliente passam a ser de sua propriedade após a quitação; métodos, modelos de documentos e ferramentas da KM BIM permanecem de propriedade da KM BIM.')]),
  item([t('Proteção de dados: ', { bold: true }), t('o tratamento de dados pessoais seguirá a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).')]),

  h1('10. Aceite'),
  p([t('De acordo com os termos desta proposta.')]),
  new Paragraph({ spacing: { before: 200 }, children: [] }),
  tabela([4535, 4535], ['KM Consultoria BIM Ltda', [campo('Razão social do cliente', { size: 19, color: 'FFFFFF', bold: true })]], [
    [[t(' ', { size: 19 })], [t(' ', { size: 19 })]],
    ['_______________________________', '_______________________________'],
    ['Marcelo Nonato Santos · Sócio proprietário', [c('Nome e cargo')]],
    [[t('Data: '), c('dd/mm/aaaa')], [t('Data: '), c('dd/mm/aaaa')]],
  ]),
];

// ---------------------------------------------------------------- cabeçalho e rodapé (a partir da página 2)
const cabecalho = new Header({ children: [new Paragraph({
  tabStops: [{ type: TabStopType.RIGHT, position: LARG_UTIL }],
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COR.linha, space: 6 } },
  children: [img('brand/png/km-bim-horizontal-positivo.png', 110, 40), new TextRun({ text: '\tProposta nº ', font: FONTE, size: 17, color: COR.cinza }), campo('KM-AAAA-000', { size: 17 })],
})] });
const rodape = new Footer({ children: [new Paragraph({
  tabStops: [{ type: TabStopType.RIGHT, position: LARG_UTIL }],
  border: { top: { style: BorderStyle.SINGLE, size: 6, color: COR.ambar, space: 6 } },
  children: [
    new TextRun({ text: 'KM Consultoria BIM Ltda · kmbim.com.br · contato@kmbim.com.br', font: FONTE, size: 16, color: COR.cinza }),
    new TextRun({ children: ['\tPágina ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], font: FONTE, size: 16, color: COR.cinza }),
  ],
})] });

const doc = new Document({
  creator: 'KM Consultoria BIM Ltda',
  title: 'Proposta técnica e comercial · KM BIM',
  styles: {
    default: { document: { run: { font: FONTE, size: 21, color: COR.grafite } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: TITULO, size: 30, color: COR.petroleo },
        paragraph: { spacing: { before: 360, after: 140 }, outlineLevel: 0, keepNext: true } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: TITULO, size: 23, color: COR.grafite },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1, keepNext: true } },
    ],
  },
  numbering: { config: [
    { reference: 'marcadores', levels: [{ level: 0, format: LevelFormat.BULLET, text: '▪', alignment: AlignmentType.LEFT,
      style: { run: { color: COR.ambar }, paragraph: { indent: { left: 400, hanging: 260 } } } }] },
    { reference: 'etapas', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
      style: { run: { color: COR.petroleo, bold: true }, paragraph: { indent: { left: 400, hanging: 320 } } } }] },
  ] },
  sections: [{
    properties: {
      page: { size: { width: 11906, height: 16838 }, margin: { top: 1418, bottom: 1300, left: 1418, right: 1418, header: 600, footer: 600 } },
      titlePage: true,
    },
    headers: { default: cabecalho, first: new Header({ children: [new Paragraph({ children: [] })] }) },
    footers: { default: rodape, first: new Footer({ children: [new Paragraph({ children: [] })] }) },
    children: [...capa, ...corpo],
  }],
});

const destino = path.join(raiz, 'brand/proposta/km-bim-proposta-modelo.docx');
fs.mkdirSync(path.dirname(destino), { recursive: true });
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(destino, buf); console.log('Gerado:', destino); });
