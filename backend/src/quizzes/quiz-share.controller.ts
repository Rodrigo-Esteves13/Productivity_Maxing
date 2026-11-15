import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { perMinute } from '../common/throttle.util';
import { QuizShareService } from './quiz-share.service';
import {
  QUIZ_SHARE_ADDS_PER_MINUTE,
  QUIZ_SHARE_LISTS_PER_MINUTE,
  QUIZ_SHARE_PREVIEWS_PER_MINUTE,
} from './quizzes.constants';

// Lado de quem recebe um quiz partilhado. Sempre com sessao: a copia nasce
// no perfil de quem pede. Registado antes de QuizzesController no modulo.
// O token (UUID do servidor) e a credencial do link; o throttle apertado
// limita quem tente adivinhar tokens.
@ApiTags('Quizzes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('quizzes/shared')
export class QuizShareController {
  constructor(private readonly shares: QuizShareService) {}

  // Rotas literais antes de ':token'.
  @Get('with-me')
  @Throttle(perMinute(QUIZ_SHARE_LISTS_PER_MINUTE))
  @ApiOperation({ summary: 'Quizzes friends sent to you, newest first.' })
  withMe(@CurrentUser() user: AuthenticatedUser) {
    return this.shares.sharedWithMe(user.id);
  }

  @Get('mine')
  @Throttle(perMinute(QUIZ_SHARE_LISTS_PER_MINUTE))
  @ApiOperation({ summary: 'Your quizzes with an active share link.' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.shares.mine(user.id);
  }

  @Get(':token')
  @Throttle(perMinute(QUIZ_SHARE_PREVIEWS_PER_MINUTE))
  @ApiOperation({
    summary:
      'Summary of a shared quiz (title, owner, counts). Never returns questions.',
  })
  @ApiParam({ name: 'token', example: 'a1b2c3d4-...' })
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token', ParseUUIDPipe) token: string,
  ) {
    return this.shares.preview(user.id, token);
  }

  @Post(':token/add')
  @Throttle(perMinute(QUIZ_SHARE_ADDS_PER_MINUTE))
  @ApiOperation({
    summary: 'Adds a copy of a shared quiz to your account. Idempotent.',
  })
  @ApiParam({ name: 'token', example: 'a1b2c3d4-...' })
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token', ParseUUIDPipe) token: string,
  ) {
    return this.shares.add(user.id, token);
  }
}
