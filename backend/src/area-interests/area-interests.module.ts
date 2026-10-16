import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AreaInterestsService } from './area-interests.service';
import { AreaInterestsController } from './area-interests.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AreaInterestsController],
  providers: [AreaInterestsService],
})
export class AreaInterestsModule {}
