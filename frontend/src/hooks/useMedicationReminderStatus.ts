import { useEffect, useState } from 'react';
import { getMedicationReminderStatus } from '../api/wellbeingService';
import type { MedicationReminderSlotStatus, MedicationReminderStatus } from '../types/models';

// Estado de hoje dos lembretes de medicacao, por medicamento. Falha em
// silencio: sem dados, o cartao nao mostra a linha de estado.
export function useMedicationReminderStatus(enabled: boolean, refreshKey: unknown) {
  const [status, setStatus] = useState<MedicationReminderStatus | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getMedicationReminderStatus()
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, refreshKey]);

  const slotsFor = (medicationId: string): MedicationReminderSlotStatus[] =>
    status?.medications.find((m) => m.medicationId === medicationId)?.slots ?? [];

  return { slotsFor };
}
