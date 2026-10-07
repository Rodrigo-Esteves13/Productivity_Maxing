import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

// Os dois clientes Supabase usados pelo modulo de autenticacao, criados uma
// unica vez. Antes viviam dentro do AuthService (1000+ linhas).
@Injectable()
export class SupabaseClientsService {
  // Anon key chega para signUp/signInWithPassword, sao os mesmos endpoints
  // publicos que o supabase-js usaria no browser, nao operacoes de admin.
  readonly anon: ReturnType<typeof createClient>;
  // Cliente separado com a Service Role Key: so este tem permissao para
  // escrever/apagar no bucket de avatars independentemente das RLS policies
  // e para usar a Admin API do Supabase Auth (necessario porque nem todos
  // os users passam pelo Supabase Auth - OAuth Google/GitHub/Discord nunca
  // cria sessao Supabase, so o email+password e que passa por la).
  readonly admin: ReturnType<typeof createClient>;

  constructor() {
    this.anon = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    );
    this.admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
}
