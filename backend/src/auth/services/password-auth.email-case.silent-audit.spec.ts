import { PasswordAuthService } from './password-auth.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SupabaseClientsService } from './supabase-clients.service';
import type { MailService } from '../../mail/mail.service';
import type { AccountGuardService } from './account-guard.service';
import type { EmailVerificationService } from './email-verification.service';
import type { PasswordLinkService } from './password-link.service';

// Silent audit (area e): the local User mirror is looked up with
// findUnique({ email }) which is case-sensitive in Postgres (email is a
// plain String @unique, no citext), while Supabase Auth treats emails
// case-insensitively. Someone who registered as "Rodrigo@Example.test"
// (phone keyboards capitalise the first letter) and later logs in as
// "rodrigo@example.test" passes Supabase, misses the local row, and the
// create() of a second mirror collides on supabaseAuthId (P2002 -> 500).
// The login page only says "Invalid credentials or server error."

interface Row {
  id: string;
  email: string;
  supabaseAuthId: string | null;
  emailVerifiedAt: Date | null;
}

function setup() {
  const rows: Row[] = [
    {
      id: 'user-1',
      email: 'Rodrigo@Example.test',
      supabaseAuthId: 'sb-1',
      emailVerifiedAt: new Date(),
    },
  ];
  const prisma = {
    user: {
      // Postgres semantics: exact, case-sensitive match.
      findUnique: jest.fn(({ where }: { where: { email: string } }) =>
        Promise.resolve(rows.find((r) => r.email === where.email) ?? null),
      ),
      findFirst: jest.fn(() => Promise.resolve(rows[0])),
      update: jest.fn(),
      create: jest.fn(({ data }: { data: Row }) => {
        if (rows.some((r) => r.supabaseAuthId === data.supabaseAuthId)) {
          return Promise.reject(
            Object.assign(new Error('Unique constraint failed'), {
              code: 'P2002',
            }),
          );
        }
        rows.push(data);
        return Promise.resolve(data);
      }),
    },
    identity: { count: jest.fn().mockResolvedValue(0) },
  };
  const clients = {
    anon: {
      auth: {
        // Supabase lower-cases the email and accepts the password.
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { user: { id: 'sb-1', user_metadata: {} } },
          error: null,
        }),
      },
    },
  };
  const service = new PasswordAuthService(
    prisma as unknown as PrismaService,
    clients as unknown as SupabaseClientsService,
    {} as MailService,
    { assertAccountIsUsable: jest.fn() } as unknown as AccountGuardService,
    {
      needsVerification: () => false,
    } as unknown as EmailVerificationService,
    {} as PasswordLinkService,
  );
  return { service, rows };
}

describe('PasswordAuthService email case (silent audit)', () => {
  it('logs into the same account when the email is typed in another case', async () => {
    const { service, rows } = setup();
    const user = await service.loginWithPassword(
      'rodrigo@example.test',
      'correct-password',
    );
    expect(user.id).toBe('user-1');
    expect(rows).toHaveLength(1);
  });
});
