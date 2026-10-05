import { useActiveStudySession } from '../../../context/useActiveStudySession';
import { requestNotifyPermission } from '../../../lib/focusAlerts';
import { MAX_FOCUS_MINUTES, MIN_FOCUS_MINUTES, normalizePlan } from '../../../lib/focusTimer';
import { toDateKey } from '../../../lib/dateKey';
import { formatClock } from '../../../lib/timeFormat';
import { todayUtcAnchored } from '../../../lib/weekDates';
import type { StudyPlanResult, StudyPlanSuggestion } from '../../../types/models';
import Button from '../../UI/Button';
import EmptyState from '../../UI/EmptyState';
import ErrorState from '../../UI/ErrorState';
import LoadingState from '../../UI/LoadingState';

const DEFAULT_BREAK_MINUTES = 5;
const MINUTES_PER_DAY = 24 * 60;

interface TodayBlocksProps {
  plan: StudyPlanResult | null;
  isLoading: boolean;
  error: string;
}

function blockMinutes(block: StudyPlanSuggestion): number {
  return block.endMinutes - block.startMinutes;
}

// Os blocos que o plano de estudo reservou para hoje, com "Start" que abre
// uma sessao ja ligada a task e com o tempo do bloco.
export default function TodayBlocks({ plan, isLoading, error }: TodayBlocksProps) {
  const { activeSession, isSubmitting, start } = useActiveStudySession();

  const today = toDateKey(todayUtcAnchored());
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const blocks = (plan?.suggestions ?? [])
    .filter((block) => block.date === today)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const handleStart = async (block: StudyPlanSuggestion) => {
    requestNotifyPermission();
    const minutes = Math.min(Math.max(blockMinutes(block), MIN_FOCUS_MINUTES), MAX_FOCUS_MINUTES);
    await start({ taskId: block.taskId }, normalizePlan(minutes, DEFAULT_BREAK_MINUTES));
  };

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-white mb-1">Study blocks for today</h2>
      <p className="mb-4 text-xs text-neutral-500">From your study plan. Start one and the timer matches its length.</p>

      {isLoading && <LoadingState message="Loading today's blocks..." />}
      {!isLoading && error && <ErrorState message={error} />}
      {!isLoading && !error && blocks.length === 0 && (
        <EmptyState message="No study blocks planned for today." />
      )}

      {!isLoading && !error && blocks.length > 0 && (
        <ol className="flex flex-col gap-2">
          {blocks.map((block) => {
            const isPast = block.endMinutes <= nowMinutes && block.endMinutes < MINUTES_PER_DAY;
            const isRunning = activeSession?.taskId === block.taskId;
            return (
              <li
                key={`${block.taskId}-${block.startMinutes}`}
                className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-neutral-800 p-3 ${isPast ? 'opacity-60' : ''}`}
              >
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate text-sm font-medium text-white">{block.taskTitle}</p>
                  <p className="text-xs text-neutral-500">
                    {formatClock(block.startMinutes)}-{formatClock(block.endMinutes)} ({blockMinutes(block)} min)
                    {block.isOvertime && <span className="ml-2 text-amber-400">overtime</span>}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  className="px-3 py-1.5 text-sm"
                  disabled={isSubmitting || activeSession !== null}
                  onClick={() => void handleStart(block)}
                >
                  {isRunning ? 'Running' : 'Start'}
                </Button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
