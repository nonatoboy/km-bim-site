-- Link da página da KM BIM no LinkedIn, editável em "Textos gerais" no painel.
insert into public.configuracoes (chave, valor)
values ('linkedin_empresa_url', 'https://www.linkedin.com/company/km-consultoria-bim')
on conflict (chave) do nothing;
