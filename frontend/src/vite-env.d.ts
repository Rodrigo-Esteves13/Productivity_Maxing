/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  // Necessárias só para completar o link de reset/definição de password
  // (a Supabase entrega o token de recovery na URL do redirectTo, e só o
  // JS do browser o consegue ler - o backend nunca vê esse token). A anon
  // key é segura de expor no frontend por design, protegida por RLS do
  // lado do Supabase - não é um segredo.
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}