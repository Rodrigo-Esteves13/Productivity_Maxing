// Textos do email de lembrete de prazos, por lingua. O User nao guarda a
// lingua da app; a unica guardada e a das subscricoes push (a da app nesse
// dispositivo, ver push-messages.ts). Sem subscricao ou lingua desconhecida
// -> ingles. Os outros emails (reset, verificacao, link de password) ainda
// sao so em ingles: sao pedidos sem sessao e nao ha lingua de confianca.
import { PUSH_LANGUAGES, type PushLanguage } from '../push/push-messages';

export type MailLanguage = PushLanguage;

interface DeadlineEmailText {
  /** {title} */
  subjectOne: string;
  /** {count} */
  subjectMany: string;
  titleOne: string;
  titleMany: string;
  button: string;
  footer: string;
  /** {date} */
  dueOn: string;
  /** {hours} */
  dueInHours: string;
}

// Locale do Intl para a data "due Mon 3 Nov" em cada lingua.
export const MAIL_DATE_LOCALE: Record<MailLanguage, string> = {
  en: 'en-GB',
  pt: 'pt-PT',
  es: 'es-ES',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
  de: 'de-DE',
};

const DEADLINE_EMAIL: Record<MailLanguage, DeadlineEmailText> = {
  en: {
    subjectOne: 'Due soon: {title}',
    subjectMany: '{count} tasks due soon',
    titleOne: 'A task is due soon',
    titleMany: 'Tasks due soon',
    button: 'Open my tasks',
    footer:
      'You get this because deadline reminders are on. Turn them off any time in Profile > Preferences.',
    dueOn: 'due {date}',
    dueInHours: 'due in about {hours}h',
  },
  pt: {
    subjectOne: 'Prazo a chegar: {title}',
    subjectMany: '{count} tarefas com prazo a chegar',
    titleOne: 'Uma tarefa tem o prazo a chegar',
    titleMany: 'Tarefas com prazo a chegar',
    button: 'Abrir as minhas tarefas',
    footer:
      'Recebes isto porque os lembretes de prazos estão ligados. Desliga-os quando quiseres em Perfil > Preferências.',
    dueOn: 'prazo {date}',
    dueInHours: 'prazo daqui a cerca de {hours}h',
  },
  es: {
    subjectOne: 'Vence pronto: {title}',
    subjectMany: '{count} tareas vencen pronto',
    titleOne: 'Una tarea vence pronto',
    titleMany: 'Tareas que vencen pronto',
    button: 'Abrir mis tareas',
    footer:
      'Recibes esto porque los recordatorios de plazos están activados. Desactívalos cuando quieras en Perfil > Preferencias.',
    dueOn: 'vence {date}',
    dueInHours: 'vence en unas {hours} h',
  },
  fr: {
    subjectOne: 'Échéance proche : {title}',
    subjectMany: '{count} tâches arrivent à échéance',
    titleOne: 'Une tâche arrive à échéance',
    titleMany: 'Tâches qui arrivent à échéance',
    button: 'Ouvrir mes tâches',
    footer:
      'Tu reçois ceci parce que les rappels d’échéance sont activés. Désactive-les quand tu veux dans Profil > Préférences.',
    dueOn: 'échéance {date}',
    dueInHours: 'échéance dans environ {hours} h',
  },
  de: {
    subjectOne: 'Bald fällig: {title}',
    subjectMany: '{count} Aufgaben bald fällig',
    titleOne: 'Eine Aufgabe ist bald fällig',
    titleMany: 'Bald fällige Aufgaben',
    button: 'Meine Aufgaben öffnen',
    footer:
      'Du bekommst das, weil Fristerinnerungen aktiv sind. Du kannst sie jederzeit unter Profil > Einstellungen ausschalten.',
    dueOn: 'fällig {date}',
    dueInHours: 'fällig in etwa {hours} Std.',
  },
  ja: {
    subjectOne: 'まもなく期限: {title}',
    subjectMany: '{count} 件のタスクがまもなく期限です',
    titleOne: 'まもなく期限のタスクがあります',
    titleMany: 'まもなく期限のタスク',
    button: 'タスクを開く',
    footer:
      '期限リマインダーがオンのため、このメールが届いています。プロフィール > 設定からいつでもオフにできます。',
    dueOn: '期限 {date}',
    dueInHours: '約 {hours} 時間後に期限',
  },
  ko: {
    subjectOne: '곧 마감: {title}',
    subjectMany: '{count}개의 작업이 곧 마감됩니다',
    titleOne: '곧 마감되는 작업이 있습니다',
    titleMany: '곧 마감되는 작업',
    button: '내 작업 열기',
    footer:
      '마감 알림이 켜져 있어서 이 메일을 받았습니다. 프로필 > 환경설정에서 언제든지 끌 수 있습니다.',
    dueOn: '마감 {date}',
    dueInHours: '약 {hours}시간 후 마감',
  },
  zh: {
    subjectOne: '即将到期：{title}',
    subjectMany: '{count} 个任务即将到期',
    titleOne: '有一个任务即将到期',
    titleMany: '即将到期的任务',
    button: '打开我的任务',
    footer:
      '你收到这封邮件是因为开启了截止提醒。可随时在 个人资料 > 偏好设置 中关闭。',
    dueOn: '{date} 到期',
    dueInHours: '约 {hours} 小时后到期',
  },
};

export function resolveMailLanguage(
  lang: string | null | undefined,
): MailLanguage {
  return (PUSH_LANGUAGES as readonly string[]).includes(lang ?? '')
    ? (lang as MailLanguage)
    : 'en';
}

export function deadlineEmailText(
  lang: string | null | undefined,
): DeadlineEmailText {
  return DEADLINE_EMAIL[resolveMailLanguage(lang)];
}

// Substitui {nome} pelos valores dados (texto simples; o HTML e escapado
// por quem monta o email).
export function fillMailTemplate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
