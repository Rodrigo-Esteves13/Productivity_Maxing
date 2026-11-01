import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { FinancePricesService } from './finance-prices.service';
import { QUOTE_PROVIDER, YahooQuoteProvider } from './finance-quote.provider';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FinanceController],
  providers: [
    FinanceService,
    FinancePricesService,
    { provide: QUOTE_PROVIDER, useClass: YahooQuoteProvider },
  ],
})
export class FinanceModule {}
