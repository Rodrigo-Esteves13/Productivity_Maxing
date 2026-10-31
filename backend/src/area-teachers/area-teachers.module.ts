import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AreaTeachersService } from './area-teachers.service';
import { AreaTeachersController } from './area-teachers.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AreaTeachersController],
  providers: [AreaTeachersService],
  exports: [AreaTeachersService],
})
export class AreaTeachersModule {}
