import { Injectable } from '@nestjs/common';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

@Injectable()
export class AreasService {
  create(_createAreaDto: CreateAreaDto) {
    return 'This action adds a new area';
  }

  findAll() {
    return `This action returns all areas`;
  }

  findOne(id: string) {
    return `This action returns a #${id} area`;
  }

  update(id: string, _updateAreaDto: UpdateAreaDto) {
    return `This action updates a #${id} area`;
  }

  remove(id: string) {
    return `This action removes a #${id} area`;
  }
}