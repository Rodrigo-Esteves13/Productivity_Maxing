import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import type { User } from '@prisma/client';
import 'multer';
import { PrismaService } from '../../prisma/prisma.service';
import { getAvatarBucket } from '../../config/app.config';
import { SupabaseClientsService } from './supabase-clients.service';

// Bucket do Supabase Storage onde ficam as fotos de perfil.
// Tem de existir no projeto Supabase e estar marcado como público
// (Storage -> Buckets -> "avatars" -> Public bucket = ON), para que o
// avatarUrl gerado seja diretamente acessível pelo <img src>.
const AVATAR_BUCKET = getAvatarBucket();

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// Fotos de perfil no Supabase Storage.
@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);

  constructor(
    private prisma: PrismaService,
    private clients: SupabaseClientsService,
  ) {}

  /**
   * Faz upload da imagem para o bucket do Supabase Storage e devolve o User
   * já com o novo avatarUrl gravado. Se o user já tinha um avatar antigo
   * (gerido por nós, i.e. dentro do nosso bucket), tenta apagá-lo a seguir
   * para não acumular lixo no bucket.
   */
  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<User> {
    // Nunca confiar no `file.mimetype`, é o Content-Type que o próprio
    // pedido multipart declara, controlado inteiramente por quem envia o
    // pedido. Detetamos o tipo real a partir dos primeiros bytes do
    // ficheiro (magic bytes), para não guardarmos/servirmos como "imagem"
    // um ficheiro que na realidade é outra coisa qualquer.
    const detected = await fileTypeFromBuffer(file.buffer);
    const detectedMime = detected?.mime;
    const ext = detectedMime ? ALLOWED_MIME_TO_EXT[detectedMime] : undefined;

    if (!ext || !detectedMime) {
      throw new BadRequestException(
        'Unsupported image format. Use PNG, JPG, WEBP or GIF.',
      );
    }

    const previousUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const path = `${userId}/${randomUUID()}.${ext}`;

    const { error: uploadError } = await this.clients.admin.storage
      .from(AVATAR_BUCKET)
      .upload(path, file.buffer, {
        contentType: detectedMime,
        upsert: false,
      });

    if (uploadError) {
      this.logger.error(
        'Erro ao fazer upload do avatar para o Supabase',
        uploadError,
      );
      throw new BadRequestException(
        'Could not upload the image. Please try again.',
      );
    }

    const {
      data: { publicUrl },
    } = this.clients.admin.storage.from(AVATAR_BUCKET).getPublicUrl(path);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: publicUrl },
    });

    // Best-effort: limpar o avatar anterior guardado no nosso bucket.
    // Não bloqueia a resposta nem falha o pedido se der erro.
    this.deleteAvatarFileIfOwned(previousUser.avatarUrl).catch((err: unknown) =>
      this.logger.warn(`Could not delete the old avatar: ${err instanceof Error ? err.message : String(err)}`),
    );

    return updatedUser;
  }

  /** Remove a foto de perfil atual (volta às iniciais no frontend). */
  async removeAvatar(userId: string): Promise<User> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    await this.deleteAvatarFileIfOwned(user.avatarUrl);

    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });
  }

  async deleteAvatarFileIfOwned(avatarUrl: string | null) {
    if (!avatarUrl) return;

    // Só apagamos ficheiros que vivem no NOSSO bucket (evita tentar apagar
    // avatars vindos do Google/Discord/GitHub, que são URLs externas).
    const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
    const markerIndex = avatarUrl.indexOf(marker);
    if (markerIndex === -1) return;

    const path = avatarUrl.slice(markerIndex + marker.length);
    if (!path) return;

    const { error } = await this.clients.admin.storage
      .from(AVATAR_BUCKET)
      .remove([path]);
    if (error) throw error;
  }
}
