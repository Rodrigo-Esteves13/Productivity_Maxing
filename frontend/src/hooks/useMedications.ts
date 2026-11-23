import { useCallback, useEffect, useState } from 'react';
import {
  acceptMedicationDisclaimer,
  createMedication,
  createMedicationIntake,
  deleteMedication,
  deleteMedicationIntake,
  getMedicationDay,
  getMedicationDisclaimer,
  getMedicationIntakes,
  getMedications,
  setMedicationDose,
  updateMedication,
  updateMedicationIntake,
  type MedicationIntakeChanges,
} from '../api/wellbeingService';
import { toDateKey } from '../lib/dateKey';
import { useLisbonToday } from './useLisbonToday';
import { MS_PER_DAY } from '../lib/timeConstants';
import type {
  Medication,
  MedicationDaySlot,
  MedicationDisclaimerStatus,
  MedicationInput,
  MedicationIntake,
  MedicationIntakeInput,
} from '../types/models';

// Tomas "se necessario" mostradas no cartao: os ultimos 7 dias; "ver mais"
// alarga de 30 em 30 dias ate ao maximo que o backend aceita num pedido
// (MAX_INTAKE_RANGE_DAYS = 62, a janela inclui o dia de hoje).
const RECENT_INTAKE_DAYS = 7;
const INTAKE_DAYS_STEP = 30;
export const MAX_INTAKE_RANGE_DAYS = 61;
// Igual a MAX_INTAKE_PAST_DAYS do backend: ate quantos dias atras se pode
// marcar uma toma esquecida.
export const MAX_DOSE_PAST_DAYS = 30;

// Medicamentos do utilizador, checklist das tomas de hoje, tomas "se
// necessario" recentes e o estado do aviso legal.
export function useMedications() {
  // Dia de Lisboa (o do backend), atualizado a meia-noite e ao voltar a app.
  // Quando muda, `load` muda e o efeito abaixo volta a carregar (D-05).
  const today = useLisbonToday();
  // 0 = hoje, 1 = ontem... Para marcar uma toma que ficou por registar.
  const [dayOffset, setDayOffset] = useState(0);
  const dayKey = dayOffset === 0 ? today : toDateKey(new Date(Date.parse(today) - dayOffset * MS_PER_DAY));
  const [medications, setMedications] = useState<Medication[]>([]);
  const [slots, setSlots] = useState<MedicationDaySlot[]>([]);
  const [intakes, setIntakes] = useState<MedicationIntake[]>([]);
  const [disclaimer, setDisclaimer] = useState<MedicationDisclaimerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  // A gravacao correu bem mas a recarga seguinte falhou: mantem os dados que ja
  // estavam no ecra e avisa, em vez de trocar o cartao por um erro (U-B20).
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [intakeDays, setIntakeDays] = useState(RECENT_INTAKE_DAYS);
  const [isSaving, setIsSaving] = useState(false);
  // Sobe a cada alteracao gravada: os outros cartoes (historico, correlacoes)
  // usam-no como chave para voltar a buscar sem refresh da pagina.
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((n) => n + 1), []);

  // Vai buscar tudo e aplica; lanca se falhar (quem chama decide o que mostrar).
  const fetchAll = useCallback(async () => {
    const from = toDateKey(new Date(Date.parse(today) - (intakeDays - 1) * MS_PER_DAY));
    const [list, day, recent, notice] = await Promise.all([
      getMedications(),
      getMedicationDay(dayKey),
      getMedicationIntakes(from, today),
      getMedicationDisclaimer(),
    ]);
    setDisclaimer(notice);
    setMedications(list);
    setSlots(day);
    setIntakes(recent);
    setError(false);
    setRefreshFailed(false);
  }, [today, dayKey, intakeDays]);

  const load = useCallback(async () => {
    try {
      await fetchAll();
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [fetchAll]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      setIsSaving(true);
      try {
        await action();
      } catch {
        setIsSaving(false);
        return false;
      }
      // A escrita ja funcionou: se so a recarga falhar, nao e um erro de gravar.
      try {
        await fetchAll();
      } catch {
        setRefreshFailed(true);
      }
      bump();
      setIsSaving(false);
      return true;
    },
    [fetchAll, bump],
  );

  // Otimista: o visto muda logo, volta atras se o pedido falhar.
  const toggleDose = useCallback(
    async (slot: MedicationDaySlot): Promise<boolean> => {
      const flip = (taken: boolean) =>
        setSlots((prev) =>
          prev.map((s) =>
            s.medicationId === slot.medicationId && s.slotMinutes === slot.slotMinutes ? { ...s, taken } : s,
          ),
        );
      flip(!slot.taken);
      try {
        await setMedicationDose(slot.medicationId, { date: dayKey, slotMinutes: slot.slotMinutes, taken: !slot.taken });
        bump();
        return true;
      } catch {
        flip(slot.taken);
        return false;
      }
    },
    [dayKey, bump],
  );

  return {
    version,
    dayOffset,
    dayKey,
    setDayOffset: (offset: number) => setDayOffset(Math.min(MAX_DOSE_PAST_DAYS, Math.max(0, offset))),
    medications,
    slots,
    intakes,
    disclaimer,
    isLoading,
    error,
    refreshFailed,
    isSaving,
    reload: load,
    // Alarga a lista de tomas avulso; false quando ja nao ha mais para mostrar.
    canShowMoreIntakes: intakeDays < MAX_INTAKE_RANGE_DAYS,
    showMoreIntakes: () => setIntakeDays((d) => Math.min(MAX_INTAKE_RANGE_DAYS, d + INTAKE_DAYS_STEP)),
    intakeDays,
    editIntake: (id: string, changes: MedicationIntakeChanges) => run(() => updateMedicationIntake(id, changes)),
    toggleDose,
    add: (input: MedicationInput) => run(() => createMedication(input)),
    update: (id: string, changes: Partial<MedicationInput> & { active?: boolean }) =>
      run(() => updateMedication(id, changes)),
    remove: (id: string) => run(() => deleteMedication(id)),
    logIntake: (input: MedicationIntakeInput) => run(() => createMedicationIntake(input)),
    removeIntake: (id: string) => run(() => deleteMedicationIntake(id)),
    // So chamado depois de o utilizador marcar as duas caixas (aviso e maioridade).
    acceptDisclaimer: (version: number, locale: string) => run(() => acceptMedicationDisclaimer(version, locale)),
  };
}
