import type { User } from '@prisma/client';

// Dependencias injetadas para a logica poder ser testada sem Supabase nem BD.
export interface MergeHardeningDeps {
  // Troca a password no Supabase Auth. Devolve o erro (ou null se correu bem).
  replacePassword: (
    supabaseAuthId: string,
    newPassword: string,
  ) => Promise<{ message: string; status?: number; code?: string } | null>;
  // Sobe a versao das sessoes do utilizador e devolve-o atualizado.
  revokeSessions: (userId: string) => Promise<User>;
  generatePassword: () => string;
}

export class MergeHardeningError extends Error {}

function isCredentialMissing(error: {
  status?: number;
  code?: string;
}): boolean {
  return error.status === 404 || error.code === 'user_not_found';
}

/**
 * SCR-001: um login OAuth com email verificado acaba de ser fundido numa
 * conta local ja existente. Se essa conta foi criada com password e nunca
 * teve nenhum login OAuth, quem a criou pode nao ser o dono do email (o
 * registo nao exige confirmacao): o email verificado pelo provider prova
 * quem e o dono, por isso a password antiga e as sessoes abertas com ela
 * deixam de valer. O dono define uma nova por "esqueci a password".
 *
 * Contas que ja tinham algum login OAuth ficam como estao: nao e um
 * primeiro merge e o dono ja tinha provado o email.
 */
export async function neutralizePreexistingCredential(
  deps: MergeHardeningDeps,
  user: User,
  existingIdentityCount: number,
): Promise<User> {
  if (!user.supabaseAuthId || existingIdentityCount > 0) return user;

  const error = await deps.replacePassword(
    user.supabaseAuthId,
    deps.generatePassword(),
  );
  if (error) {
    // O Supabase nao conhece esta credencial: nao ha password para invalidar.
    if (isCredentialMissing(error)) return user;
    // Falha a fechar: se nao conseguimos invalidar a password, nao deixamos
    // o login avancar com a conta ainda acessivel a quem a registou.
    throw new MergeHardeningError(
      `Could not secure the account: ${error.message}`,
    );
  }
  return deps.revokeSessions(user.id);
}
