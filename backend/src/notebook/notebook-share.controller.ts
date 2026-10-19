import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { NotebookService } from './notebook.service';
import { NotebookCollabService } from './notebook-collab.service';
import { NotebookSharedWithMeService } from './notebook-shared-with-me.service';
import { SharedEditDto } from './dto/shared-edit.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { perMinute } from '../common/throttle.util';

// Controller à parte de NotebookController de propósito: aquele tem
// @UseGuards(JwtAuthGuard) na classe toda, e este é exatamente o oposto -
// o ponto de uma lesson partilhada é alguém SEM conta conseguir abri-la
// (pelo menos no modo PUBLIC - ver getSharedEntry). O token (UUID gerado
// no servidor, nunca escolhido pelo cliente) é a única credencial que
// prova que se conhece o link; não há guard de classe nenhum aqui.
@ApiTags('Notebook')
@Controller('notebook/shared')
export class NotebookShareController {
  constructor(
    private readonly notebookService: NotebookService,
    private readonly collabService: NotebookCollabService,
    private readonly sharedWithMe: NotebookSharedWithMeService,
  ) {}

  // Declarada ANTES de ':token' - senao 'with-me' seria apanhado como token.
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(perMinute(30))
  @Get('with-me')
  @ApiOperation({
    summary:
      'Lessons other people shared with the current user (any request state).',
  })
  listSharedWithMe(@CurrentUser() user: AuthenticatedUser) {
    return this.sharedWithMe.list(user.id);
  }

  // OptionalJwtAuthGuard, não JwtAuthGuard: uma partilha PUBLIC continua a
  // abrir sem sessão nenhuma (o guard devolve user = null e o service
  // ignora-o); uma partilha AUTHORIZED precisa de saber QUEM está a pedir
  // para decidir entre login_required/not_requested/pending/denied/ok -
  // ver NotebookService.getSharedEntry e o tipo SharedEntryResult.
  //
  // Throttle mais apertado que os outros endpoints públicos da app - isto
  // não tem rate limiting nenhum vindo de auth (não há login garantido
  // aqui), e é a única superfície onde "adivinhar" um token tem algum
  // valor (baixo, são UUIDs, mas na dúvida mais vale um limite explícito
  // do que confiar só na imprevisibilidade do UUID).
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle(perMinute(30))
  @Get(':token')
  @ApiOperation({
    summary:
      'Read-only view of a shared notebook entry. PUBLIC shares need nothing else; AUTHORIZED shares return a status instead of the content until the caller is logged in and approved.',
  })
  @ApiParam({ name: 'token', example: 'a1b2c3d4-...' })
  getSharedEntry(
    @CurrentUser() user: AuthenticatedUser | null,
    @Param('token') token: string,
    @Req() req: Request,
  ) {
    return this.notebookService.getSharedEntry(token, user?.id ?? null, {
      ip: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
  }

  // Ao contrário da rota acima, esta exige mesmo sessão - pedir acesso a
  // uma partilha AUTHORIZED só faz sentido para alguém identificável, o
  // dono precisa de saber A QUEM está a dar acesso. @UseGuards aqui, não
  // na classe, porque só esta rota tem esse requisito.
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(perMinute(10))
  @Post(':token/request-access')
  @ApiOperation({
    summary: 'Request access to an AUTHORIZED share. Idempotent.',
  })
  @ApiParam({ name: 'token', example: 'a1b2c3d4-...' })
  requestAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token') token: string,
  ) {
    return this.notebookService.requestAccess(user.id, token);
  }

  // Edicao por uma partilha: CO_OWNER aplica logo, EDITOR cria uma proposta
  // para o dono aprovar, VIEWER recebe 403. Exige sessao (o papel e de uma
  // pessoa concreta).
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(perMinute(30))
  @Post(':token/edit')
  @ApiOperation({
    summary:
      'Edit a shared entry (co-owner) or propose changes for the owner to approve (editor).',
  })
  @ApiParam({ name: 'token', example: 'a1b2c3d4-...' })
  editShared(
    @CurrentUser() user: AuthenticatedUser,
    @Param('token') token: string,
    @Body() dto: SharedEditDto,
  ) {
    return this.collabService.editShared(user.id, token, dto);
  }
}
