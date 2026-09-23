import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { NotebookService } from './notebook.service';

// Controller à parte de NotebookController de propósito: aquele tem
// @UseGuards(JwtAuthGuard) na classe toda, e este é exatamente o oposto -
// o ponto de uma lesson partilhada é alguém SEM conta conseguir abri-la.
// O token (UUID gerado no servidor, nunca escolhido pelo cliente) é a
// única credencial; não há nada aqui que dependa de quem está a pedir.
@ApiTags('Notebook')
@Controller('notebook/shared')
export class NotebookShareController {
  constructor(private readonly notebookService: NotebookService) {}

  // Throttle mais apertado que os outros endpoints públicos da app - isto
  // não tem rate limiting nenhum vindo de auth (não há login aqui), e é a
  // única superfície onde "adivinhar" um token tem algum valor (baixo,
  // são UUIDs, mas na dúvida mais vale um limite explícito do que confiar
  // só na imprevisibilidade do UUID).
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get(':token')
  @ApiOperation({
    summary: 'Public read-only view of a shared notebook entry.',
  })
  @ApiParam({ name: 'token', example: 'a1b2c3d4-...' })
  getSharedEntry(@Param('token') token: string) {
    return this.notebookService.getSharedEntry(token);
  }
}
