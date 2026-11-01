import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AreaTeachersModule } from '../area-teachers/area-teachers.module';
import { AreaRatingsService } from './area-ratings.service';
import { AreaRatingsStatsService } from './area-ratings-stats.service';
import { AreaRatingsController } from './area-ratings.controller';

@Module({
  imports: [PrismaModule, AuthModule, AreaTeachersModule],
  controllers: [AreaRatingsController],
  providers: [AreaRatingsService, AreaRatingsStatsService],
})
export class AreaRatingsModule {}
