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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { perMinute } from '../common/throttle.util';
import { FlashcardsService } from './flashcards.service';
import {
  CreateFlashcardDto,
  ListFlashcardsQueryDto,
  ReviewFlashcardDto,
  UpdateFlashcardDto,
} from './dto/flashcard.dto';
import { FLASHCARD_WRITES_PER_MINUTE } from './flashcards.constants';

const WRITE = Throttle(perMinute(FLASHCARD_WRITES_PER_MINUTE));

@ApiTags('Flashcards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('flashcards')
export class FlashcardsController {
  constructor(private readonly cards: FlashcardsService) {}

  @Get()
  @ApiOperation({ summary: 'Your flashcards, soonest due first.' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListFlashcardsQueryDto,
  ) {
    return this.cards.list(user.id, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Total and due flashcard counts.' })
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.cards.stats(user.id);
  }

  @Post()
  @WRITE
  @ApiOperation({ summary: 'Creates a flashcard.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFlashcardDto,
  ) {
    return this.cards.create(user.id, dto);
  }

  @Patch(':id')
  @WRITE
  @ApiOperation({ summary: 'Edits a flashcard.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFlashcardDto,
  ) {
    return this.cards.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WRITE
  @ApiOperation({ summary: 'Deletes a flashcard.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cards.remove(user.id, id);
  }

  @Post(':id/review')
  @HttpCode(HttpStatus.OK)
  @WRITE
  @ApiOperation({ summary: 'Grades a review and reschedules the card.' })
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewFlashcardDto,
  ) {
    return this.cards.review(user.id, id, dto.grade);
  }
}
