import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Aceita a URL do projeto mesmo se copiada com /rest/v1 ou barra no final.
const url = (import.meta.env.PUBLIC_SUPABASE_URL as string | undefined)
  ?.trim()
  .replace(/\/+$/, '')
  .replace(/\/(rest|auth|storage|functions)\/v1$/, '');
const chave = (import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const supabaseConfigurado = Boolean(url && chave);

let cliente: SupabaseClient | null = null;

/** Cliente com a chave pública (anon). A segurança fica nas políticas RLS do banco. */
export function supabase(): SupabaseClient {
  if (!url || !chave) throw new Error('Defina PUBLIC_SUPABASE_URL e PUBLIC_SUPABASE_ANON_KEY no .env');
  cliente ??= createClient(url, chave);
  return cliente;
}
