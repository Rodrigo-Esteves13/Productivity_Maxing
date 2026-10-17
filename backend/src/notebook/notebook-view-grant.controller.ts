import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { SharedEntryResult } from './notebook.service';
import {
  NotebookViewGrantService,
  type FriendNotesList,
  type IncomingGrantsView,
  type OutgoingGrant,
} from './notebook-view-grant.service';
import {
  DecideViewGrantDto,
  RequestViewGrantDto,
  UpdateViewGrantAreasDto,
} from './dto/view-grant.dto';

@ApiTags('Social notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('social/notes')
export class NotebookViewGrantController {
  constructor(private readonly grants: NotebookViewGrantService) {}

  @Post('requests')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Ask a friend for read-only access to their notes.',
  })
  request(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestViewGrantDto,
  ) {
    return this.grants.request(user.id, dto.ownerId);
  }

  @Get('incoming')
  @ApiOperation({
    summary: 'Requests/grants for MY notes, plus my subjects to pick from.',
  })
  incoming(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IncomingGrantsView> {
    return this.grants.incoming(user.id);
  }

  @Get('outgoing')
  @ApiOperation({ summary: "Requests I made to read friends' notes." })
  outgoing(@CurrentUser() user: AuthenticatedUser): Promise<OutgoingGrant[]> {
    return this.grants.outgoing(user.id);
  }

  @Post('grants/:id/decide')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideViewGrantDto,
  ) {
    return this.grants.decide(user.id, id, dto.approve, dto.areaIds);
  }

  @Patch('grants/:id/areas')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateAreas(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateViewGrantAreasDto,
  ) {
    return this.grants.updateAreas(user.id, id, dto.areaIds);
  }

  @Delete('grants/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.grants.remove(user.id, id);
  }

  @Get('from/:ownerId')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
  ): Promise<FriendNotesList> {
    return this.grants.listFor(user.id, ownerId);
  }

  @Get('from/:ownerId/entries/:entryId')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  entry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ownerId', ParseUUIDPipe) ownerId: string,
    @Param('entryId', ParseUUIDPipe) entryId: string,
  ): Promise<SharedEntryResult> {
    return this.grants.getEntryFor(user.id, ownerId, entryId);
  }
}
