import { useState } from 'react';
import Input from '../UI/Input';
import Button from '../UI/Button';
import FormField from '../UI/FormField';
import ColorDot from '../UI/ColorDot';
import LoadingState from '../UI/LoadingState';
import { getTodayPlan } from '../../api/studyService';
import type { TodayPlanResponse } from '../../types/models';

export default function TodayPlan() {
  const [availableMinutes, setAvailableMinutes] = useState(120);
  const [plan, setPlan] = useState<TodayPlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await getTodayPlan(availableMinutes);
      setPlan(result);
    } catch {
      setError('Could not generate a plan right now.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
      <p className="text-sm font-medium text-neutral-200 mb-1">Today's plan</p>
      <p className="text-xs text-neutral-500 mb-4">
        Tell it how much free time you actually have - it distributes that time across your
        pending tasks by urgency (deadline, weight, difficulty).
      </p>

      <div className="flex items-end gap-3">
        <FormField label="Available minutes today" htmlFor="today-plan-minutes" className="flex-1">
          <Input
            id="today-plan-minutes"
            type="number"
            min={15}
            step={15}
            value={availableMinutes}
            onChange={(e) => setAvailableMinutes(Number(e.target.value))}
          />
        </FormField>
        <Button onClick={handleGenerate} disabled={isLoading} className="px-5 py-2.5">
          {isLoading ? 'Generating...' : 'Generate'}
        </Button>
      </div>

      {isLoading && <LoadingState message="Sorting out priorities..." className="h-24 mt-4" />}
      {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

      {plan && !isLoading && (
        <div className="mt-5 space-y-2">
          {plan.blocks.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Nothing to plan - either no pending tasks, or not enough time to fit even one block.
            </p>
          ) : (
            plan.blocks.map((block, index) => (
              <div
                key={block.taskId}
                className="flex items-center justify-between bg-neutral-950/50 border border-neutral-800 rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-600 w-5">{index + 1}.</span>
                  <ColorDot color={block.areaColorHex} />
                  <div>
                    <div className="text-sm font-medium text-neutral-200">{block.title}</div>
                    <div className="text-xs text-neutral-500">
                      {block.areaName} {block.isOverdue && <span className="text-red-400">- Overdue</span>}
                    </div>
                  </div>
                </div>
                <span className="text-sm font-semibold text-violet-400 whitespace-nowrap">
                  {block.estimatedMinutes} min
                </span>
              </div>
            ))
          )}

          {plan.unallocatedMinutes > 0 && plan.blocks.length > 0 && (
            <p className="text-xs text-neutral-600 pt-2">
              {plan.unallocatedMinutes} min left unallocated (not enough for another full block).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
