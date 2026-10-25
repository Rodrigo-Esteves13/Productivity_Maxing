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

// Tomas "se necessario" mostradas no cartao: os ultimos 7 dias.
const RECENT_INTAKE_DAYS = 7;

// Medicamentos do utilizador, checklist das tomas de hoje, tomas "se
// necessario" recentes e o estado do aviso legal.
export function useMedications() {
  // Dia de Lisboa (o do backend), atualizado a meia-noite e ao voltar a app.
  // Quando muda, `load` muda e o efeito abaixo volta a carregar (D-05).
  const today = useLisbonToday();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [slots, setSlots] = useState<MedicationDaySlot[]>([]);
  const [intakes, setIntakes] = useState<MedicationIntake[]>([]);
  const [disclaimer, setDisclaimer] = useState<MedicationDisclaimerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const from = toDateKey(new Date(Date.parse(today) - (RECENT_INTAKE_DAYS - 1) * MS_PER_DAY));
      const [list, day, recent, notice] = await Promise.all([
        getMedications(),
        getMedicationDay(today),
        getMedicationIntakes(from, today),
        getMedicationDisclaimer(),
      ]);
      setDisclaimer(notice);
      setMedications(list);
      setSlots(day);
      setIntakes(recent);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      setIsSaving(true);
      try {
        await action();
        await load();
        return true;
      } catch {
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [load],
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
        await setMedicationDose(slot.medicationId, { date: today, slotMinutes: slot.slotMinutes, taken: !slot.taken });
        return true;
      } catch {
        flip(slot.taken);
        return false;
      }
    },
    [today],
  );

  return {
    medications,
    slots,
    intakes,
    disclaimer,
    isLoading,
    error,
    isSaving,
    reload: load,
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
