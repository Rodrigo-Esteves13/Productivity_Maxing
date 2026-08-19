import FormField from '../../UI/FormField';
import Input from '../../UI/Input';
import { ClockIcon } from '../../UI/Icons';
import type { DurationPrediction } from '../../../api/predictionService';

interface GradingFieldsProps {
  idPrefix: string;
  targetGrade: string;
  weightPercentage: string;
  estimatedMinutes: string;
  onTargetGradeChange: (value: string) => void;
  onWeightPercentageChange: (value: string) => void;
  onEstimatedMinutesChange: (value: string) => void;
  prediction?: DurationPrediction | null;
  isPredictionLoading?: boolean;
}

function formatMethodLabel(method: DurationPrediction['method']): string {
  switch (method) {
    case 'mlp':
      return 'neural net';
    case 'linear_regression':
      return 'linear regression';
    default:
      return '';
  }
}

// Alvo e peso não são exclusivos de tasks académicas (ver comentário
// "Avaliação (Relevante para contexto Académico/Trabalho)" no schema.prisma)
// - por isso este bloco fica sempre visível, ao contrário do seletor de
// Academic Type em AcademicFields.tsx, que é mesmo só para esse contexto.
export default function GradingFields({
  idPrefix,
  targetGrade,
  weightPercentage,
  estimatedMinutes,
  onTargetGradeChange,
  onWeightPercentageChange,
  onEstimatedMinutesChange,
  prediction,
  isPredictionLoading = false,
}: GradingFieldsProps) {
  const hasSuggestion =
    !!prediction && prediction.method !== 'insufficient_data' && prediction.predictedMinutes != null;

  return (
    <div className="space-y-3 pt-4 border-t border-neutral-800">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Target Grade" htmlFor={`${idPrefix}-target-grade`}>
          <Input
            id={`${idPrefix}-target-grade`}
            type="number"
            min="0"
            max="20"
            step="0.1"
            value={targetGrade}
            onChange={(e) => onTargetGradeChange(e.target.value)}
            className="w-full"
          />
        </FormField>
        <FormField label="Weight (%)" htmlFor={`${idPrefix}-weight`}>
          <Input
            id={`${idPrefix}-weight`}
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={weightPercentage}
            onChange={(e) => onWeightPercentageChange(e.target.value)}
            className="w-full"
          />
        </FormField>
      </div>

      <FormField label="Estimated Duration (minutes)" htmlFor={`${idPrefix}-estimated-minutes`}>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={`${idPrefix}-estimated-minutes`}
            type="number"
            min="0"
            step="5"
            value={estimatedMinutes}
            onChange={(e) => onEstimatedMinutesChange(e.target.value)}
            className="w-32"
          />
          {isPredictionLoading && <span className="text-xs text-neutral-600">Estimating...</span>}
          {!isPredictionLoading && hasSuggestion && (
            <button
              type="button"
              onClick={() => onEstimatedMinutesChange(String(prediction!.predictedMinutes))}
              className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 border border-violet-900 hover:border-violet-700 rounded-md px-2 py-1 transition-colors"
              title={`Based on ${prediction!.sampleSize} of your past tasks, via ${formatMethodLabel(prediction!.method)}`}
            >
              <ClockIcon className="w-3.5 h-3.5" />
              Suggested: {prediction!.predictedMinutes} min
            </button>
          )}
        </div>
        {!isPredictionLoading && prediction?.method === 'insufficient_data' && (
          <p className="text-xs text-neutral-600 mt-1">
            Not enough completed tasks with logged study time yet for a suggestion ({prediction.sampleSize}/10).
          </p>
        )}
      </FormField>
    </div>
  );
}
