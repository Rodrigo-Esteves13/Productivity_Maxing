import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getLisbonNow, parseDateKey, toDateKey } from '../common/date-key.util';
import { CreateBloodDonationDto } from './dto/blood-donation.dto';
import { MAX_BLOOD_DONATIONS_PER_USER } from './wellbeing.constants';

const DONATION_SELECT = {
  id: true,
  date: true,
  type: true,
  location: true,
  note: true,
} satisfies Prisma.BloodDonationSelect;

type DonationRow = Prisma.BloodDonationGetPayload<{
  select: typeof DONATION_SELECT;
}>;

const toView = (row: DonationRow) => ({ ...row, date: toDateKey(row.date) });

// Registo das dadivas de sangue do proprio. A app nao diz se a pessoa pode
// doar (isso e com o servico de sangue); so guarda o historico.
@Injectable()
export class BloodDonationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.bloodDonation.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: MAX_BLOOD_DONATIONS_PER_USER,
      select: DONATION_SELECT,
    });
    return rows.map(toView);
  }

  async create(userId: string, dto: CreateBloodDonationDto) {
    const date = parseDateKey(dto.date);
    if (date > getLisbonNow().today) {
      throw new BadRequestException(
        'The donation date cannot be in the future.',
      );
    }
    const count = await this.prisma.bloodDonation.count({ where: { userId } });
    if (count >= MAX_BLOOD_DONATIONS_PER_USER) {
      throw new BadRequestException('Too many donations recorded.');
    }
    const row = await this.prisma.bloodDonation.create({
      data: {
        userId,
        date,
        type: dto.type,
        location: dto.location ?? null,
        note: dto.note ?? null,
      },
      select: DONATION_SELECT,
    });
    return toView(row);
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.bloodDonation.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException('Donation not found.');
  }
}
