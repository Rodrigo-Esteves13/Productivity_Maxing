import { Controller, Get, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { SecurityActivityService } from './services/security-activity.service';
import { SECURITY_ACTIVITY_EXPORT_REQUESTS_PER_MINUTE } from './dto/auth-limits';
import { perMinute } from '../common/throttle.util';

// Export pessoal da atividade de seguranca (pagina Devices). Controller a
// parte para nao mexer no construtor do AuthController. So rotas literais.
@Controller('auth/security-activity')
export class SecurityActivityController {
  constructor(private readonly securityActivity: SecurityActivityService) {}

  @Get('export')
  @UseGuards(JwtAuthGuard)
  @Throttle(perMinute(SECURITY_ACTIVITY_EXPORT_REQUESTS_PER_MINUTE))
  exportActivity(@CurrentUser() user: AuthenticatedUser) {
    return this.securityActivity.exportForUser(user.id, user.sessionId);
  }
}
