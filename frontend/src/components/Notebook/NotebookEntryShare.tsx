import { useState } from 'react';
import type { UseEntryShareResult } from '../../hooks/useEntryShare';
import type { NotebookShareVisibility, ShareAccessRole } from '../../types/models';
import { LinkIcon, XIcon } from '../UI/Icons';
import IconButton from '../UI/IconButton';
import SegmentedControl from '../UI/SegmentedControl';
import type { SegmentedOption } from '../UI/SegmentedControl';
import { useI18n } from '../../i18n/useI18n';
import NotebookEntryInvite from './NotebookEntryInvite';
import ProposalRow from './share/ProposalRow';
import ShareLinkRow from './share/ShareLinkRow';
import ShareVisits from './share/ShareVisits';
import ShareRequestList from './share/ShareRequestList';

interface NotebookEntryShareProps {
  share: UseEntryShareResult;
  // Titulo/notas atuais do rascunho, para mostrar o que cada proposta muda.
  currentTitle: string;
  currentText: string;
}

// Apresentacional: o estado vive em useEntryShare (chamado no wrapper do
// editor) para o painel sobreviver a trocar entre leitura e edicao.
// Partilhar nao depende de estar em modo edicao nem de gravar nada, e uma
// acao a parte sobre a entrada ja guardada.
export default function NotebookEntryShare({ share, currentTitle, currentText }: NotebookEntryShareProps) {
  const { t } = useI18n();
  const {
    isOpen, token, visibility, isLoading, error, pendingCount, proposals, decidingProposalId,
    open, close, changeVisibility, decideProposal,
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

      <ShareLinkRow share={share} />

      {token && <ShareVisits share={share} />}

      {token && visibility === 'PUBLIC' && (
        <p className="mt-3 border-t border-neutral-800 pt-2 text-[11px] text-neutral-500">
          {t('share.invite.needsAuthorized')}
        </p>
      )}

      {/* Pedidos/propostas que ficaram pendentes antes de passar a Publico
          continuam aqui para se poderem decidir (senao o badge "waiting"
          nunca limpava). Convidar continua so em Autorizado. */}
      {token && (visibility === 'AUTHORIZED' || pendingCount > 0 || proposals.length > 0) && (
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

          {visibility === 'AUTHORIZED' && <NotebookEntryInvite share={share} />}

          <ShareRequestList
            share={share}
            pendingRoles={pendingRoles}
            onPendingRoleChange={(requestId, role) => setPendingRoles((prev) => ({ ...prev, [requestId]: role }))}
          />
        </>
      )}
    </div>
  );
}
