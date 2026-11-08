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
  | 'medicationsDue'
  | 'medicationFollowUp'
  | 'turmaAnnouncement'
  | 'turmaPackShared'
  | 'turmaDeadlineAdded'
  | 'turmaDeadlineMoved'
  | 'friendLinkJoined'
  | 'taskPackUpdated'
  | 'feedbackReplied'
  | 'feedbackRejected'
  | 'turmaInvited'
  | 'selfReminder'
  | 'absenceLimitNear'
  | 'streakRisk'
  | 'dueTodayDigest'
  | 'moneyReminder'
  | 'budgetWarn'
  | 'budgetOver'
  | 'leisureBudgetWarn'
  | 'leisureBudgetOver'
  | 'newDeviceLogin';

interface Template {
  title: string;
  body: string;
}

// {name} = pessoa, {title} = título da entrada ou da task, {count} = quantas mais.
const MESSAGES: Record<PushLanguage, Record<PushMessageKey, Template>> = {
  en: {
    friendLinkJoined: {
      title: 'New friend',
      body: '{name} used your friend link. You are now friends.',
    },
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
      title: 'Medication reminder',
      body: 'Time for a dose you planned. Check that you have not already taken it.',
    },
    medicationsDue: {
      title: 'Medication reminder',
      body: 'Time for a dose you planned. Check that you have not already taken it.',
    },
    medicationFollowUp: {
      title: 'Medication reminder',
      body: 'A planned dose is still not marked as taken. Check that you have not already taken it.',
    },
    turmaAnnouncement: {
      title: '{name}',
      body: 'New announcement: {title}',
    },
    turmaDeadlineAdded: {
      title: '{name}',
      body: 'New deadline: {title}. Add it to your tasks.',
    },
    turmaDeadlineMoved: {
      title: '{name}',
      body: 'The date of {title} changed. Your task was updated.',
    },
    turmaPackShared: {
      title: '{name}',
      body: 'New task pack: {title}',
    },
    taskPackUpdated: {
      title: '{name}',
      body: 'A task pack you imported changed: {title}. Review the update.',
    },
    feedbackReplied: {
      title: 'Reply to your feedback',
      body: 'Your feedback "{title}" got a reply.',
    },
    feedbackRejected: {
      title: 'Feedback declined',
      body: 'Your feedback "{title}" was declined.',
    },
    turmaInvited: {
      title: 'Class invite',
      body: '{name} invited you to {title}.',
    },
    selfReminder: {
      title: 'Reminder',
      body: '{title}',
    },
    absenceLimitNear: {
      title: 'Absence limit',
      body: 'You are close to the absence limit in {title}.',
    },
    streakRisk: {
      title: 'Streak at risk',
      body: 'Your {count}-day streak ends at midnight. A short session keeps it.',
    },
    dueTodayDigest: {
      title: "Today's tasks",
      body: 'Tasks due today: {count}.',
    },
    moneyReminder: {
      title: 'Money reminder',
      body: 'Items to check in Finance: {count}. Subscription renewals due tomorrow or money owed to you.',
    },
    budgetWarn: {
      title: 'Budget alert',
      body: 'You are close to your monthly budget. Check Finance before spending more.',
    },
    budgetOver: {
      title: 'Budget exceeded',
      body: 'You went over your monthly budget this month. Check Finance.',
    },
    leisureBudgetWarn: {
      title: 'Leisure budget alert',
      body: 'You are close to your leisure budget. Check Finance before spending more.',
    },
    leisureBudgetOver: {
      title: 'Leisure budget exceeded',
      body: 'You went over your leisure budget this month. Check Finance.',
    },
    newDeviceLogin: {
      title: 'New sign-in',
      body: 'Signed in on {title}. If it was not you, sign that device out in Devices.',
    },
  },
  pt: {
    friendLinkJoined: {
      title: 'Novo amigo',
      body: '{name} usou o teu link de amizade. Agora são amigos.',
    },
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
      title: 'Lembrete de medicação',
      body: 'Está na hora de uma toma que planeaste. Confirma que ainda não a tomaste.',
    },
    medicationsDue: {
      title: 'Lembrete de medicação',
      body: 'Está na hora de uma toma que planeaste. Confirma que ainda não a tomaste.',
    },
    medicationFollowUp: {
      title: 'Lembrete de medicação',
      body: 'Uma toma planeada ainda não está marcada como tomada. Confirma que ainda não a tomaste.',
    },
    turmaAnnouncement: {
      title: '{name}',
      body: 'Novo anúncio: {title}',
    },
    turmaDeadlineAdded: {
      title: '{name}',
      body: 'Novo prazo: {title}. Junta-o às tuas tasks.',
    },
    turmaDeadlineMoved: {
      title: '{name}',
      body: 'A data de {title} mudou. A tua task foi atualizada.',
    },
    turmaPackShared: {
      title: '{name}',
      body: 'Novo pacote de tasks: {title}',
    },
    taskPackUpdated: {
      title: '{name}',
      body: 'Um pacote de tasks que importaste mudou: {title}. Revê a alteração.',
    },
    feedbackReplied: {
      title: 'Resposta ao teu feedback',
      body: 'O teu feedback "{title}" recebeu uma resposta.',
    },
    feedbackRejected: {
      title: 'Feedback recusado',
      body: 'O teu feedback "{title}" foi recusado.',
    },
    turmaInvited: {
      title: 'Convite para turma',
      body: '{name} convidou-te para {title}.',
    },
    selfReminder: {
      title: 'Lembrete',
      body: '{title}',
    },
    absenceLimitNear: {
      title: 'Limite de faltas',
      body: 'Estás perto do limite de faltas em {title}.',
    },
    streakRisk: {
      title: 'Streak em risco',
      body: 'A tua streak de {count} dias acaba à meia-noite. Uma sessão curta mantém-na.',
    },
    dueTodayDigest: {
      title: 'Tarefas de hoje',
      body: 'Tarefas para hoje: {count}.',
    },
    moneyReminder: {
      title: 'Lembrete de dinheiro',
      body: 'Itens a ver nas Finanças: {count}. Subscrições a renovar amanhã ou dinheiro que te devem.',
    },
    budgetWarn: {
      title: 'Alerta de orçamento',
      body: 'Estás perto do teu orçamento mensal. Vê as Finanças antes de gastares mais.',
    },
    budgetOver: {
      title: 'Orçamento excedido',
      body: 'Ultrapassaste o orçamento mensal este mês. Vê as Finanças.',
    },
    leisureBudgetWarn: {
      title: 'Alerta de orçamento de lazer',
      body: 'Estás perto do teu orçamento de lazer. Vê as Finanças antes de gastares mais.',
    },
    leisureBudgetOver: {
      title: 'Orçamento de lazer excedido',
      body: 'Ultrapassaste o orçamento de lazer este mês. Vê as Finanças.',
    },
    newDeviceLogin: {
      title: 'Novo início de sessão',
      body: 'Sessão iniciada em {title}. Se não foste tu, termina essa sessão em Dispositivos.',
    },
  },
  es: {
    friendLinkJoined: {
      title: 'Nuevo amigo',
      body: '{name} usó tu enlace de amistad. Ahora sois amigos.',
    },
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
      title: 'Recordatorio de medicación',
      body: 'Es la hora de una toma que planificaste. Comprueba que no la has tomado ya.',
    },
    medicationsDue: {
      title: 'Recordatorio de medicación',
      body: 'Es la hora de una toma que planificaste. Comprueba que no la has tomado ya.',
    },
    medicationFollowUp: {
      title: 'Recordatorio de medicación',
      body: 'Una toma planificada aún no está marcada como tomada. Comprueba que no la has tomado ya.',
    },
    turmaAnnouncement: {
      title: '{name}',
      body: 'Nuevo anuncio: {title}',
    },
    turmaDeadlineAdded: {
      title: '{name}',
      body: 'Nuevo plazo: {title}. Añádelo a tus tareas.',
    },
    turmaDeadlineMoved: {
      title: '{name}',
      body: 'La fecha de {title} cambió. Tu tarea se actualizó.',
    },
    turmaPackShared: {
      title: '{name}',
      body: 'Nuevo paquete de tareas: {title}',
    },
    taskPackUpdated: {
      title: '{name}',
      body: 'Un paquete de tareas que importaste cambió: {title}. Revisa el cambio.',
    },
    feedbackReplied: {
      title: 'Respuesta a tu comentario',
      body: 'Tu comentario "{title}" recibió una respuesta.',
    },
    feedbackRejected: {
      title: 'Comentario rechazado',
      body: 'Tu comentario "{title}" fue rechazado.',
    },
    turmaInvited: {
      title: 'Invitación a una clase',
      body: '{name} te invitó a {title}.',
    },
    selfReminder: {
      title: 'Recordatorio',
      body: '{title}',
    },
    absenceLimitNear: {
      title: 'Límite de faltas',
      body: 'Estás cerca del límite de faltas en {title}.',
    },
    streakRisk: {
      title: 'Racha en riesgo',
      body: 'Tu racha de {count} días termina a medianoche. Una sesión corta la mantiene.',
    },
    dueTodayDigest: {
      title: 'Tareas de hoy',
      body: 'Tareas para hoy: {count}.',
    },
    moneyReminder: {
      title: 'Recordatorio de dinero',
      body: 'Elementos por revisar en Finanzas: {count}. Suscripciones que se renuevan mañana o dinero que te deben.',
    },
    budgetWarn: {
      title: 'Alerta de presupuesto',
      body: 'Estás cerca de tu presupuesto mensual. Revisa Finanzas antes de gastar más.',
    },
    budgetOver: {
      title: 'Presupuesto superado',
      body: 'Superaste tu presupuesto mensual este mes. Revisa Finanzas.',
    },
    leisureBudgetWarn: {
      title: 'Alerta de presupuesto de ocio',
      body: 'Estás cerca de tu presupuesto de ocio. Revisa Finanzas antes de gastar más.',
    },
    leisureBudgetOver: {
      title: 'Presupuesto de ocio superado',
      body: 'Superaste tu presupuesto de ocio este mes. Revisa Finanzas.',
    },
    newDeviceLogin: {
      title: 'Nuevo inicio de sesión',
      body: 'Sesión iniciada en {title}. Si no fuiste tú, cierra esa sesión en Dispositivos.',
    },
  },
  zh: {
    friendLinkJoined: {
      title: '新好友',
      body: '{name} 通过你的好友链接添加了你，你们现在是好友了。',
    },
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
      title: '用药提醒',
      body: '到了你计划的服药时间。请先确认你还没有服用过。',
    },
    medicationsDue: {
      title: '用药提醒',
      body: '到了你计划的服药时间。请先确认你还没有服用过。',
    },
    medicationFollowUp: {
      title: '用药提醒',
      body: '一次计划的服药仍未标记为已服用。请先确认你还没有服用过。',
    },
    turmaAnnouncement: {
      title: '{name}',
      body: '新公告：{title}',
    },
    turmaDeadlineAdded: {
      title: '{name}',
      body: '新截止日期：{title}。把它加入你的任务。',
    },
    turmaDeadlineMoved: {
      title: '{name}',
      body: '{title} 的日期已更改。你的任务已更新。',
    },
    turmaPackShared: {
      title: '{name}',
      body: '新任务包：{title}',
    },
    taskPackUpdated: {
      title: '{name}',
      body: '你导入的任务包有变化：{title}。请查看更新。',
    },
    feedbackReplied: {
      title: '反馈已回复',
      body: '你的反馈“{title}”收到了回复。',
    },
    feedbackRejected: {
      title: '反馈未被采纳',
      body: '你的反馈“{title}”未被采纳。',
    },
    turmaInvited: {
      title: '班级邀请',
      body: '{name} 邀请你加入 {title}。',
    },
    deadlinesSoon: {
      title: '截止日期临近',
      body: '“{title}”和另外 {count} 项即将截止。',
    },
    selfReminder: {
      title: '提醒',
      body: '{title}',
    },
    absenceLimitNear: {
      title: '缺勤上限',
      body: '你在 {title} 的缺勤次数已接近上限。',
    },
    streakRisk: {
      title: '连续记录有风险',
      body: '你的 {count} 天连续学习记录将在午夜结束。学习一小会儿即可保住。',
    },
    dueTodayDigest: {
      title: '今日任务',
      body: '今天到期的任务:{count}',
    },
    moneyReminder: {
      title: '资金提醒',
      body: '财务中需要查看的事项：{count} 项。包括明天续订的订阅，或别人欠你的款项。',
    },
    budgetWarn: {
      title: '预算提醒',
      body: '你的本月预算快用完了。继续消费前请先查看财务。',
    },
    budgetOver: {
      title: '预算已超支',
      body: '你本月的预算已超支。请查看财务。',
    },
    leisureBudgetWarn: {
      title: '娱乐预算提醒',
      body: '你的娱乐预算快用完了。继续消费前请先查看财务。',
    },
    leisureBudgetOver: {
      title: '娱乐预算已超支',
      body: '你本月的娱乐预算已超支。请查看财务。',
    },
    newDeviceLogin: {
      title: '新的登录',
      body: '已在 {title} 登录。如果不是你本人，请在“设备”中退出该设备。',
    },
  },
  ja: {
    friendLinkJoined: {
      title: '新しい友達',
      body: '{name} があなたの友達リンクを使いました。友達になりました。',
    },
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
      title: '服薬リマインダー',
      body: '予定していた服薬の時間です。すでに服用していないか確認してください。',
    },
    medicationsDue: {
      title: '服薬リマインダー',
      body: '予定していた服薬の時間です。すでに服用していないか確認してください。',
    },
    medicationFollowUp: {
      title: '服薬リマインダー',
      body: '予定していた服薬がまだ服用済みになっていません。すでに服用していないか確認してください。',
    },
    turmaAnnouncement: {
      title: '{name}',
      body: '新しいお知らせ：{title}',
    },
    turmaDeadlineAdded: {
      title: '{name}',
      body: '新しい締め切り：{title}。タスクに追加しましょう。',
    },
    turmaDeadlineMoved: {
      title: '{name}',
      body: '{title} の日付が変わりました。タスクを更新しました。',
    },
    turmaPackShared: {
      title: '{name}',
      body: '新しいタスクパック：{title}',
    },
    taskPackUpdated: {
      title: '{name}',
      body: 'インポートしたタスクパックが変更されました：{title}。更新を確認してください。',
    },
    feedbackReplied: {
      title: 'フィードバックへの返信',
      body: 'フィードバック「{title}」に返信がありました。',
    },
    feedbackRejected: {
      title: 'フィードバックは見送られました',
      body: 'フィードバック「{title}」は見送られました。',
    },
    turmaInvited: {
      title: 'クラスへの招待',
      body: '{name} さんが {title} に招待しました。',
    },
    deadlinesSoon: {
      title: '締め切りが近づいています',
      body: '「{title}」ほか {count} 件の締め切りが近づいています。',
    },
    selfReminder: {
      title: 'リマインダー',
      body: '{title}',
    },
    absenceLimitNear: {
      title: '欠席の上限',
      body: '{title} の欠席が上限に近づいています。',
    },
    streakRisk: {
      title: '連続記録が危険です',
      body: '{count}日連続の記録は深夜0時で途切れます。短い学習で守れます。',
    },
    dueTodayDigest: {
      title: '今日のタスク',
      body: '今日が期限のタスク:{count}件',
    },
    moneyReminder: {
      title: 'お金のリマインダー',
      body: '家計で確認する項目：{count}件。明日更新されるサブスク、または貸したお金の期限です。',
    },
    budgetWarn: {
      title: '予算アラート',
      body: '今月の予算に近づいています。使う前に家計を確認してください。',
    },
    budgetOver: {
      title: '予算超過',
      body: '今月の予算を超えました。家計を確認してください。',
    },
    leisureBudgetWarn: {
      title: '娯楽予算アラート',
      body: '娯楽の予算に近づいています。使う前に家計を確認してください。',
    },
    leisureBudgetOver: {
      title: '娯楽予算超過',
      body: '今月の娯楽予算を超えました。家計を確認してください。',
    },
    newDeviceLogin: {
      title: '新しいログイン',
      body: '{title} でログインしました。心当たりがない場合は、「デバイス」でそのデバイスをログアウトしてください。',
    },
  },
  ko: {
    friendLinkJoined: {
      title: '새 친구',
      body: '{name}님이 친구 링크를 사용했어요. 이제 친구예요.',
    },
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
      title: '복약 알림',
      body: '계획한 복용 시간입니다. 이미 복용하지 않았는지 확인하세요.',
    },
    medicationsDue: {
      title: '복약 알림',
      body: '계획한 복용 시간입니다. 이미 복용하지 않았는지 확인하세요.',
    },
    medicationFollowUp: {
      title: '복약 알림',
      body: '계획한 복용이 아직 복용 완료로 표시되지 않았습니다. 이미 복용하지 않았는지 확인하세요.',
    },
    turmaAnnouncement: {
      title: '{name}',
      body: '새 공지: {title}',
    },
    turmaDeadlineAdded: {
      title: '{name}',
      body: '새 마감: {title}. 내 할 일에 추가하세요.',
    },
    turmaDeadlineMoved: {
      title: '{name}',
      body: '{title}의 날짜가 바뀌었습니다. 내 할 일이 업데이트되었습니다.',
    },
    turmaPackShared: {
      title: '{name}',
      body: '새 과제 팩: {title}',
    },
    taskPackUpdated: {
      title: '{name}',
      body: '가져간 과제 팩이 변경되었습니다: {title}. 업데이트를 검토하세요.',
    },
    feedbackReplied: {
      title: '피드백 답변',
      body: '피드백 "{title}"에 답변이 도착했습니다.',
    },
    feedbackRejected: {
      title: '피드백 거절됨',
      body: '피드백 "{title}"이(가) 거절되었습니다.',
    },
    turmaInvited: {
      title: '반 초대',
      body: '{name} 님이 {title}에 초대했습니다.',
    },
    deadlinesSoon: {
      title: '마감이 다가와요',
      body: '"{title}" 외 {count}개의 마감이 곧이에요.',
    },
    selfReminder: {
      title: '알림',
      body: '{title}',
    },
    absenceLimitNear: {
      title: '결석 한도',
      body: '{title}의 결석이 한도에 가까워졌어요.',
    },
    streakRisk: {
      title: '연속 기록이 위험해요',
      body: '{count}일 연속 기록이 자정에 끝나요. 짧게 공부하면 지킬 수 있어요.',
    },
    dueTodayDigest: {
      title: '오늘의 할 일',
      body: '오늘 마감인 할 일: {count}개',
    },
    moneyReminder: {
      title: '돈 알림',
      body: '가계부에서 확인할 항목: {count}개. 내일 갱신되는 구독이나 받을 돈이 있어요.',
    },
    budgetWarn: {
      title: '예산 알림',
      body: '이번 달 예산에 가까워졌어요. 더 쓰기 전에 가계부를 확인하세요.',
    },
    budgetOver: {
      title: '예산 초과',
      body: '이번 달 예산을 넘었어요. 가계부를 확인하세요.',
    },
    leisureBudgetWarn: {
      title: '여가 예산 알림',
      body: '여가 예산에 가까워졌어요. 더 쓰기 전에 가계부를 확인하세요.',
    },
    leisureBudgetOver: {
      title: '여가 예산 초과',
      body: '이번 달 여가 예산을 넘었어요. 가계부를 확인하세요.',
    },
    newDeviceLogin: {
      title: '새 로그인',
      body: '{title}에서 로그인했습니다. 본인이 아니라면 기기 메뉴에서 해당 기기를 로그아웃하세요.',
    },
  },
  fr: {
    friendLinkJoined: {
      title: 'Nouvel ami',
      body: '{name} a utilisé ton lien d’ami. Vous êtes maintenant amis.',
    },
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
      title: 'Rappel de médicament',
      body: "C'est l'heure d'une prise prévue. Vérifie que tu ne l'as pas déjà prise.",
    },
    medicationsDue: {
      title: 'Rappel de médicament',
      body: "C'est l'heure d'une prise prévue. Vérifie que tu ne l'as pas déjà prise.",
    },
    medicationFollowUp: {
      title: 'Rappel de médicament',
      body: "Une prise prévue n'est toujours pas marquée comme prise. Vérifie que tu ne l'as pas déjà prise.",
    },
    turmaAnnouncement: {
      title: '{name}',
      body: 'Nouvelle annonce : {title}',
    },
    turmaDeadlineAdded: {
      title: '{name}',
      body: 'Nouvelle échéance : {title}. Ajoute-la à tes tâches.',
    },
    turmaDeadlineMoved: {
      title: '{name}',
      body: 'La date de {title} a changé. Ta tâche a été mise à jour.',
    },
    turmaPackShared: {
      title: '{name}',
      body: 'Nouveau pack de tâches : {title}',
    },
    taskPackUpdated: {
      title: '{name}',
      body: 'Un pack de tâches que tu as importé a changé : {title}. Examine la modification.',
    },
    feedbackReplied: {
      title: 'Réponse à ton avis',
      body: 'Ton avis "{title}" a reçu une réponse.',
    },
    feedbackRejected: {
      title: 'Avis refusé',
      body: 'Ton avis "{title}" a été refusé.',
    },
    turmaInvited: {
      title: 'Invitation à une classe',
      body: "{name} t'a invité dans {title}.",
    },
    selfReminder: {
      title: 'Rappel',
      body: '{title}',
    },
    absenceLimitNear: {
      title: "Limite d'absences",
      body: "Tu approches de la limite d'absences en {title}.",
    },
    streakRisk: {
      title: 'Série en danger',
      body: 'Ta série de {count} jours se termine à minuit. Une courte session la sauve.',
    },
    dueTodayDigest: {
      title: 'Tâches du jour',
      body: "Tâches à rendre aujourd'hui : {count}.",
    },
    moneyReminder: {
      title: 'Rappel d’argent',
      body: 'Éléments à vérifier dans Finances : {count}. Abonnements renouvelés demain ou argent qu’on te doit.',
    },
    budgetWarn: {
      title: 'Alerte budget',
      body: 'Tu approches de ton budget mensuel. Consulte Finances avant de dépenser plus.',
    },
    budgetOver: {
      title: 'Budget dépassé',
      body: 'Tu as dépassé ton budget mensuel ce mois-ci. Consulte Finances.',
    },
    leisureBudgetWarn: {
      title: 'Alerte budget loisirs',
      body: 'Tu approches de ton budget loisirs. Consulte Finances avant de dépenser plus.',
    },
    leisureBudgetOver: {
      title: 'Budget loisirs dépassé',
      body: 'Tu as dépassé ton budget loisirs ce mois-ci. Consulte Finances.',
    },
    newDeviceLogin: {
      title: 'Nouvelle connexion',
      body: 'Connexion depuis {title}. Si ce n’était pas toi, déconnecte cet appareil dans Appareils.',
    },
  },
  de: {
    friendLinkJoined: {
      title: 'Neuer Freund',
      body: '{name} hat deinen Freundeslink benutzt. Ihr seid jetzt befreundet.',
    },
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
      title: 'Medikamenten-Erinnerung',
      body: 'Zeit für eine geplante Einnahme. Prüfe, ob du sie nicht schon genommen hast.',
    },
    medicationsDue: {
      title: 'Medikamenten-Erinnerung',
      body: 'Zeit für eine geplante Einnahme. Prüfe, ob du sie nicht schon genommen hast.',
    },
    medicationFollowUp: {
      title: 'Medikamenten-Erinnerung',
      body: 'Eine geplante Einnahme ist noch nicht als genommen markiert. Prüfe, ob du sie nicht schon genommen hast.',
    },
    turmaAnnouncement: {
      title: '{name}',
      body: 'Neue Ankündigung: {title}',
    },
    turmaDeadlineAdded: {
      title: '{name}',
      body: 'Neue Frist: {title}. Füge sie deinen Aufgaben hinzu.',
    },
    turmaDeadlineMoved: {
      title: '{name}',
      body: 'Das Datum von {title} hat sich geändert. Deine Aufgabe wurde aktualisiert.',
    },
    turmaPackShared: {
      title: '{name}',
      body: 'Neues Aufgabenpaket: {title}',
    },
    taskPackUpdated: {
      title: '{name}',
      body: 'Ein importiertes Aufgabenpaket hat sich geändert: {title}. Prüfe die Änderung.',
    },
    feedbackReplied: {
      title: 'Antwort auf dein Feedback',
      body: 'Dein Feedback "{title}" hat eine Antwort erhalten.',
    },
    feedbackRejected: {
      title: 'Feedback abgelehnt',
      body: 'Dein Feedback "{title}" wurde abgelehnt.',
    },
    turmaInvited: {
      title: 'Einladung in eine Klasse',
      body: '{name} hat dich zu {title} eingeladen.',
    },
    selfReminder: {
      title: 'Erinnerung',
      body: '{title}',
    },
    absenceLimitNear: {
      title: 'Fehlzeitenlimit',
      body: 'Du näherst dich dem Fehlzeitenlimit in {title}.',
    },
    streakRisk: {
      title: 'Serie in Gefahr',
      body: 'Deine {count}-Tage-Serie endet um Mitternacht. Eine kurze Einheit rettet sie.',
    },
    dueTodayDigest: {
      title: 'Heutige Aufgaben',
      body: 'Heute fällige Aufgaben: {count}.',
    },
    moneyReminder: {
      title: 'Geld-Erinnerung',
      body: 'Zu prüfen in Finanzen: {count}. Abos, die morgen verlängert werden, oder Geld, das man dir schuldet.',
    },
    budgetWarn: {
      title: 'Budget-Warnung',
      body: 'Du näherst dich deinem Monatsbudget. Sieh in Finanzen nach, bevor du mehr ausgibst.',
    },
    budgetOver: {
      title: 'Budget überschritten',
      body: 'Du hast dein Monatsbudget diesen Monat überschritten. Sieh in Finanzen nach.',
    },
    leisureBudgetWarn: {
      title: 'Freizeitbudget-Warnung',
      body: 'Du näherst dich deinem Freizeitbudget. Sieh in Finanzen nach, bevor du mehr ausgibst.',
    },
    leisureBudgetOver: {
      title: 'Freizeitbudget überschritten',
      body: 'Du hast dein Freizeitbudget diesen Monat überschritten. Sieh in Finanzen nach.',
    },
    newDeviceLogin: {
      title: 'Neue Anmeldung',
      body: 'Anmeldung auf {title}. Falls du das nicht warst, melde dieses Gerät unter Geräte ab.',
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
