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
import { perMinute } from '../common/throttle.util';
import { QuizzesService } from './quizzes.service';
import { ImportQuizDto, SubmitAttemptDto, UpdateQuizDto } from './dto/quiz.dto';
import {
  QUIZ_IMPORTS_PER_MINUTE,
  QUIZ_WRITES_PER_MINUTE,
} from './quizzes.constants';

const WRITE = Throttle(perMinute(QUIZ_WRITES_PER_MINUTE));

@ApiTags('Quizzes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Get()
  @ApiOperation({ summary: 'Your saved quizzes, newest first.' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.quizzes.list(user.id);
  }

  // Rota literal antes das de :id.
  @Post('import')
  @Throttle(perMinute(QUIZ_IMPORTS_PER_MINUTE))
  @ApiOperation({
    summary: 'Checks, cleans and saves a quiz made with the copied prompt.',
  })
  import(@CurrentUser() user: AuthenticatedUser, @Body() dto: ImportQuizDto) {
    return this.quizzes.import(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'A quiz with its questions, stats and history.' })
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quizzes.get(user.id, id);
  }

  @Patch(':id')
  @WRITE
  @ApiOperation({ summary: 'Renames a quiz.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuizDto,
  ) {
    return this.quizzes.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WRITE
  @ApiOperation({ summary: 'Deletes a quiz and its history.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quizzes.remove(user.id, id);
  }

  @Post(':id/attempts')
  @WRITE
  @ApiOperation({ summary: 'Saves a finished attempt and updates the stats.' })
  submitAttempt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitAttemptDto,
  ) {
    return this.quizzes.submitAttempt(user.id, id, dto);
  }
}
