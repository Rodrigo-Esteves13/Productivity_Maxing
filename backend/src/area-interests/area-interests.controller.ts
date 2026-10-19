import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AreaInterestsService } from './area-interests.service';
import { SetAreaInterestDto } from './dto/set-area-interest.dto';
import { perMinute } from '../common/throttle.util';

@ApiTags('Area interests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('area-interests')
export class AreaInterestsController {
  constructor(private readonly service: AreaInterestsService) {}

  @Get()
  @ApiOperation({ summary: 'Your interest (1 to 5) in each course you rated.' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user.id);
  }

  @Put(':areaId')
  @Throttle(perMinute(60))
  @ApiOperation({
    summary: 'Sets how interested you are in a course (1 to 5).',
  })
  set(
    @CurrentUser() user: AuthenticatedUser,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: SetAreaInterestDto,
  ) {
    return this.service.set(user.id, areaId, dto.rating);
  }

  @Delete(':areaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clears your interest rating for a course.' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('areaId', ParseUUIDPipe) areaId: string,
  ): Promise<void> {
    await this.service.remove(user.id, areaId);
  }
}
