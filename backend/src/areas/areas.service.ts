import { Injectable } from '@nestjs/common';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, createAreaDto: CreateAreaDto) {
    return this.prisma.area.create({
      data: {
        ...createAreaDto,
        user: {
          connect: { id: userId },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.area.findMany();
  }

  async findOne(id: string) {
    return this.prisma.area.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateAreaDto: UpdateAreaDto) {
    return this.prisma.area.update({
      where: { id },
      data: updateAreaDto,
    });
  }

  async remove(id: string) {
    return this.prisma.area.delete({
      where: { id },
    });
  }
}
