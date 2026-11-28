import { useCallback, useEffect, useRef, useState } from 'react';
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
  restoreMedicationIntake,
  setMedicationDose,
  updateMedication,
  updateMedicationIntake,
  type MedicationIntakeChanges,
} from '../api/wellbeingService';
import { toDateKey } from '../lib/dateKey';
import {
  ALL_MEDICATION_PARTS,
  MEDICATION_DATA_PARTS,
  MEDICATION_RELOAD,
  mergeParts,
  type MedicationPart,
} from '../lib/medicationReload';
import { intakeWindows, MAX_INTAKE_HISTORY_DAYS } from '../lib/intakeWindows';
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
// alarga de 30 em 30 dias ate um ano (um pedido por janela, ver intakeWindows).
const RECENT_INTAKE_DAYS = 7;
const INTAKE_DAYS_STEP = 30;
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
  const hasDisclaimerRef = useRef(false);
  const staleRef = useRef<MedicationPart[]>([]);

  // Vai buscar as partes pedidas e aplica-as de uma vez; lanca se alguma
  // falhar (quem chama decide o que mostrar).
  const fetchParts = useCallback(
    async (parts: readonly MedicationPart[]) => {
      const pick = <T,>(part: MedicationPart, fetch: () => Promise<T>) =>
        parts.includes(part) ? fetch() : Promise.resolve(undefined);
      const [list, day, recent, notice] = await Promise.all([
        pick('medications', () => getMedications()),
        pick('day', () => getMedicationDay(dayKey)),
        pick('intakes', async () => {
          const windows = intakeWindows(today, intakeDays);
          // Da janela mais recente para a mais antiga: a lista fica por ordem.
          const pages = await Promise.all(windows.map(({ from, to }) => getMedicationIntakes(from, to)));
          return pages.flat();
        }),
        pick('disclaimer', () => getMedicationDisclaimer()),
      ]);
      if (notice !== undefined) {
        setDisclaimer(notice);
        hasDisclaimerRef.current = true;
      }
      if (list !== undefined) setMedications(list);
      if (day !== undefined) setSlots(day);
      if (recent !== undefined) setIntakes(recent);
      staleRef.current = staleRef.current.filter((part) => !parts.includes(part));
      setError(false);
      if (staleRef.current.length === 0) setRefreshFailed(false);
    },
    [today, dayKey, intakeDays],
  );

  const load = useCallback(
    async (parts: readonly MedicationPart[]) => {
      try {
        await fetchParts(parts);
      } catch {
        setError(true);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchParts],
  );

  // Ao montar vai tudo; ao mudar de dia (ou de intervalo de tomas) o aviso
  // legal, que ja veio, nao se pede outra vez.
  useEffect(() => {
    void load(hasDisclaimerRef.current ? MEDICATION_DATA_PARTS : ALL_MEDICATION_PARTS);
  }, [load]);

  const reload = useCallback(() => load(ALL_MEDICATION_PARTS), [load]);

  const run = useCallback(
    async (action: () => Promise<unknown>, parts: readonly MedicationPart[]): Promise<boolean> => {
      setIsSaving(true);
      try {
        await action();
      } catch {
        setIsSaving(false);
        return false;
      }
      // A escrita ja funcionou: se so a recarga falhar, nao e um erro de gravar.
      // O que ficou por atualizar de uma vez anterior vai junto.
      const wanted = mergeParts(parts, staleRef.current);
      try {
        await fetchParts(wanted);
      } catch {
        staleRef.current = wanted;
        setRefreshFailed(true);
      }
      bump();
      setIsSaving(false);
      return true;
    },
    [fetchParts, bump],
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
    reload,
    // Alarga a lista de tomas avulso; false quando ja nao ha mais para mostrar.
    canShowMoreIntakes: intakeDays < MAX_INTAKE_HISTORY_DAYS,
    showMoreIntakes: () => setIntakeDays((d) => Math.min(MAX_INTAKE_HISTORY_DAYS, d + INTAKE_DAYS_STEP)),
    intakeDays,
    editIntake: (id: string, changes: MedicationIntakeChanges) =>
      run(() => updateMedicationIntake(id, changes), MEDICATION_RELOAD.intake),
    toggleDose,
    add: (input: MedicationInput) => run(() => createMedication(input), MEDICATION_RELOAD.add),
    update: (id: string, changes: Partial<MedicationInput> & { active?: boolean }) =>
      run(
        () => updateMedication(id, changes),
        changes.name === undefined ? MEDICATION_RELOAD.update : MEDICATION_RELOAD.rename,
      ),
    remove: (id: string) => run(() => deleteMedication(id), MEDICATION_RELOAD.remove),
    logIntake: (input: MedicationIntakeInput) => run(() => createMedicationIntake(input), MEDICATION_RELOAD.intake),
    removeIntake: (id: string) => run(() => deleteMedicationIntake(id), MEDICATION_RELOAD.intake),
    restoreIntake: (intake: MedicationIntake) =>
      run(
        () =>
          restoreMedicationIntake({
            medicationId: intake.medicationId,
            takenAt: intake.takenAt,
            dose: intake.dose ?? undefined,
            note: intake.note ?? undefined,
          }),
        MEDICATION_RELOAD.intake,
      ),
    // So chamado depois de o utilizador marcar as duas caixas (aviso e maioridade).
    acceptDisclaimer: (version: number, locale: string) =>
      run(() => acceptMedicationDisclaimer(version, locale), MEDICATION_RELOAD.disclaimer),
  };
}
