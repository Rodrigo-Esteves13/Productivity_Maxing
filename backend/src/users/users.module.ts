import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule importado para injetar AuthService (reutilizamos
  // deleteAccount() no remove() do UsersService, em vez de duplicar a
  // lógica de limpeza do Supabase Auth/Storage/cascade aqui).
  // AuthModule não importa UsersModule, por isso não há dependência
  // circular.
  imports: [PrismaModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
