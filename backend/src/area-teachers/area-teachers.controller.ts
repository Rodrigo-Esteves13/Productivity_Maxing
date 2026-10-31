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
import { AreaTeachersService } from './area-teachers.service';
import { SetAreaTeacherDto } from './dto/set-area-teacher.dto';
import { AREA_TEACHER_WRITES_PER_MINUTE } from './area-teachers.constants';
import { perMinute } from '../common/throttle.util';

// Privado ao aluno: so devolve/escreve linhas do proprio user.
@ApiTags('Area teachers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('area-teachers')
export class AreaTeachersController {
  constructor(private readonly service: AreaTeachersService) {}

  @Get()
  @ApiOperation({ summary: 'Your private teacher notes, one per course.' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user.id);
  }

  @Put(':areaId')
  @Throttle(perMinute(AREA_TEACHER_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Sets your private teacher name for a course.' })
  set(
    @CurrentUser() user: AuthenticatedUser,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: SetAreaTeacherDto,
  ) {
    return this.service.set(user.id, areaId, dto.teacherName);
  }

  @Delete(':areaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(AREA_TEACHER_WRITES_PER_MINUTE))
  @ApiOperation({ summary: 'Clears your teacher note for a course.' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('areaId', ParseUUIDPipe) areaId: string,
  ): Promise<void> {
    await this.service.remove(user.id, areaId);
  }
}
