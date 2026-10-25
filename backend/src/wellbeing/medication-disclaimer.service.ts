import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MEDICATION_DISCLAIMER_VERSION } from './wellbeing.constants';

export interface MedicationDisclaimerStatus {
  version: number;
  acceptedVersion: number | null;
  acceptedAt: Date | null;
  acceptedLocale: string | null;
  accepted: boolean;
}

// Aviso legal da medicacao: o utilizador tem de aceitar a versao atual
// antes de adicionar medicamentos ou registar tomas. Fica guardado quando
// e que versao aceitou.
@Injectable()
export class MedicationDisclaimerService {
  constructor(private readonly prisma: PrismaService) {}

  async status(userId: string): Promise<MedicationDisclaimerStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        medicationDisclaimerVersion: true,
        medicationDisclaimerAcceptedAt: true,
        medicationDisclaimerLocale: true,
      },
    });
    const acceptedVersion = user?.medicationDisclaimerVersion ?? null;
    return {
      version: MEDICATION_DISCLAIMER_VERSION,
      acceptedVersion,
      acceptedAt: user?.medicationDisclaimerAcceptedAt ?? null,
      acceptedLocale: user?.medicationDisclaimerLocale ?? null,
      accepted: acceptedVersion === MEDICATION_DISCLAIMER_VERSION,
    };
  }

  // So aceita a versao atual: um cliente antigo com outro texto tem de
  // recarregar e ler o aviso novo.
  async accept(
    userId: string,
    version: number,
    locale: string,
  ): Promise<MedicationDisclaimerStatus> {
    if (version !== MEDICATION_DISCLAIMER_VERSION) {
      throw new BadRequestException(
        'The notice has changed. Reload the page and read it again.',
      );
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        medicationDisclaimerVersion: version,
        medicationDisclaimerAcceptedAt: new Date(),
        medicationDisclaimerLocale: locale,
      },
    });
    return this.status(userId);
  }

  async assertAccepted(userId: string): Promise<void> {
    const { accepted } = await this.status(userId);
    if (!accepted) {
      throw new ForbiddenException(
        'Read and accept the medication notice first.',
      );
    }
  }
}
