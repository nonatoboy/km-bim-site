# Marca KM BIM

Manual resumido da identidade visual da **KM Consultoria BIM Ltda**.

## Conceito

O símbolo é uma pista em perspectiva passando sob uma viga de viaduto, com a faixa central em âmbar formando marcas quilométricas. O "KM" tem três leituras:

- as iniciais de **K**yuma e **M**arcelo;
- **K**nowledge **M**anagement, a gestão do conhecimento que atravessa a carreira do sócio;
- o **km** das rodovias: avanço medido, obra progredindo.

Assinatura: **Conhecimento que constrói.**

## Arquivos

| Pasta | Conteúdo |
| --- | --- |
| `logo/` | SVGs vetoriais (texto em curvas, não dependem de fonte) |
| `png/` | PNGs com fundo transparente, 4× o tamanho nominal |
| `fontes/` | Saira 600 e 800 (licença SIL Open Font License) |
| `scripts/` | Geradores dos arquivos acima |

Versões: `vertical` (símbolo sobre o nome, uso principal), `horizontal` (cabeçalhos, assinatura de e-mail), `simbolo` e `icone` (favicon, avatar de redes sociais). Cada uma em `positivo` (fundo claro), `negativo` (fundo escuro), `mono-escuro` e `mono-branco` (uma cor só, para gravação, carimbo, fax, bordado).

Para regenerar depois de mudar o desenho: `python3 brand/scripts/gerar-logos.py && node brand/scripts/exportar-png.cjs`.

## Cores

| Nome | Hex | Uso |
| --- | --- | --- |
| Grafite | `#1C2A31` | Textos, fundos escuros, símbolo em positivo |
| Petróleo | `#0B5563` | Cor principal: "BIM" no logo, links, botões primários |
| Ciano BIM | `#1BA8B8` | "BIM" em fundo escuro, destaques digitais |
| Âmbar | `#F2A33A` | Marcas quilométricas, botões de ação, detalhes |
| Névoa | `#EEF3F4` | Fundos claros alternados, símbolo em negativo |

Âmbar é cor de destaque: use em pequenas áreas (botões, marcadores, linhas). Texto em âmbar só sobre grafite.

## Tipografia

- **Saira** (600 a 800): títulos e logotipo.
- **IBM Plex Sans** (400 a 600): textos corridos.
- **IBM Plex Mono** (500): rótulos, números, normas (ISO 19650, LOD 350).

Todas gratuitas no Google Fonts.

## Regras de uso

- Área de proteção ao redor do logo: no mínimo a altura da letra "K".
- Tamanho mínimo: versão vertical com 80 px (ou 20 mm) de largura; abaixo disso, use o `icone`.
- Não distorcer, não aplicar sombra, não trocar as cores fora das versões previstas, não colocar a versão positiva sobre fotos escuras.
