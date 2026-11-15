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
import { QuizShareService } from './quiz-share.service';
import { ImportQuizDto, SubmitAttemptDto, UpdateQuizDto } from './dto/quiz.dto';
import { ShareQuizFriendDto } from './dto/quiz-share.dto';
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
  constructor(
    private readonly quizzes: QuizzesService,
    private readonly shares: QuizShareService,
  ) {}

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

  @Delete(':id/attempts')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WRITE
  @ApiOperation({ summary: 'Clears the attempt history of a quiz.' })
  clearAttempts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quizzes.clearAttempts(user.id, id);
  }

  @Delete(':id/stats')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WRITE
  @ApiOperation({ summary: 'Resets the per-question stats of a quiz.' })
  clearStats(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quizzes.clearStats(user.id, id);
  }

  // Rota literal (:id/wrong) antes da de :questionId.
  @Delete(':id/wrong')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WRITE
  @ApiOperation({ summary: 'Empties the wrong-answers list of a quiz.' })
  dismissWrong(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quizzes.dismissWrong(user.id, id);
  }

  @Delete(':id/wrong/:questionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WRITE
  @ApiOperation({ summary: 'Removes one question from the wrong list.' })
  dismissWrongOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('questionId') questionId: string,
  ) {
    return this.quizzes.dismissWrongOne(user.id, id, questionId);
  }

  // Partilha (so o dono; copias recebidas nao se partilham).
  @Get(':id/share')
  @ApiOperation({
    summary: 'Share link and recipients of one of your quizzes.',
  })
  shareStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shares.status(user.id, id);
  }

  @Post(':id/share')
  @WRITE
  @ApiOperation({ summary: 'Creates the share link of a quiz (idempotent).' })
  enableShare(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shares.enable(user.id, id);
  }

  @Delete(':id/share')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WRITE
  @ApiOperation({ summary: 'Stops sharing a quiz (copies already made stay).' })
  revokeShare(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.shares.revoke(user.id, id);
  }

  @Post(':id/share/friends')
  @WRITE
  @ApiOperation({ summary: 'Sends a quiz to a friend (idempotent).' })
  shareWithFriend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShareQuizFriendDto,
  ) {
    return this.shares.addFriend(user.id, id, dto.userId);
  }

  @Delete(':id/share/friends/:recipientId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WRITE
  @ApiOperation({ summary: 'Removes a friend from the share list of a quiz.' })
  unshareWithFriend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recipientId', ParseUUIDPipe) recipientId: string,
  ) {
    return this.shares.removeFriend(user.id, id, recipientId);
  }
}
