import { useEffect } from 'react';
import { getTaskMetadata, getUserTasks } from '../../api/userService';
import { useAuth } from '../../context/useAuth';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';
import { badgeLabelKey, computeBadges, earnedIds, newlyEarned, readEarnedBadgeIds, rememberBestStreak, saveEarnedBadgeIds } from '../../lib/badges';
import { TASK_COMPLETED_EVENT } from '../../lib/completionFeedback';
import { readStreakRestMode } from '../../hooks/useStreakRestPref';
import { computeProfileStats, extractProjectTypeKeys } from '../../utils/profileStats';

// Espera pelo fim da gravacao da conclusao antes de reler as tasks.
const REFRESH_DELAY_MS = 1500;

// Sem UI: quando uma task e concluida, volta a calcular as conquistas e avisa
// das novas. A base de comparacao fica em localStorage (semeada na pagina
// Profile ou na primeira conclusao, sem avisar de conquistas antigas).
export default function BadgeUnlockWatcher() {
  const { user } = useAuth();
  const { notify } = useFeedback();
  const { t } = useI18n();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return undefined;
    let timer: number | null = null;
    let cancelled = false;

    const refresh = async () => {
      try {
        const [tasks, meta] = await Promise.all([getUserTasks(), getTaskMetadata()]);
        if (cancelled) return;
        const stats = computeProfileStats(tasks, extractProjectTypeKeys(meta.taskTypes), readStreakRestMode());
        const badges = computeBadges({
          completed: stats.completed,
          streak: rememberBestStreak(stats.streak),
          projects: stats.projects,
        });
        const fresh = newlyEarned(readEarnedBadgeIds(), badges);
        saveEarnedBadgeIds(earnedIds(badges));
        for (const badge of fresh) {
          notify(t('badges.unlocked', { name: t(badgeLabelKey(badge), { target: badge.target }) }), 'success');
        }
      } catch {
        // Aviso opcional: se falhar, a proxima conclusao tenta outra vez.
      }
    };

    const onCompleted = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void refresh(), REFRESH_DELAY_MS);
    };
    window.addEventListener(TASK_COMPLETED_EVENT, onCompleted);
    return () => {
      cancelled = true;
      window.removeEventListener(TASK_COMPLETED_EVENT, onCompleted);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [userId, notify, t]);

  return null;
}
