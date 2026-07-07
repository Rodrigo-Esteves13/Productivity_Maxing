import { createClient } from '@supabase/supabase-js';

// Usado APENAS pela página ResetPassword.tsx, para completar a sessão de
// recovery que vem no link do email (Supabase trata isso via URL
// hash/query automaticamente, `detectSessionInUrl: true`) e depois chamar
// supabase.auth.updateUser({ password }). O resto da app nunca usa este
// cliente - a sessão normal é sempre o nosso cookie HttpOnly + JWT
// (ver api/client.ts), não a sessão do Supabase.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Não rebenta a app inteira (só a página de reset é que precisa disto),
  // mas avisa alto no console em vez de falhar silenciosamente mais tarde.
  console.error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY em falta - a página de reset de password não vai funcionar.',
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    // A app normal não usa sessões Supabase persistidas (ver comentário
    // acima), por isso não vale a pena guardar isto em localStorage.
    persistSession: false,
    detectSessionInUrl: true,
  },
});