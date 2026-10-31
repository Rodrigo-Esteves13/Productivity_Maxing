import { useCallback, useEffect, useState } from 'react';
import { clearAreaTeacher, getAreaTeachers, setAreaTeacher } from '../api/areaTeachersService';

// Nome do docente (nota privada) de uma cadeira.
export function useAreaTeacher(areaId: string) {
  const [teacherName, setTeacherName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAreaTeachers()
      .then((rows) => {
        if (!cancelled) setTeacherName(rows.find((row) => row.areaId === areaId)?.teacherName ?? '');
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [areaId]);

  // Texto vazio apaga a nota.
  const save = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      setIsSaving(true);
      setError(false);
      try {
        if (trimmed === '') await clearAreaTeacher(areaId);
        else await setAreaTeacher(areaId, trimmed);
        setTeacherName(trimmed);
        return true;
      } catch {
        setError(true);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [areaId],
  );

  return { teacherName, isLoading, isSaving, error, save };
}
