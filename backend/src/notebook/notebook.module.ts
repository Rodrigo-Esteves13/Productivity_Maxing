import { Module } from '@nestjs/common';
import { NotebookService } from './notebook.service';
import { NotebookController } from './notebook.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [NotebookController],
  providers: [NotebookService],
})
export class NotebookModule {}
