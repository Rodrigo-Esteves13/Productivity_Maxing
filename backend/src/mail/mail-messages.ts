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

// Email de alerta de novo dispositivo (ver NewDeviceAlertService).
interface NewDeviceEmailText {
  subject: string;
  title: string;
  intro: string;
  /** {browser} {os} */
  deviceLine: string;
  deviceLabel: string;
  networkLabel: string;
  timeLabel: string;
  /** Mostrado quando o navegador, o sistema ou o IP nao foram reconhecidos. */
  unknown: string;
  button: string;
  footer: string;
}

const NEW_DEVICE_EMAIL: Record<MailLanguage, NewDeviceEmailText> = {
  en: {
    subject: 'New sign-in to your account',
    title: 'New sign-in to your account',
    intro: 'We noticed a sign-in from a device we have not seen before.',
    deviceLine: '{browser} on {os}',
    deviceLabel: 'Device',
    networkLabel: 'Network',
    timeLabel: 'Time',
    unknown: 'unknown',
    button: 'Review my devices',
    footer:
      'If this was you, no action is needed. If not, open Devices and sign that device out, then change your password.',
  },
  pt: {
    subject: 'Novo início de sessão na tua conta',
    title: 'Novo início de sessão na tua conta',
    intro:
      'Detetámos um início de sessão a partir de um dispositivo que ainda não conhecíamos.',
    deviceLine: '{browser} em {os}',
    deviceLabel: 'Dispositivo',
    networkLabel: 'Rede',
    timeLabel: 'Hora',
    unknown: 'desconhecida',
    button: 'Ver os meus dispositivos',
    footer:
      'Se foste tu, não precisas de fazer nada. Se não, abre Dispositivos e termina essa sessão, e depois muda a password.',
  },
  es: {
    subject: 'Nuevo inicio de sesión en tu cuenta',
    title: 'Nuevo inicio de sesión en tu cuenta',
    intro:
      'Detectamos un inicio de sesión desde un dispositivo que no conocíamos.',
    deviceLine: '{browser} en {os}',
    deviceLabel: 'Dispositivo',
    networkLabel: 'Red',
    timeLabel: 'Hora',
    unknown: 'desconocida',
    button: 'Ver mis dispositivos',
    footer:
      'Si fuiste tú, no tienes que hacer nada. Si no, abre Dispositivos y cierra esa sesión, y después cambia tu contraseña.',
  },
  fr: {
    subject: 'Nouvelle connexion à ton compte',
    title: 'Nouvelle connexion à ton compte',
    intro:
      'Nous avons détecté une connexion depuis un appareil que nous ne connaissions pas.',
    deviceLine: '{browser} sur {os}',
    deviceLabel: 'Appareil',
    networkLabel: 'Réseau',
    timeLabel: 'Heure',
    unknown: 'inconnu',
    button: 'Voir mes appareils',
    footer:
      'Si c’était toi, rien à faire. Sinon, ouvre Appareils et déconnecte cet appareil, puis change ton mot de passe.',
  },
  de: {
    subject: 'Neue Anmeldung bei deinem Konto',
    title: 'Neue Anmeldung bei deinem Konto',
    intro:
      'Wir haben eine Anmeldung von einem bisher unbekannten Gerät bemerkt.',
    deviceLine: '{browser} auf {os}',
    deviceLabel: 'Gerät',
    networkLabel: 'Netzwerk',
    timeLabel: 'Zeit',
    unknown: 'unbekannt',
    button: 'Meine Geräte ansehen',
    footer:
      'Wenn du das warst, musst du nichts tun. Falls nicht, öffne Geräte, melde dieses Gerät ab und ändere dann dein Passwort.',
  },
  ja: {
    subject: 'アカウントへの新しいログイン',
    title: 'アカウントへの新しいログイン',
    intro: '見覚えのないデバイスからのログインを検出しました。',
    deviceLine: '{os} の {browser}',
    deviceLabel: 'デバイス',
    networkLabel: 'ネットワーク',
    timeLabel: '日時',
    unknown: '不明',
    button: 'デバイスを確認する',
    footer:
      'ご本人の場合は何もする必要はありません。違う場合は、デバイス画面でそのデバイスをログアウトし、パスワードを変更してください。',
  },
  ko: {
    subject: '계정에 새 로그인',
    title: '계정에 새 로그인',
    intro: '처음 보는 기기에서 로그인한 것을 감지했습니다.',
    deviceLine: '{os}의 {browser}',
    deviceLabel: '기기',
    networkLabel: '네트워크',
    timeLabel: '시간',
    unknown: '알 수 없음',
    button: '내 기기 확인하기',
    footer:
      '본인이라면 아무것도 하지 않아도 됩니다. 아니라면 기기 메뉴에서 해당 기기를 로그아웃하고 비밀번호를 변경하세요.',
  },
  zh: {
    subject: '你的账户有新的登录',
    title: '你的账户有新的登录',
    intro: '我们发现有一台未曾见过的设备登录了你的账户。',
    deviceLine: '{os} 上的 {browser}',
    deviceLabel: '设备',
    networkLabel: '网络',
    timeLabel: '时间',
    unknown: '未知',
    button: '查看我的设备',
    footer:
      '如果是你本人，无需操作。如果不是，请在“设备”中退出该设备，然后修改密码。',
  },
};

export function newDeviceEmailText(
  lang: string | null | undefined,
): NewDeviceEmailText {
  return NEW_DEVICE_EMAIL[resolveMailLanguage(lang)];
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
