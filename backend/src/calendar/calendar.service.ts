import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { GOOGLE_TOKEN_URL } from '../auth/google-oauth.constants';

const CALENDAR_EVENTS_URL =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
// Fallback quando a Task não tem calendarDurationMinutes definido (tasks
// criadas antes deste campo existir, ou que nunca passaram pelo form com o
// seletor de duração). O form só recolhe uma hora de início, nunca uma de
// fim - ver OptionalInfoFields.tsx.
const DEFAULT_TIMED_EVENT_DURATION_MINUTES = 60;

interface TaskForSync {
  id: string;
  title: string;
  date: Date;
  topics: string | null;
  difficulty: string;
  progressStatus: string;
  referenceLink: string | null;
  weightPercentage: number | null;
  targetGrade: number | null;
  realGrade: number | null;
  googleCalendarEventId: string | null;
  calendarDurationMinutes: number | null;
  area: { name: string } | null;
  taskType: { label: string } | null;
  academicType: { label: string } | null;
}

// "ON_TRACK" -> "On Track". Mesma ideia do formatEnumLabel.ts do frontend,
// só para os enums (Difficulty, ProgressStatus) que entram na descrição do
// evento do Google Calendar.
function formatEnumLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  /**
   * Issue #34: usado pelo frontend para decidir se mostra o botão de sync
   * (Dashboard) ou o CTA "Connect" (Profile). "Connected" exige as duas
   * condições: existe um refreshToken guardado E o consent incluiu mesmo o
   * scope do Calendar - uma Identity Google só com email/profile (ex: SSO
   * feito antes da Fase 4) não chega.
   */
  async getStatus(userId: string): Promise<{ connected: boolean }> {
    const identity = await this.prisma.identity.findFirst({
      where: { userId, provider: Provider.GOOGLE },
      select: { scope: true, refreshToken: true },
    });

    const connected =
      !!identity?.refreshToken && !!identity.scope?.includes(CALENDAR_SCOPE);

    return { connected };
  }

  /**
   * Troca o refresh_token guardado (cifrado na BD) por um access_token
   * válido, direto no endpoint OAuth2 do Google - sem SDK, como o resto do
   * projeto já faz para os outros providers.
   */
  private async getValidAccessToken(userId: string): Promise<string> {
    const tokens = await this.authService.getDecryptedProviderTokens(
      userId,
      Provider.GOOGLE,
    );

    if (!tokens?.refreshToken) {
      throw new BadRequestException(
        'Google Calendar not connected. Connect it from your profile settings first.',
      );
    }

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        // GOOGLE_CLIENT_SECRET is enforced at boot by assertRequiredEnvVars()
        // in main.ts - no silent '' fallback here anymore.
        client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
        refresh_token: tokens.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Refresh do token Google falhou: ${body}`);
      throw new BadRequestException(
        'Could not refresh Google Calendar access. Try reconnecting your account.',
      );
    }

    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  // Junta toda a informação que também aparece no ecrã "Task Details" do
  // frontend (TaskDetailView.tsx), para o evento no Google Calendar não
  // ficar mais pobre do que a própria app - cada linha só entra se o campo
  // tiver mesmo valor, tal como lá.
  private buildDescription(task: TaskForSync): string | undefined {
    const lines: string[] = [];

    if (task.area?.name) lines.push(`Area: ${task.area.name}`);
    if (task.taskType?.label) lines.push(`Type: ${task.taskType.label}`);
    if (task.academicType?.label) {
      lines.push(`Academic Type: ${task.academicType.label}`);
    }
    lines.push(`Difficulty: ${formatEnumLabel(task.difficulty)}`);
    lines.push(`Status: ${formatEnumLabel(task.progressStatus)}`);
    if (task.topics) lines.push(`Topics: ${task.topics}`);
    if (task.weightPercentage != null) {
      lines.push(`Weight: ${task.weightPercentage}%`);
    }
    if (task.targetGrade != null)
      lines.push(`Target Grade: ${task.targetGrade}`);
    if (task.realGrade != null) lines.push(`Real Grade: ${task.realGrade}`);
    if (task.referenceLink) lines.push(`Reference Link: ${task.referenceLink}`);

    return lines.length ? lines.join('\n') : undefined;
  }

  private toGoogleEvent(task: TaskForSync) {
    // O form só recolhe uma hora opcionalmente (ver TitleDateAreaFields.tsx
    // + campo "time" junto da checkbox do Calendar em OptionalInfoFields).
    // Quando não é dada hora, o frontend guarda a Task à meia-noite UTC
    // exata - por isso é esse o sinal que usamos aqui para decidir entre
    // um evento "dia inteiro" (sem hora - ex: entrega/prazo genérico) e um
    // evento com horário real (ex: aula de natação às 18h todas as
    // semanas). Uma Task genuinamente marcada para as 00:00 fica também
    // como dia inteiro - caso extremo aceite, ninguém agenda nada para
    // meia-noite em ponto de propósito.
    const date = new Date(task.date);
    const hasTime =
      date.getUTCHours() !== 0 ||
      date.getUTCMinutes() !== 0 ||
      date.getUTCSeconds() !== 0;
    const description = this.buildDescription(task);

    if (hasTime) {
      const durationMinutes =
        task.calendarDurationMinutes ?? DEFAULT_TIMED_EVENT_DURATION_MINUTES;
      const end = new Date(date.getTime() + durationMinutes * 60 * 1000);
      return {
        summary: task.title,
        description,
        start: { dateTime: date.toISOString(), timeZone: 'Europe/Lisbon' },
        end: { dateTime: end.toISOString(), timeZone: 'Europe/Lisbon' },
      };
    }

    // Formato "all-day" do Google Calendar: start/end usam `date` (não
    // `dateTime`) em YYYY-MM-DD, e o `end.date` é EXCLUSIVO - por isso é
    // sempre start + 1 dia, mesmo para um evento de um dia só.
    const startDate = this.toDateOnlyString(date);
    const endDate = this.toDateOnlyString(
      new Date(date.getTime() + 24 * 60 * 60 * 1000),
    );

    return {
      summary: task.title,
      description,
      start: { date: startDate },
      end: { date: endDate },
    };
  }

  /** Formata uma Date como YYYY-MM-DD, usando os componentes UTC - a Task
   * é guardada como meia-noite UTC do dia escolhido, por isso ler em UTC
   * (em vez do timezone local do processo) é o que devolve o dia correto
   * independentemente de onde o backend está a correr. */
  private toDateOnlyString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Issues #35/#36/#37: cria (POST) ou atualiza (PATCH) o evento no Google
   * Calendar consoante a Task já tenha ou não um googleCalendarEventId.
   * Devolve o eventId - quem chama (CalendarController) é responsável por
   * gravá-lo na Task.
   */
  async upsertEventForTask(userId: string, task: TaskForSync): Promise<string> {
    const accessToken = await this.getValidAccessToken(userId);
    const payload = this.toGoogleEvent(task);

    const url = task.googleCalendarEventId
      ? `${CALENDAR_EVENTS_URL}/${task.googleCalendarEventId}`
      : CALENDAR_EVENTS_URL;
    const method = task.googleCalendarEventId ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(
        `Google Calendar API (${method} ${url}) falhou: ${body}`,
      );
      throw new BadRequestException(
        'Failed to sync task with Google Calendar.',
      );
    }

    const data = (await res.json()) as { id: string };
    return data.id;
  }

  /** Remove o evento do Google Calendar (botão de "unsync" no Dashboard). */
  async deleteEventForTask(
    userId: string,
    googleCalendarEventId: string,
  ): Promise<void> {
    const accessToken = await this.getValidAccessToken(userId);

    const res = await fetch(`${CALENDAR_EVENTS_URL}/${googleCalendarEventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // 404/410 = o evento já não existe do lado da Google (ex: apagado à
    // mão pela pessoa) - não é um erro, só confirma o que já queríamos.
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      const body = await res.text();
      this.logger.error(`Google Calendar API (DELETE) falhou: ${body}`);
      throw new BadRequestException(
        'Failed to remove event from Google Calendar.',
      );
    }
  }
}
