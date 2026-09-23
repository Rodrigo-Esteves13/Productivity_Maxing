import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AccountStatusModule } from '../account-status/account-status.module';

@Module({
  // AuthModule importado para injetar AuthService (reutilizamos
  // deleteAccount() no remove() do UsersService, em vez de duplicar a
  // lógica de limpeza do Supabase Auth/Storage/cascade aqui).
  // AuthModule não importa UsersModule, por isso não há dependência
  // circular. AccountStatusModule é o sítio partilhado onde vive a cache
  // de ban/suspend consultada pelo JwtStrategy - ver o comentário lá.
  imports: [PrismaModule, AuthModule, AccountStatusModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
