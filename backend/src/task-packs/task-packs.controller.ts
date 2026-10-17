import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { TaskPacksService } from './task-packs.service';
import { CreateTaskPackDto, ImportTaskPackDto } from './dto/task-pack.dto';

@ApiTags('Task packs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('task-packs')
export class TaskPacksController {
  constructor(private readonly packs: TaskPacksService) {}

  @Get()
  @ApiOperation({ summary: 'Task packs you created.' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.packs.list(user.id);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Creates a shareable pack from some of YOUR tasks.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTaskPackDto,
  ) {
    return this.packs.create(user.id, dto);
  }

  // As rotas com `code/` ficam antes das de `:id` por clareza; o código é um
  // segredo não adivinhável (96 bits) e o throttle trava tentativas em massa.
  @Get('code/:code')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Preview of a pack someone shared with you.' })
  preview(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    return this.packs.preview(user.id, code);
  }

  @Post('code/:code/import')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Creates the chosen tasks of a pack in your account.',
  })
  import(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
    @Body() dto: ImportTaskPackDto,
  ) {
    return this.packs.import(user.id, code, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deletes a pack (its link stops working).' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.packs.remove(user.id, id);
  }
}
