import { useState } from 'react';
import type { UseEntryShareResult } from '../../hooks/useEntryShare';
import type { ChangeProposal, NotebookShareVisibility, ShareAccessRole } from '../../types/models';
import { LinkIcon, CheckIcon, XIcon } from '../UI/Icons';
import CopyButton from '../UI/CopyButton';
import IconButton from '../UI/IconButton';
import SegmentedControl from '../UI/SegmentedControl';
import type { SegmentedOption } from '../UI/SegmentedControl';
import { useI18n } from '../../i18n/useI18n';

interface NotebookEntryShareProps {
  share: UseEntryShareResult;
  // Titulo/notas atuais do rascunho, para mostrar o que cada proposta muda.
  currentTitle: string;
  currentText: string;
}

const ROLES: ShareAccessRole[] = ['VIEWER', 'EDITOR', 'CO_OWNER'];
const ROLE_KEY: Record<ShareAccessRole, string> = {
  VIEWER: 'share.role.viewer',
  EDITOR: 'share.role.editor',
  CO_OWNER: 'share.role.coOwner',
};

const SELECT_CLASS =
  'rounded-md border border-neutral-700 bg-neutral-950 px-1.5 py-1 text-xs text-neutral-200 focus:border-violet-500 focus:outline-none disabled:opacity-50';

function RoleSelect({
  value,
  disabled,
  onChange,
}: {
  value: ShareAccessRole;
  disabled?: boolean;
  onChange: (role: ShareAccessRole) => void;
}) {
  const { t } = useI18n();
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label={t('share.role.label')}
      onChange={(e) => onChange(e.target.value as ShareAccessRole)}
      className={SELECT_CLASS}
    >
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {t(ROLE_KEY[role])}
        </option>
      ))}
    </select>
  );
}

// Uma alteracao proposta por um editor: o que muda (titulo / numero de
// caracteres) + o texto proposto escondido num <details>, e aprovar/recusar.
function ProposalRow({
  proposal,
  currentTitle,
  currentText,
  isDeciding,
  onDecide,
}: {
  proposal: ChangeProposal;
  currentTitle: string;
  currentText: string;
  isDeciding: boolean;
  onDecide: (decision: 'APPROVED' | 'REJECTED') => void;
}) {
  const { t } = useI18n();
  const { title, textContent } = proposal.payload;
  const titleChanged = title !== undefined && title !== currentTitle;
  const textChanged = textContent !== undefined && textContent !== currentText;
  const delta = textContent !== undefined ? textContent.length - currentText.length : 0;

  return (
    <li className="space-y-1.5 rounded-md border border-neutral-800 bg-neutral-950/60 p-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-neutral-200">{proposal.proposedBy.name ?? proposal.proposedBy.email}</p>
          {proposal.note && <p className="text-neutral-500">“{proposal.note}”</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={isDeciding}
            onClick={() => onDecide('APPROVED')}
            className="flex items-center gap-1 rounded-md bg-violet-500/15 px-2 py-1 text-violet-300 hover:bg-violet-500/25 disabled:opacity-50"
          >
            <CheckIcon className="h-3.5 w-3.5" />
            {t('share.proposals.approve')}
          </button>
          <button
            type="button"
            disabled={isDeciding}
            onClick={() => onDecide('REJECTED')}
            className="flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-1 text-red-400 hover:bg-red-500/25 disabled:opacity-50"
          >
            <XIcon className="h-3.5 w-3.5" />
            {t('share.proposals.reject')}
          </button>
        </div>
      </div>

      {titleChanged && (
        <p className="text-neutral-400">{t('share.proposals.titleChange', { from: currentTitle, to: title ?? '' })}</p>
      )}
      {textChanged && (
        <details>
          <summary className="cursor-pointer text-neutral-400 hover:text-neutral-200">
            {t('share.proposals.textChange', { delta: `${delta >= 0 ? '+' : ''}${delta}` })}
          </summary>
          <p className="mt-1.5 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-neutral-900 p-2 text-neutral-300">
            {textContent}
          </p>
        </details>
      )}
      {!titleChanged && !textChanged && <p className="text-neutral-600">{t('share.proposals.noChange')}</p>}
    </li>
  );
}

// Apresentacional: o estado vive em useEntryShare (chamado no wrapper do
// editor) para o painel sobreviver a trocar entre leitura e edicao.
// Partilhar nao depende de estar em modo edicao nem de gravar nada, e uma
// acao a parte sobre a entrada ja guardada.
export default function NotebookEntryShare({ share, currentTitle, currentText }: NotebookEntryShareProps) {
  const { t } = useI18n();
  const {
    isOpen, token, visibility, isLoading, error, shareUrl, requests, pendingCount,
    isRequestsLoading, decidingId, proposals, decidingProposalId,
    open, close, create, revoke, changeVisibility, decide, decideProposal,
  } = share;
  // Papel escolhido para cada pedido pendente, antes de aprovar.
  const [pendingRoles, setPendingRoles] = useState<Record<string, ShareAccessRole>>({});

  const visibilityOptions: SegmentedOption<NotebookShareVisibility>[] = [
    { value: 'PUBLIC', label: t('share.visibility.public') },
    { value: 'AUTHORIZED', label: t('share.visibility.authorized') },
  ];

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => void open()}
        className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
      >
        <LinkIcon className="h-3.5 w-3.5" />
        {t('share.button')}
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-neutral-800 bg-neutral-900 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-neutral-300">
          {token
            ? visibility === 'PUBLIC'
              ? t('share.public.desc')
              : t('share.authorized.desc')
            : t('share.none.desc')}
        </p>
        <IconButton label={t('share.close')} className="p-1 hover:bg-neutral-800" onClick={close}>
          <XIcon className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {token && (
        <SegmentedControl
          className={`mt-2 w-full [&>button]:flex-1 [&>button]:justify-center ${isLoading ? 'pointer-events-none opacity-60' : ''}`}
          size="sm"
          surface="sunken"
          options={visibilityOptions}
          value={visibility}
          onChange={(next) => void changeVisibility(next)}
        />
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {token ? (
          <>
            <input
              readOnly
              value={shareUrl}
              aria-label={t('share.linkLabel')}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-300 focus:border-violet-500 focus:outline-none"
            />
            <CopyButton text={shareUrl} className="px-2.5 py-1.5" />
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void revoke()}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-neutral-800 disabled:opacity-50"
            >
              {t('share.stop')}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void create()}
            className="flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            <LinkIcon className="h-3.5 w-3.5" />
            {isLoading ? t('share.loading') : t('share.create')}
          </button>
        )}
      </div>

      {token && visibility === 'AUTHORIZED' && (
        <>
          {proposals.length > 0 && (
            <div className="mt-3 border-t border-neutral-800 pt-2">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-neutral-300">
                {t('share.proposals.title')}
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[11px] text-amber-400">
                  {proposals.length}
                </span>
              </p>
              <ul className="space-y-1.5">
                {proposals.map((proposal) => (
                  <ProposalRow
                    key={proposal.id}
                    proposal={proposal}
                    currentTitle={currentTitle}
                    currentText={currentText}
                    isDeciding={decidingProposalId === proposal.id}
                    onDecide={(decision) => void decideProposal(proposal.id, decision)}
                  />
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 border-t border-neutral-800 pt-2">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-300">
              {t('share.requests.title')}
              {pendingCount > 0 && (
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[11px] text-amber-400">
                  {t('share.pending', { count: pendingCount })}
                </span>
              )}
            </p>
            <p className="mb-2 text-[11px] text-neutral-500">{t('share.role.hint')}</p>
            {isRequestsLoading && <p className="text-xs text-neutral-500">{t('share.loading')}</p>}
            {!isRequestsLoading && requests.length === 0 && (
              <p className="text-xs text-neutral-600">{t('share.requests.empty')}</p>
            )}
            <ul className="space-y-1.5">
              {requests.map((req) => (
                <li key={req.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate text-neutral-200">{req.requestingUser.name ?? req.requestingUser.email}</p>
                    <p className="truncate text-neutral-500">{req.requestingUser.email}</p>
                  </div>
                  {req.status === 'PENDING' ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <RoleSelect
                        value={pendingRoles[req.id] ?? 'VIEWER'}
                        disabled={decidingId === req.id}
                        onChange={(role) => setPendingRoles((prev) => ({ ...prev, [req.id]: role }))}
                      />
                      <button
                        type="button"
                        disabled={decidingId === req.id}
                        onClick={() => void decide(req.id, 'APPROVED', pendingRoles[req.id] ?? 'VIEWER')}
                        aria-label={t('share.approve')}
                        title={t('share.approve')}
                        className="rounded-md bg-violet-500/15 p-1 text-violet-400 hover:bg-violet-500/25 disabled:opacity-50"
                      >
                        <CheckIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={decidingId === req.id}
                        onClick={() => void decide(req.id, 'DENIED')}
                        aria-label={t('share.deny')}
                        title={t('share.deny')}
                        className="rounded-md bg-red-500/15 p-1 text-red-400 hover:bg-red-500/25 disabled:opacity-50"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : req.status === 'APPROVED' ? (
                    <RoleSelect
                      value={req.accessRole}
                      disabled={decidingId === req.id}
                      onChange={(role) => void decide(req.id, 'APPROVED', role)}
                    />
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-neutral-500">
                      <XIcon className="h-3 w-3" />
                      {t('share.denied')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
