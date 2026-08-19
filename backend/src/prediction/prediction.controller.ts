import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PredictionService } from './prediction.service';
import { PredictDurationDto } from './dto/predict-duration.dto';
import { JwtOrApiKeyAuthGuard } from '../auth/guards/jwt-or-api-key-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('Prediction')
@ApiBearerAuth()
@UseGuards(JwtOrApiKeyAuthGuard)
@Controller('predictions')
export class PredictionController {
  constructor(private readonly predictionService: PredictionService) {}

  @Post('duration')
  predictDuration(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PredictDurationDto,
  ) {
    return this.predictionService.predictDuration(user.id, dto);
  }
}
