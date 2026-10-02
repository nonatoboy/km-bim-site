-- Gerado por scripts/gerar-seed.mjs. Não edite à mão.
-- Carga inicial de conteúdo. Pode ser executado mais de uma vez sem duplicar configurações, categorias e soluções.
insert into public.configuracoes (chave, valor) values
  ('tagline', 'Conhecimento que constrói.'),
  ('home_titulo', 'Consultoria BIM para quem constrói com precisão'),
  ('home_subtitulo', 'Digitalizamos processos de projeto, planejamento e obra em empresas de arquitetura, engenharia e construção de pequeno e médio porte, com soluções sob medida e mais de 30 anos de experiência de canteiro, sistemas e BIM.'),
  ('sobre_empresa', 'A KM BIM nasceu para levar a pequenas e médias empresas da cadeia AEC a mesma maturidade digital que grandes construtoras levaram anos para construir. Atuamos do diagnóstico à operação assistida, com método, normas (ABNT/ISO 19650) e foco em resultado de obra. Quando o escopo pede execução em escala, como modelagem ou captura da realidade, trabalhamos com parceiros selecionados, sempre sob a coordenação técnica da KM BIM.'),
  ('socio_nome', 'Marcelo Nonato Santos'),
  ('socio_cargo', 'Sócio proprietário'),
  ('socio_bio', 'Engenheiro civil pela Escola Politécnica da USP, com mais de 30 anos entre canteiro, planejamento, custos, sistemas e construção virtual. Liderou a implantação de BIM e de sistemas corporativos em uma das maiores construtoras do país e estruturou áreas de serviços BIM, inovação e gestão do conhecimento em consultoria de tecnologia. Na KM BIM, leva essa experiência a empresas de pequeno e médio porte, com soluções sob medida.'),
  ('socio_foto', '/img/marcelo-nonato-santos.jpg'),
  ('linkedin_url', 'https://www.linkedin.com/in/marcelo-nonato-santos'),
  ('linkedin_empresa_url', 'https://www.linkedin.com/company/km-consultoria-bim'),
  ('cnpj', ''),
  ('aviso_privacidade', 'Os dados informados serão usados somente para analisar sua solicitação e entrar em contato sobre a proposta. Não compartilhamos seus dados com terceiros e você pode pedir a exclusão a qualquer momento.')
on conflict (chave) do nothing;

insert into public.categorias (slug, nome, descricao, ordem) values
  ('estrategia', 'Estratégia', 'Decidir e estruturar a adoção do BIM.', 1),
  ('projeto', 'Projeto', 'Modelar, coordenar e compatibilizar.', 2),
  ('obra', 'Obra', 'Planejar, orçar e controlar a produção.', 3),
  ('dados', 'Dados', 'Integrar sistemas e apoiar decisões.', 4),
  ('pessoas', 'Pessoas', 'Capacitar equipes para operar o novo processo.', 5)
on conflict (slug) do nothing;

insert into public.solucoes (slug, titulo, resumo, descricao, entregaveis, publico, categoria, modalidade, destaque, ordem) values
  ('diagnostico-maturidade-bim', 'Diagnóstico de maturidade BIM', 'Mapeamento de processos, pessoas e ferramentas, com plano de evolução priorizado.', 'Avaliamos como sua empresa produz, troca e controla informação hoje: processos de projeto e obra, papéis, ferramentas, padrões e contratos. O resultado é um retrato claro do nível de maturidade e um plano de evolução com metas de 6, 12 e 24 meses, investimentos estimados e ganhos esperados.', array['Relatório de maturidade por dimensão', 'Mapa dos processos atuais', 'Plano de evolução priorizado (6, 12 e 24 meses)', 'Apresentação executiva para a diretoria']::text[], 'Empresas que querem começar ou retomar a adoção do BIM com clareza de prioridades.', 'estrategia', 'propria', true, 1),
  ('implantacao-bim-iso-19650', 'Implantação BIM conforme ISO 19650', 'Requisitos de informação, Plano de Execução BIM, padrões e fluxos Open BIM.', 'Estruturamos a gestão da informação segundo a série ABNT NBR ISO 19650: requisitos de informação da organização, do ativo e de troca (OIR, AIR, EIR), Plano de Execução BIM (BEP), nomenclatura, templates e fluxos Open BIM baseados em IFC. Acompanhamos o primeiro projeto piloto até a operação estável.', array['OIR, AIR e EIR', 'Plano de Execução BIM (BEP)', 'Padrões de nomenclatura e templates', 'Acompanhamento do projeto piloto']::text[], 'Construtoras, incorporadoras e projetistas que precisam padronizar entregas e contratar BIM com segurança.', 'estrategia', 'propria', true, 2),
  ('cde-governanca-informacao', 'Ambiente comum de dados (CDE) e governança', 'Estruturação do CDE, estados da informação, permissões e rotinas de aprovação.', 'Configuramos o ambiente comum de dados do seu projeto ou da empresa: estrutura de pastas e contêineres, estados da informação (em andamento, compartilhado, publicado, arquivado), permissões, fluxos de revisão e aprovação. Incluímos auditorias periódicas de aderência para manter a governança viva.', array['Estrutura do CDE configurada', 'Matriz de papéis e permissões', 'Fluxos de aprovação documentados', 'Roteiro de auditoria de aderência']::text[], 'Empresas com muitos projetistas e versões circulando por e-mail ou pastas soltas.', 'estrategia', 'propria', false, 3),
  ('coordenacao-compatibilizacao', 'Coordenação e compatibilização multidisciplinar', 'Detecção de interferências, reuniões de coordenação e controle de pendências.', 'Federamos os modelos das disciplinas, executamos a detecção de interferências com regras por fase de projeto e conduzimos reuniões de coordenação com registro e acompanhamento das pendências até a solução. O objetivo é chegar à obra com o projeto resolvido.', array['Modelo federado', 'Relatórios de interferências por rodada', 'Atas e lista de pendências', 'Indicadores de evolução da compatibilização']::text[], 'Incorporadoras e construtoras que recebem projetos de vários escritórios.', 'projeto', 'propria', true, 1),
  ('modelagem-bim-acervo-2d', 'Modelagem BIM e conversão de acervo 2D', 'Modelos paramétricos a partir de projetos 2D, com controle de qualidade KM BIM.', 'Convertemos projetos em 2D em modelos BIM paramétricos, com nível de informação definido para o uso pretendido: quantitativos, planejamento, operação ou manutenção. A produção é feita por parceiros qualificados, com fluxo padronizado e controle de qualidade da KM BIM.', array['Modelos BIM por disciplina', 'Relatório de verificação de qualidade', 'Arquivos nativos e IFC']::text[], 'Empresas que precisam do modelo mas não têm equipe de modelagem.', 'projeto', 'parceiro', false, 2),
  ('captura-da-realidade', 'Captura da realidade', 'Laser scanning, fotogrametria com drone e Scan-to-BIM.', 'Levantamos a condição real de edificações, terrenos e obras com laser scanning e fotogrametria, e transformamos as nuvens de pontos em modelos BIM ou em comparativos com o projeto. Aplicações típicas: retrofit, as built, medição de avanço e controle de volumes.', array['Nuvem de pontos registrada', 'Ortomosaicos e modelos de superfície', 'Modelo Scan-to-BIM', 'Relatório projeto × executado']::text[], 'Retrofit, reformas, infraestrutura e acompanhamento de obras.', 'projeto', 'parceiro', true, 3),
  ('planejamento-4d-quantitativos-5d', 'Planejamento 4D e quantitativos 5D', 'Modelo vinculado ao cronograma e ao orçamento para simular e quantificar.', 'Vinculamos o modelo BIM ao cronograma e à estrutura de custos. Com isso a equipe simula fases de obra, avalia construtibilidade, identifica conflitos de sequência e extrai quantitativos rastreáveis para orçamento e compras.', array['Simulação 4D por etapa', 'Quantitativos extraídos do modelo', 'Relatório de construtibilidade', 'Vínculo EAP × modelo documentado']::text[], 'Construtoras que querem orçar e planejar com mais precisão.', 'obra', 'propria', true, 1),
  ('controle-digital-de-obras', 'Controle digital de obras', 'EAP, estrutura de custos, avanço físico e apropriação integrados ao modelo.', 'Estruturamos a EAP e a estrutura analítica de custos (CBS), os critérios de medição de avanço físico e a apropriação de mão de obra e equipamentos, conectando campo, planejamento e modelo. Resultado: curvas de avanço confiáveis e decisões tomadas com dados da semana, não do mês passado.', array['EAP e CBS padronizadas', 'Critérios de medição de avanço', 'Rotina de apropriação em campo', 'Curvas e relatórios de avanço']::text[], 'Construtoras com várias obras e controles em planilhas desconectadas.', 'obra', 'propria', false, 2),
  ('integracao-dados-paineis', 'Integração de dados e painéis de gestão', 'Power BI, Power Apps e integração do BIM com os sistemas da empresa.', 'Conectamos o modelo e o ambiente comum de dados aos sistemas que a empresa já usa, como orçamento, planejamento e ERP, e construímos painéis Power BI e aplicativos Power Apps para coleta em campo. A experiência em implantação de sistemas corporativos garante integrações estáveis e dados confiáveis.', array['Painéis de indicadores de projeto e obra', 'Aplicativos de coleta em campo', 'Mapa de integrações entre sistemas', 'Rotinas de atualização e qualidade de dados']::text[], 'Empresas que já produzem dados, mas não conseguem usá-los para decidir.', 'dados', 'propria', true, 1),
  ('capacitacao-mentoria', 'Capacitação e mentoria de equipes', 'Treinamentos sob medida e mentoria na operação assistida.', 'Treinamentos desenhados para a realidade da sua empresa em BIM, ISO 19650, coordenação e controle de empreendimentos, seguidos de mentoria durante a operação assistida. Ministrados por quem formou equipes de engenharia de obra e de escritório central em grandes construtoras.', array['Plano de capacitação por perfil', 'Turmas presenciais ou on-line', 'Material didático', 'Mentoria na operação assistida']::text[], 'Equipes que vão operar o novo processo no dia a dia.', 'pessoas', 'propria', false, 1)
on conflict (slug) do nothing;

-- As tabelas abaixo não têm chave natural: rode este bloco só uma vez.
-- parceiros: sem registros iniciais

-- palestras: sem registros iniciais

insert into public.publicacoes (titulo, veiculo, ano, link, ordem) values
  ('Integrating Power BI and BIM 360 Through Forge for Dynamic Construction Analytics', 'Artigo técnico', null, '', 1),
  ('Extração estruturada de quantitativos com uso de AutoCAD Civil 3D e Navisworks: aplicação prática', 'Trabalho técnico', null, '', 2),
  ('Uso de geoprocessamento no gerenciamento da obra', 'Publicação técnica', null, '', 3)
;

insert into public.reconhecimentos (tipo, titulo, descricao, ano, ordem) values
  ('formacao', 'Engenharia Civil', 'Escola Politécnica da USP', '1992', 1),
  ('formacao', 'Pós-graduação em Gestão de Projetos', 'IETEC', '', 2),
  ('certificacao', 'buildingSMART Professional Certification · Foundation', 'buildingSMART International', '', 3),
  ('atuacao', 'Palestrante em três edições da Autodesk University', 'Principal congresso de tecnologia aplicada a projeto, construção e manufatura', '', 4),
  ('atuacao', 'Coordenador da Divisão Técnica de Tecnologias Digitais', 'Instituto de Engenharia de São Paulo', '2020–2024', 5),
  ('atuacao', 'Instrutor especialista', 'BuildLab Academy', '2022–2026', 6),
  ('premio', 'Prêmio de Inovação Técnica', 'Sistema de apropriação eletrônica de mão de obra nos canteiros', '', 7),
  ('premio', 'Prêmio Infra i9', 'Inovação em processos construtivos e gestão de infraestrutura', '', 8),
  ('premio', 'Divisão Técnica Mais Atuante do Ano', 'Instituto de Engenharia, Divisão de Tecnologias Digitais', '2020', 9)
;

-- depoimentos: sem registros iniciais
