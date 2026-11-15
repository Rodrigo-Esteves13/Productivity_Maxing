import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { QuizzesController } from './quizzes.controller';
import { QuizzesService } from './quizzes.service';
import { QuizShareController } from './quiz-share.controller';
import { QuizShareService } from './quiz-share.service';

@Module({
  imports: [PrismaModule, AuthModule],
  // QuizShareController primeiro: as rotas /quizzes/shared/* ficam antes das de /quizzes/:id.
  controllers: [QuizShareController, QuizzesController],
  providers: [QuizzesService, QuizShareService],
})
export class QuizzesModule {}
