import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { normalizeEmail } from './email.util';

describe('email normalisation (E-01)', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Rodrigo@Example.TEST ')).toBe(
      'rodrigo@example.test',
    );
  });

  it.each([
    ['LoginDto', LoginDto, { password: 'password123' }],
    ['RegisterDto', RegisterDto, { password: 'password123' }],
    ['ForgotPasswordDto', ForgotPasswordDto, {}],
  ] as const)('%s lower-cases the email', async (_name, Dto, extra) => {
    const dto = plainToInstance(Dto, {
      ...extra,
      email: ' Rodrigo@Example.test',
    });
    expect(dto.email).toBe('rodrigo@example.test');
    expect(await validate(dto)).toHaveLength(0);
  });
});
