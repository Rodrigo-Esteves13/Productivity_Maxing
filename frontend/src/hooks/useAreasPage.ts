import { useCallback, useEffect, useState } from 'react';
import {
  getUserAreas,
  createArea,
  createOfficialArea,
  deleteArea,
  updateArea,
  getTaskMetadata,
  proposeArea,
  withdrawAreaProposal,
  getAreaProposals,
  setAreaHidden,
  setAllOfficialAreasHidden,
  approveAreaProposal,
  rejectAreaProposal,
} from '../api/userService';
import type { Area, AreaProposal, TaskTypeOption } from '../types/models';
import type { AreaFormValues } from '../components/Areas/AreaForm';
import { useFeedback } from '../context/useFeedback';
import { useAuth } from '../context/useAuth';
import { translateNow } from '../i18n/translate';

export type CreateMode = 'personal' | 'official';

function errorMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (typeof msg === 'string') return msg;
  if (Array.isArray(msg) && typeof msg[0] === 'string') return msg[0];
  return fallback;
}

export function useAreasPage() {
  const { notify, confirm } = useFeedback();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [areas, setAreas] = useState<Area[]>([]);
  const [proposals, setProposals] = useState<AreaProposal[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskTypeOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // null = modal de criação fechado.
  const [createMode, setCreateMode] = useState<CreateMode | null>(null);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setIsLoading(true);
      const [areasData, meta, proposalsData] = await Promise.all([
        getUserAreas(undefined, true),
        getTaskMetadata(),
        isAdmin ? getAreaProposals() : Promise.resolve([] as AreaProposal[]),
      ]);
      setAreas(areasData);
      setTaskTypes(meta.taskTypes);
      setProposals(proposalsData);
    } catch {
      setError(translateNow('hook.errorLoadingAreas'));
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Pode editar/apagar: a própria área pessoal, ou (admin) uma oficial.
  const canManage = (area: Area) => area.isMine || (isAdmin && area.isOfficial);
  // Uma área à espera de revisão fica congelada (o backend também recusa).
  const canEdit = (area: Area) => canManage(area) && area.proposalStatus !== 'PENDING';

  const replaceArea = (updated: Area) => {
    setAreas((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
    setSelectedArea((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
  };

  const openDetailModal = (area: Area) => {
    setSelectedArea(area);
    setIsEditing(false);
  };
  const startEditing = (area: Area) => {
    if (!canEdit(area)) {
      notify(translateNow('hook.withdrawTheProposalFirstToEdit'), 'info');
      return;
    }
    setSelectedArea(area);
    setIsEditing(true);
  };
  const closeDetailModal = () => {
    setSelectedArea(null);
    setIsEditing(false);
  };

  const handleCreateArea = async (values: AreaFormValues) => {
    if (!createMode) return;
    setIsSubmitting(true);
    try {
      const created =
        createMode === 'official' ? await createOfficialArea(values) : await createArea(values);
      setAreas((prev) => [...prev, created]);
      setCreateMode(null);
    } catch (err) {
      notify(errorMessage(err, translateNow('hook.errorCreatingArea')), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditArea = async (values: AreaFormValues) => {
    if (!selectedArea) return;
    setIsSubmitting(true);
    try {
      replaceArea(await updateArea(selectedArea.id, values));
      setIsEditing(false);
    } catch (err) {
      notify(errorMessage(err, translateNow('hook.errorSavingChanges')), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteArea = async (id: string) => {
    const confirmed = await confirm({
      title: translateNow('hook.deleteArea'),
      message: translateNow('hook.areYouSureAnAreaWith'),
      confirmLabel: translateNow('hook.delete'),
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteArea(id);
      setAreas((prev) => prev.filter((a) => a.id !== id));
      if (selectedArea?.id === id) closeDetailModal();
    } catch (err) {
      notify(errorMessage(err, translateNow('hook.errorDeletingArea')), 'error');
    }
  };

  const handleToggleHidden = async (area: Area) => {
    const hidden = !area.isHidden;
    // Otimista; volta atrás se o pedido falhar.
    setAreas((prev) => prev.map((a) => (a.id === area.id ? { ...a, isHidden: hidden } : a)));
    try {
      await setAreaHidden(area.id, hidden);
    } catch (err) {
      setAreas((prev) => prev.map((a) => (a.id === area.id ? { ...a, isHidden: !hidden } : a)));
      notify(errorMessage(err, translateNow('hook.couldNotChangeThisArea')), 'error');
    }
  };

  const handleToggleAllOfficial = async (hidden: boolean) => {
    const previous = areas;
    setAreas((prev) => prev.map((a) => (a.isOfficial ? { ...a, isHidden: hidden } : a)));
    try {
      await setAllOfficialAreasHidden(hidden);
    } catch (err) {
      setAreas(previous);
      notify(errorMessage(err, translateNow('hook.couldNotChangeTheOfficialAreas')), 'error');
    }
  };

  const handlePropose = async (area: Area) => {
    const confirmed = await confirm({
      title: translateNow('hook.proposeAsOfficial'),
      message: translateNow('hook.proposeAreaMessage', { name: area.name }),
      confirmLabel: translateNow('hook.propose'),
    });
    if (!confirmed) return;
    try {
      replaceArea(await proposeArea(area.id));
      notify(translateNow('hook.proposalSent'), 'success');
    } catch (err) {
      notify(errorMessage(err, translateNow('hook.couldNotSendTheProposal')), 'error');
    }
  };

  const handleWithdraw = async (area: Area) => {
    try {
      replaceArea(await withdrawAreaProposal(area.id));
    } catch (err) {
      notify(errorMessage(err, translateNow('hook.couldNotWithdrawTheProposal')), 'error');
    }
  };

  const handleApprove = async (proposal: AreaProposal) => {
    try {
      await approveAreaProposal(proposal.id);
      setProposals((prev) => prev.filter((p) => p.id !== proposal.id));
      notify(translateNow('hook.areaNowOfficial', { name: proposal.name }), 'success');
    } catch (err) {
      notify(errorMessage(err, translateNow('hook.couldNotApprove')), 'error');
    }
  };

  const handleReject = async (proposal: AreaProposal, note: string) => {
    try {
      await rejectAreaProposal(proposal.id, note);
      setProposals((prev) => prev.filter((p) => p.id !== proposal.id));
    } catch (err) {
      notify(errorMessage(err, translateNow('hook.couldNotReject')), 'error');
    }
  };

  return {
    isAdmin,
    areas,
    proposals,
    taskTypes,
    isLoading,
    error,
    createMode,
    selectedArea,
    isEditing,
    isSubmitting,
    canManage,
    canEdit,
    openCreateModal: (mode: CreateMode) => setCreateMode(mode),
    closeCreateModal: () => setCreateMode(null),
    openDetailModal,
    startEditing,
    stopEditing: () => setIsEditing(false),
    closeDetailModal,
    handleCreateArea,
    handleEditArea,
    handleDeleteArea,
    handleToggleHidden,
    handleToggleAllOfficial,
    handlePropose,
    handleWithdraw,
    handleApprove,
    handleReject,
  };
}
