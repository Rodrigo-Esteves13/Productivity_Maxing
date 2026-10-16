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
  | 'shareProposalRejected';

interface Template {
  title: string;
  body: string;
}

// {name} = pessoa, {title} = título da entrada.
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
  },
};

export function buildPushText(
  lang: string,
  key: PushMessageKey,
  vars: { name?: string; title?: string },
): Template {
  const dict =
    (MESSAGES as Record<string, (typeof MESSAGES)['en']>)[lang] ?? MESSAGES.en;
  const tpl = dict[key] ?? MESSAGES.en[key];
  const fill = (s: string) =>
    s
      .replace('{name}', (vars.name ?? '').slice(0, 60))
      .replace('{title}', (vars.title ?? '').slice(0, 80));
  return { title: fill(tpl.title), body: fill(tpl.body) };
}
