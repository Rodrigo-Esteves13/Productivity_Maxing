import { useEffect, useState } from 'react';
import { getAppeals, resolveAppeal } from '../api/userService';
import type { AppealAdmin, AppealResolution } from '../types/models';

// Admin-only (ver AppealsPanel.tsx, usado em Users.tsx). Mostra sempre só
// os pendentes - resolvidos deixam de interessar ao fluxo de trabalho do
// dia-a-dia, e o backend já suporta ?status=all se algum dia isso mudar.
export function useAppeals() {
  const [appeals, setAppeals] = useState<AppealAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchAppeals = async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await getAppeals('pending');
      setAppeals(data);
    } catch {
      setError('Error loading appeals.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppeals();
  }, []);

  const handleResolve = async (
    id: string,
    resolution: AppealResolution,
    resolutionNote?: string,
  ) => {
    setResolvingId(id);
    try {
      await resolveAppeal(id, resolution, resolutionNote);
      // Resolvido deixa de ser "pendente" - remove da lista local em vez
      // de refazer o fetch, evita um round-trip extra.
      setAppeals((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setResolvingId(null);
    }
  };

  return { appeals, isLoading, error, resolvingId, handleResolve, refetch: fetchAppeals };
}
