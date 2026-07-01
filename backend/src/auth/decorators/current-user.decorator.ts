import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// Criamos um tipo seguro para evitar o uso de 'any'.
export interface RequestWithUser extends Request {
  user: Record<string, unknown>;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    // Avisamos o TypeScript: "Este request tem o formato RequestWithUser"
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    return req.user;
  },
);
