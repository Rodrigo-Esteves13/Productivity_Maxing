import { useEffect, useState } from 'react';
import { getCourseForecast } from '../api/studyPlanService';
import type { CourseForecast } from '../types/models';

export function useCourseForecast() {
  const [courses, setCourses] = useState<CourseForecast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCourseForecast()
      .then((data) => {
        if (!cancelled) setCourses(data);
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
  }, []);

  return { courses, isLoading, error };
}
