import type { DateCertainty } from '@prisma/client';
import { calendarTitle, hasFirmDate } from '../common/task-readiness.util';
import { MS_PER_DAY, MS_PER_MINUTE } from '../common/time.constants';
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import {
  GOOGLE_CALENDAR_API_URL,
  GOOGLE_CALENDAR_APP_SCOPE,
  GOOGLE_CALENDAR_NAME,
  GOOGLE_TOKEN_URL,
} from '../auth/google-oauth.constants';
import { CALENDAR_TIME_ZONE } from './schedule-sync.constants';
import { HTTP_GONE, HTTP_NOT_FOUND } from './http-codes';
import { googleFetch } from './google-fetch.util';

const CALENDAR_SCOPE = GOOGLE_CALENDAR_APP_SCOPE;
// Fallback quando a Task não tem calendarDurationMinutes definido (tasks
// criadas antes deste campo existir, ou que nunca passaram pelo form com o
// seletor de duração). O form só recolhe uma hora de início, nunca uma de
// fim - ver OptionalInfoFields.tsx.
const DEFAULT_TIMED_EVENT_DURATION_MINUTES = 60;

interface TaskForSync {
  id: string;
  title: string;
  date: Date;
  dateCertainty: DateCertainty;
  submissionDate?: Date | null;
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

  // Criacao do calendario em curso, por utilizador: o sync corre pedidos em
  // paralelo e, sem isto, dois pedidos a falhar ao mesmo tempo criariam dois
  // calendarios.
  private readonly calendarCreations = new Map<string, Promise<string>>();

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  /** URL da coleção de eventos do calendário da app. */
  eventsUrl(calendarId: string): string {
    return `${GOOGLE_CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events`;
  }

  /**
   * Devolve o id do calendário secundário da app para este utilizador,
   * criando-o (POST /calendars) na primeira utilização. O id fica guardado
   * na Identity Google. Nunca lista nem lê calendários existentes.
   */
  async getCalendarId(userId: string, accessToken: string): Promise<string> {
    const identity = await this.prisma.identity.findFirst({
      where: { userId, provider: Provider.GOOGLE },
      select: { calendarId: true },
    });
    if (identity?.calendarId) return identity.calendarId;
    return this.createCalendar(userId, accessToken);
  }

  /**
   * Chamado quando a Google responde 404 a uma criação de evento: o
   * calendário foi apagado pela pessoa. Se outro pedido paralelo já o
   * substituiu (id guardado diferente do que falhou), reaproveita-o.
   */
  async replaceCalendar(
    userId: string,
    accessToken: string,
    staleCalendarId: string,
  ): Promise<string> {
    const identity = await this.prisma.identity.findFirst({
      where: { userId, provider: Provider.GOOGLE },
      select: { calendarId: true },
    });
    if (identity?.calendarId && identity.calendarId !== staleCalendarId) {
      return identity.calendarId;
    }
    return this.createCalendar(userId, accessToken);
  }

  private createCalendar(userId: string, accessToken: string): Promise<string> {
    const inFlight = this.calendarCreations.get(userId);
    if (inFlight) return inFlight;

    const creation = this.requestNewCalendar(userId, accessToken).finally(
      () => {
        this.calendarCreations.delete(userId);
      },
    );
    this.calendarCreations.set(userId, creation);
    return creation;
  }

  private async requestNewCalendar(
    userId: string,
    accessToken: string,
  ): Promise<string> {
    const res = await googleFetch(`${GOOGLE_CALENDAR_API_URL}/calendars`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: GOOGLE_CALENDAR_NAME,
        timeZone: CALENDAR_TIME_ZONE,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(
        `Google Calendar API (POST /calendars) falhou: ${body}`,
      );
      throw new BadRequestException(
        'Failed to create the Productivity Maxing calendar in Google Calendar.',
      );
    }

    const { id } = (await res.json()) as { id: string };
    await this.prisma.identity.updateMany({
      where: { userId, provider: Provider.GOOGLE },
      data: { calendarId: id },
    });
    return id;
  }

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
        client_id: process.env.GOOGLE_CLIENT_ID as string,
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

  /** Access token válido para outros serviços do módulo (ex: sync do
   * horário). Mantém getValidAccessToken privado, com um único ponto de
   * entrada para o refresh. */
  getAccessToken(userId: string): Promise<string> {
    return this.getValidAccessToken(userId);
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
    // Duas fases: o evento e a apresentacao, a entrega vai aqui.
    if (task.submissionDate && hasFirmDate(task.dateCertainty)) {
      lines.push(`Hand in: ${this.toDateOnlyString(task.submissionDate)}`);
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
      const end = new Date(date.getTime() + durationMinutes * MS_PER_MINUTE);
      return {
        summary: calendarTitle(task.title, task.dateCertainty),
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
      new Date(date.getTime() + MS_PER_DAY),
    );

    return {
      summary: calendarTitle(task.title, task.dateCertainty),
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
    let calendarId = await this.getCalendarId(userId, accessToken);

    // Atualização: PATCH ao evento existente. 404/410 = o evento (ou o
    // calendário inteiro) já não existe, ou é um evento antigo criado no
    // calendário primário com o scope anterior, que já não conseguimos
    // tocar. Em qualquer destes casos, segue-se para criar um novo.
    if (task.googleCalendarEventId) {
      const res = await this.sendEvent(
        'PATCH',
        `${this.eventsUrl(calendarId)}/${task.googleCalendarEventId}`,
        accessToken,
        payload,
      );
      if (res.ok) return ((await res.json()) as { id: string }).id;
      if (res.status !== HTTP_NOT_FOUND && res.status !== HTTP_GONE) {
        await this.failSync('PATCH', res);
      }
    }

    let res = await this.sendEvent(
      'POST',
      this.eventsUrl(calendarId),
      accessToken,
      payload,
    );

    // 404 na criação = a pessoa apagou o calendário "Productivity Maxing".
    if (res.status === HTTP_NOT_FOUND) {
      calendarId = await this.replaceCalendar(userId, accessToken, calendarId);
      res = await this.sendEvent(
        'POST',
        this.eventsUrl(calendarId),
        accessToken,
        payload,
      );
    }

    if (!res.ok) await this.failSync('POST', res);

    const data = (await res.json()) as { id: string };
    return data.id;
  }

  private sendEvent(
    method: 'POST' | 'PATCH',
    url: string,
    accessToken: string,
    payload: unknown,
  ): Promise<Response> {
    return googleFetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  private async failSync(method: string, res: Response): Promise<never> {
    const body = await res.text();
    this.logger.error(`Google Calendar API (${method}) falhou: ${body}`);
    throw new BadRequestException('Failed to sync task with Google Calendar.');
  }

  /** Remove o evento do Google Calendar (botão de "unsync" no Dashboard). */
  async deleteEventForTask(
    userId: string,
    googleCalendarEventId: string,
  ): Promise<void> {
    const accessToken = await this.getValidAccessToken(userId);
    const calendarId = await this.getCalendarId(userId, accessToken);

    const res = await googleFetch(
      `${this.eventsUrl(calendarId)}/${googleCalendarEventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    // 404/410 = o evento já não existe do lado da Google (ex: apagado à
    // mão pela pessoa, ou criado no calendário primário com o scope
    // anterior) - não é um erro, só confirma o que já queríamos.
    if (!res.ok && res.status !== HTTP_NOT_FOUND && res.status !== HTTP_GONE) {
      const body = await res.text();
      this.logger.error(`Google Calendar API (DELETE) falhou: ${body}`);
      throw new BadRequestException(
        'Failed to remove event from Google Calendar.',
      );
    }
  }
}
