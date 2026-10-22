import { useCallback, useEffect, useState } from 'react';
import {
  createMedication,
  deleteMedication,
  getMedicationDay,
  getMedications,
  setMedicationDose,
  updateMedication,
} from '../api/wellbeingService';
import { todayKey } from '../lib/dateKey';
import type { Medication, MedicationDaySlot, MedicationInput } from '../types/models';

// Medicamentos do utilizador + checklist das tomas de hoje.
export function useMedications() {
  const [today] = useState(todayKey);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [slots, setSlots] = useState<MedicationDaySlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, day] = await Promise.all([getMedications(), getMedicationDay(today)]);
      setMedications(list);
      setSlots(day);
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
    isLoading,
    error,
    isSaving,
    reload: load,
    toggleDose,
    add: (input: MedicationInput) => run(() => createMedication(input)),
    update: (id: string, changes: Partial<MedicationInput> & { active?: boolean }) =>
      run(() => updateMedication(id, changes)),
    remove: (id: string) => run(() => deleteMedication(id)),
  };
}
