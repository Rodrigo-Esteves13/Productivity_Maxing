// Textos dos avisos push, por língua. O servidor escolhe a língua guardada na
// subscrição (a da app nesse dispositivo). Falta de língua/chave -> inglês.
export const PUSH_LANGUAGES = [
  'en',
  'pt',
  'es',
  'zh',
  'ja',
  'ko',
  'fr',
  'de',
] as const;
export type PushLanguage = (typeof PUSH_LANGUAGES)[number];

export type PushMessageKey =
  | 'shareAccessRequested'
  | 'shareAccessApproved'
  | 'shareAccessDenied'
  | 'shareProposalReceived'
  | 'shareProposalApproved'
  | 'shareProposalRejected'
  | 'pushTest'
  | 'friendRequest'
  | 'notesRequested'
  | 'notesGranted'
  | 'shareInvited'
  | 'shareInviteAccepted'
  | 'deadlineSoon'
  | 'deadlinesSoon'
  | 'medicationDue'
  | 'medicationsDue';

interface Template {
  title: string;
  body: string;
}

// {name} = pessoa, {title} = título da entrada ou da task, {count} = quantas mais.
const MESSAGES: Record<PushLanguage, Record<PushMessageKey, Template>> = {
  en: {
    shareAccessRequested: {
      title: 'Access request',
      body: '{name} wants to open "{title}".',
    },
    shareAccessApproved: {
      title: 'Access approved',
      body: 'You can now open "{title}".',
    },
    shareAccessDenied: {
      title: 'Access declined',
      body: 'Your request for "{title}" was declined.',
    },
    shareProposalReceived: {
      title: 'New suggestion',
      body: '{name} suggested changes to "{title}".',
    },
    shareProposalApproved: {
      title: 'Suggestion accepted',
      body: 'Your changes to "{title}" were accepted.',
    },
    shareProposalRejected: {
      title: 'Suggestion declined',
      body: 'Your changes to "{title}" were not accepted.',
    },
    pushTest: {
      title: 'Test notification',
      body: 'Notifications are working on this device.',
    },
    friendRequest: {
      title: 'Friend request',
      body: '{name} sent you a friend request.',
    },
    notesRequested: {
      title: 'Notes request',
      body: '{name} asked to read your notes.',
    },
    notesGranted: {
      title: 'Notes shared',
      body: '{name} let you read their notes.',
    },
    shareInvited: {
      title: 'Invitation',
      body: '{name} invited you to collaborate on "{title}".',
    },
    shareInviteAccepted: {
      title: 'Invitation accepted',
      body: '{name} accepted your invitation to "{title}".',
    },
    deadlineSoon: {
      title: 'Deadline coming up',
      body: '"{title}" is due soon.',
    },
    deadlinesSoon: {
      title: 'Deadlines coming up',
      body: '"{title}" and {count} more are due soon.',
    },
    medicationDue: {
      title: 'Medication time',
      body: 'Time to take {title}.',
    },
    medicationsDue: {
      title: 'Medication time',
      body: 'Time to take {title} and {count} more.',
    },
  },
  pt: {
    shareAccessRequested: {
      title: 'Pedido de acesso',
      body: '{name} quer abrir "{title}".',
    },
    shareAccessApproved: {
      title: 'Acesso aprovado',
      body: 'Já podes abrir "{title}".',
    },
    shareAccessDenied: {
      title: 'Acesso recusado',
      body: 'O teu pedido para "{title}" foi recusado.',
    },
    shareProposalReceived: {
      title: 'Nova sugestão',
      body: '{name} sugeriu alterações a "{title}".',
    },
    shareProposalApproved: {
      title: 'Sugestão aceite',
      body: 'As tuas alterações a "{title}" foram aceites.',
    },
    shareProposalRejected: {
      title: 'Sugestão recusada',
      body: 'As tuas alterações a "{title}" não foram aceites.',
    },
    pushTest: {
      title: 'Notificação de teste',
      body: 'As notificações estão a funcionar neste dispositivo.',
    },
    friendRequest: {
      title: 'Pedido de amizade',
      body: '{name} enviou-te um pedido de amizade.',
    },
    notesRequested: {
      title: 'Pedido de notas',
      body: '{name} pediu para ler as tuas notas.',
    },
    notesGranted: {
      title: 'Notas partilhadas',
      body: '{name} deixou-te ler as notas.',
    },
    shareInvited: {
      title: 'Convite',
      body: '{name} convidou-te para colaborar em "{title}".',
    },
    shareInviteAccepted: {
      title: 'Convite aceite',
      body: '{name} aceitou o teu convite para "{title}".',
    },
    deadlineSoon: {
      title: 'Prazo a aproximar-se',
      body: '"{title}" termina em breve.',
    },
    deadlinesSoon: {
      title: 'Prazos a aproximar-se',
      body: '"{title}" e mais {count} terminam em breve.',
    },
    medicationDue: {
      title: 'Hora da medicação',
      body: 'Está na hora de tomar {title}.',
    },
    medicationsDue: {
      title: 'Hora da medicação',
      body: 'Está na hora de tomar {title} e mais {count}.',
    },
  },
  es: {
    shareAccessRequested: {
      title: 'Solicitud de acceso',
      body: '{name} quiere abrir "{title}".',
    },
    shareAccessApproved: {
      title: 'Acceso aprobado',
      body: 'Ya puedes abrir "{title}".',
    },
    shareAccessDenied: {
      title: 'Acceso rechazado',
      body: 'Tu solicitud para "{title}" fue rechazada.',
    },
    shareProposalReceived: {
      title: 'Nueva sugerencia',
      body: '{name} sugirió cambios en "{title}".',
    },
    shareProposalApproved: {
      title: 'Sugerencia aceptada',
      body: 'Tus cambios en "{title}" fueron aceptados.',
    },
    shareProposalRejected: {
      title: 'Sugerencia rechazada',
      body: 'Tus cambios en "{title}" no fueron aceptados.',
    },
    pushTest: {
      title: 'Notificación de prueba',
      body: 'Las notificaciones funcionan en este dispositivo.',
    },
    friendRequest: {
      title: 'Solicitud de amistad',
      body: '{name} te envió una solicitud de amistad.',
    },
    notesRequested: {
      title: 'Solicitud de apuntes',
      body: '{name} pidió leer tus apuntes.',
    },
    notesGranted: {
      title: 'Apuntes compartidos',
      body: '{name} te permitió leer sus apuntes.',
    },
    shareInvited: {
      title: 'Invitación',
      body: '{name} te invitó a colaborar en "{title}".',
    },
    shareInviteAccepted: {
      title: 'Invitación aceptada',
      body: '{name} aceptó tu invitación a "{title}".',
    },
    deadlineSoon: {
      title: 'Plazo cercano',
      body: '"{title}" vence pronto.',
    },
    deadlinesSoon: {
      title: 'Plazos cercanos',
      body: '"{title}" y {count} más vencen pronto.',
    },
    medicationDue: {
      title: 'Hora de la medicación',
      body: 'Es hora de tomar {title}.',
    },
    medicationsDue: {
      title: 'Hora de la medicación',
      body: 'Es hora de tomar {title} y {count} más.',
    },
  },
  zh: {
    shareAccessRequested: {
      title: '访问请求',
      body: '{name} 想打开“{title}”。',
    },
    shareAccessApproved: {
      title: '访问已批准',
      body: '你现在可以打开“{title}”了。',
    },
    shareAccessDenied: {
      title: '访问被拒绝',
      body: '你对“{title}”的请求被拒绝了。',
    },
    shareProposalReceived: {
      title: '新的修改建议',
      body: '{name} 对“{title}”提出了修改建议。',
    },
    shareProposalApproved: {
      title: '建议已采纳',
      body: '你对“{title}”的修改已被采纳。',
    },
    shareProposalRejected: {
      title: '建议未被采纳',
      body: '你对“{title}”的修改未被采纳。',
    },
    pushTest: { title: '测试通知', body: '此设备上的通知工作正常。' },
    friendRequest: { title: '好友请求', body: '{name} 向你发送了好友请求。' },
    notesRequested: { title: '笔记请求', body: '{name} 想阅读你的笔记。' },
    notesGranted: { title: '笔记已共享', body: '{name} 允许你阅读其笔记。' },
    shareInvited: {
      title: '邀请',
      body: '{name} 邀请你协作编辑“{title}”。',
    },
    shareInviteAccepted: {
      title: '邀请已接受',
      body: '{name} 接受了你对“{title}”的邀请。',
    },
    deadlineSoon: {
      title: '截止日期临近',
      body: '“{title}”即将截止。',
    },
    medicationDue: {
      title: '服药时间',
      body: '该服用 {title} 了。',
    },
    medicationsDue: {
      title: '服药时间',
      body: '该服用 {title} 以及另外 {count} 种药了。',
    },
    deadlinesSoon: {
      title: '截止日期临近',
      body: '“{title}”和另外 {count} 项即将截止。',
    },
  },
  ja: {
    shareAccessRequested: {
      title: 'アクセスのリクエスト',
      body: '{name} さんが「{title}」を開こうとしています。',
    },
    shareAccessApproved: {
      title: 'アクセスが承認されました',
      body: '「{title}」を開けるようになりました。',
    },
    shareAccessDenied: {
      title: 'アクセスが拒否されました',
      body: '「{title}」へのリクエストは拒否されました。',
    },
    shareProposalReceived: {
      title: '新しい編集提案',
      body: '{name} さんが「{title}」の変更を提案しました。',
    },
    shareProposalApproved: {
      title: '提案が採用されました',
      body: '「{title}」への変更が採用されました。',
    },
    shareProposalRejected: {
      title: '提案は採用されませんでした',
      body: '「{title}」への変更は採用されませんでした。',
    },
    pushTest: {
      title: 'テスト通知',
      body: 'このデバイスで通知は正常に動作しています。',
    },
    friendRequest: {
      title: '友達リクエスト',
      body: '{name} さんから友達リクエストが届きました。',
    },
    notesRequested: {
      title: 'ノートのリクエスト',
      body: '{name} さんがあなたのノートを読みたがっています。',
    },
    notesGranted: {
      title: 'ノートが共有されました',
      body: '{name} さんがノートを読めるようにしました。',
    },
    shareInvited: {
      title: '招待',
      body: '{name}さんが「{title}」への参加に招待しました。',
    },
    shareInviteAccepted: {
      title: '招待が承認されました',
      body: '{name}さんが「{title}」への招待を承認しました。',
    },
    deadlineSoon: {
      title: '締め切りが近づいています',
      body: '「{title}」の締め切りが近づいています。',
    },
    medicationDue: {
      title: 'お薬の時間',
      body: '{title} を飲む時間です。',
    },
    medicationsDue: {
      title: 'お薬の時間',
      body: '{title} ほか {count} 件を飲む時間です。',
    },
    deadlinesSoon: {
      title: '締め切りが近づいています',
      body: '「{title}」ほか {count} 件の締め切りが近づいています。',
    },
  },
  ko: {
    shareAccessRequested: {
      title: '접근 요청',
      body: '{name}님이 "{title}"을(를) 열고 싶어 합니다.',
    },
    shareAccessApproved: {
      title: '접근 승인됨',
      body: '이제 "{title}"을(를) 열 수 있습니다.',
    },
    shareAccessDenied: {
      title: '접근 거절됨',
      body: '"{title}"에 대한 요청이 거절되었습니다.',
    },
    shareProposalReceived: {
      title: '새 수정 제안',
      body: '{name}님이 "{title}"의 수정을 제안했습니다.',
    },
    shareProposalApproved: {
      title: '제안 수락됨',
      body: '"{title}"에 대한 수정이 수락되었습니다.',
    },
    shareProposalRejected: {
      title: '제안 거절됨',
      body: '"{title}"에 대한 수정이 수락되지 않았습니다.',
    },
    pushTest: {
      title: '테스트 알림',
      body: '이 기기에서 알림이 정상적으로 작동합니다.',
    },
    friendRequest: {
      title: '친구 요청',
      body: '{name}님이 친구 요청을 보냈습니다.',
    },
    notesRequested: {
      title: '노트 요청',
      body: '{name}님이 내 노트를 보고 싶어 합니다.',
    },
    notesGranted: {
      title: '노트 공유됨',
      body: '{name}님이 노트를 볼 수 있게 했습니다.',
    },
    shareInvited: {
      title: '초대',
      body: '{name}님이 "{title}" 공동 작업에 초대했어요.',
    },
    shareInviteAccepted: {
      title: '초대 수락됨',
      body: '{name}님이 "{title}" 초대를 수락했어요.',
    },
    deadlineSoon: {
      title: '마감이 다가와요',
      body: '"{title}" 마감이 곧이에요.',
    },
    medicationDue: {
      title: '약 먹을 시간',
      body: '{title} 복용할 시간이에요.',
    },
    medicationsDue: {
      title: '약 먹을 시간',
      body: '{title} 외 {count}개를 복용할 시간이에요.',
    },
    deadlinesSoon: {
      title: '마감이 다가와요',
      body: '"{title}" 외 {count}개의 마감이 곧이에요.',
    },
  },
  fr: {
    shareAccessRequested: {
      title: "Demande d'accès",
      body: '{name} souhaite ouvrir "{title}".',
    },
    shareAccessApproved: {
      title: 'Accès approuvé',
      body: 'Vous pouvez maintenant ouvrir "{title}".',
    },
    shareAccessDenied: {
      title: 'Accès refusé',
      body: 'Votre demande pour "{title}" a été refusée.',
    },
    shareProposalReceived: {
      title: 'Nouvelle suggestion',
      body: '{name} a suggéré des modifications à "{title}".',
    },
    shareProposalApproved: {
      title: 'Suggestion acceptée',
      body: 'Vos modifications de "{title}" ont été acceptées.',
    },
    shareProposalRejected: {
      title: 'Suggestion refusée',
      body: 'Vos modifications de "{title}" n\'ont pas été acceptées.',
    },
    pushTest: {
      title: 'Notification de test',
      body: 'Les notifications fonctionnent sur cet appareil.',
    },
    friendRequest: {
      title: "Demande d'ami",
      body: "{name} vous a envoyé une demande d'ami.",
    },
    notesRequested: {
      title: 'Demande de notes',
      body: '{name} souhaite lire vos notes.',
    },
    notesGranted: {
      title: 'Notes partagées',
      body: '{name} vous a donné accès à ses notes.',
    },
    shareInvited: {
      title: 'Invitation',
      body: '{name} t’a invité à collaborer sur "{title}".',
    },
    shareInviteAccepted: {
      title: 'Invitation acceptée',
      body: '{name} a accepté ton invitation à "{title}".',
    },
    deadlineSoon: {
      title: 'Échéance proche',
      body: '« {title} » arrive bientôt à échéance.',
    },
    deadlinesSoon: {
      title: 'Échéances proches',
      body: '« {title} » et {count} autres arrivent bientôt à échéance.',
    },
    medicationDue: {
      title: 'Heure du médicament',
      body: "C'est l'heure de prendre {title}.",
    },
    medicationsDue: {
      title: 'Heure du médicament',
      body: "C'est l'heure de prendre {title} et {count} autres.",
    },
  },
  de: {
    shareAccessRequested: {
      title: 'Zugriffsanfrage',
      body: '{name} möchte "{title}" öffnen.',
    },
    shareAccessApproved: {
      title: 'Zugriff genehmigt',
      body: 'Du kannst "{title}" jetzt öffnen.',
    },
    shareAccessDenied: {
      title: 'Zugriff abgelehnt',
      body: 'Deine Anfrage für "{title}" wurde abgelehnt.',
    },
    shareProposalReceived: {
      title: 'Neuer Vorschlag',
      body: '{name} hat Änderungen an "{title}" vorgeschlagen.',
    },
    shareProposalApproved: {
      title: 'Vorschlag angenommen',
      body: 'Deine Änderungen an "{title}" wurden angenommen.',
    },
    shareProposalRejected: {
      title: 'Vorschlag abgelehnt',
      body: 'Deine Änderungen an "{title}" wurden nicht angenommen.',
    },
    pushTest: {
      title: 'Testbenachrichtigung',
      body: 'Benachrichtigungen funktionieren auf diesem Gerät.',
    },
    friendRequest: {
      title: 'Freundschaftsanfrage',
      body: '{name} hat dir eine Freundschaftsanfrage geschickt.',
    },
    notesRequested: {
      title: 'Notizen-Anfrage',
      body: '{name} möchte deine Notizen lesen.',
    },
    notesGranted: {
      title: 'Notizen geteilt',
      body: '{name} lässt dich seine Notizen lesen.',
    },
    shareInvited: {
      title: 'Einladung',
      body: '{name} hat dich eingeladen, an "{title}" mitzuarbeiten.',
    },
    shareInviteAccepted: {
      title: 'Einladung angenommen',
      body: '{name} hat deine Einladung zu "{title}" angenommen.',
    },
    deadlineSoon: {
      title: 'Frist naht',
      body: '„{title}“ ist bald fällig.',
    },
    deadlinesSoon: {
      title: 'Fristen nahen',
      body: '„{title}“ und {count} weitere sind bald fällig.',
    },
    medicationDue: {
      title: 'Zeit für Medikamente',
      body: 'Zeit, {title} zu nehmen.',
    },
    medicationsDue: {
      title: 'Zeit für Medikamente',
      body: 'Zeit, {title} und {count} weitere zu nehmen.',
    },
  },
};

export function buildPushText(
  lang: string,
  key: PushMessageKey,
  vars: { name?: string; title?: string; count?: number },
): Template {
  const dict =
    (MESSAGES as Record<string, (typeof MESSAGES)['en']>)[lang] ?? MESSAGES.en;
  const tpl = dict[key] ?? MESSAGES.en[key];
  const fill = (s: string) =>
    s
      .replace('{name}', (vars.name ?? '').slice(0, 60))
      .replace('{title}', (vars.title ?? '').slice(0, 80))
      .replace('{count}', String(vars.count ?? ''));
  return { title: fill(tpl.title), body: fill(tpl.body) };
}
