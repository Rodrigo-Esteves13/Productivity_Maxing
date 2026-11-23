import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EMAIL_MAX_LENGTH } from './auth-limits';
import { ForgotPasswordDto } from './forgot-password.dto';
import { ResendVerificationDto } from './verify-email.dto';
import { InviteToTurmaDto } from '../../turmas/dto/turma.dto';

// Email sintaticamente valido (partes dentro dos limites do RFC) mas com mais
// de EMAIL_MAX_LENGTH caracteres no total.
const LOCAL_PART_MAX = 64;
const DOMAIN_LABEL_MAX = 63;
const LONG_EMAIL = [
  'a'.repeat(LOCAL_PART_MAX),
  '@',
  ['b', 'c', 'd', 'e'].map((char) => char.repeat(DOMAIN_LABEL_MAX)).join('.'),
  '.com',
].join('');

type DtoClass = new () => object;

const constraintsOf = async (dto: DtoClass, email: string) =>
  (await validate(plainToInstance(dto, { email }))).flatMap((error) =>
    Object.keys(error.constraints ?? {}),
  );

describe('email DTOs share EMAIL_MAX_LENGTH (S-23)', () => {
  it('the test email is longer than the limit', () => {
    expect(LONG_EMAIL.length).toBeGreaterThan(EMAIL_MAX_LENGTH);
  });

  it.each([
    ['ForgotPasswordDto', ForgotPasswordDto],
    ['ResendVerificationDto', ResendVerificationDto],
    ['InviteToTurmaDto', InviteToTurmaDto],
  ])('%s rejects an email over the limit', async (_name, dto: DtoClass) => {
    expect(await constraintsOf(dto, LONG_EMAIL)).toContain('maxLength');
  });

  it.each([
    ['ForgotPasswordDto', ForgotPasswordDto],
    ['ResendVerificationDto', ResendVerificationDto],
    ['InviteToTurmaDto', InviteToTurmaDto],
  ])('%s accepts a normal email', async (_name, dto: DtoClass) => {
    expect(await constraintsOf(dto, 'Someone@Example.com')).toEqual([]);
  });
});
