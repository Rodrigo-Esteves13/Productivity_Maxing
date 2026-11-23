import { ParseUUIDPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { AuthController } from './auth.controller';

// file-type e ESM puro (usado pelo AvatarService), o Jest nao o transforma.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));

type RouteArg = { index: number; data?: string; pipes?: unknown[] };

function idParamPipes(method: keyof AuthController): unknown[] {
  const args = (Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    AuthController,
    method,
  ) ?? {}) as Record<string, RouteArg>;
  const idArg = Object.values(args).find((arg) => arg.data === 'id');
  return idArg?.pipes ?? [];
}

// S-22: ids de rota validados antes de chegarem a BD (400 em vez de 500).
describe('AuthController :id params use ParseUUIDPipe', () => {
  it.each(['revokeApiKey', 'revokeSession'] as const)('%s', (method) => {
    expect(idParamPipes(method)).toContain(ParseUUIDPipe);
  });
});
