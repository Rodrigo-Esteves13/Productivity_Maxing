import { Controller, Get, Post, Body, Param, Patch, Delete, ParseUUIDPipe, InternalServerErrorException } from '@nestjs/common';
import { AreasService } from './areas.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Area')
@Controller('areas')
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma nova área de vida' })
  create(@Body() createAreaDto: CreateAreaDto) {
    // Neste momento fixo, com uuid fixo com uuid real no .env, será removido no futuro
    const userId = process.env.TEST_USER_ID;
    
    if (!userId) {
      throw new InternalServerErrorException('Configuração em falta: TEST_USER_ID não encontrado no .env');
    }

    return this.areasService.create(userId, createAreaDto);
  }

  @Get()
  findAll() {
    return this.areasService.findAll();
  }

@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) {
  return this.areasService.findOne(id);
}

@Patch(':id')
update(@Param('id', ParseUUIDPipe) id: string, @Body() updateAreaDto: UpdateAreaDto) {
  return this.areasService.update(id, updateAreaDto);
}

@Delete(':id')
remove(@Param('id', ParseUUIDPipe) id: string) {
  return this.areasService.remove(id);
}
}