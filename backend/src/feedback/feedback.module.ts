import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { FeedbackService } from './feedback.service';
import { FeedbackController } from './feedback.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
