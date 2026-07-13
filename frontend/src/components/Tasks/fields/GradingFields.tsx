import FormField from '../../UI/FormField';
import Input from '../../UI/Input';

interface GradingFieldsProps {
  idPrefix: string;
  targetGrade: string;
  weightPercentage: string;
  onTargetGradeChange: (value: string) => void;
  onWeightPercentageChange: (value: string) => void;
}

// Alvo e peso não são exclusivos de tasks académicas (ver comentário
// "Avaliação (Relevante para contexto Académico/Trabalho)" no schema.prisma)
// - por isso este bloco fica sempre visível, ao contrário do seletor de
// Academic Type em AcademicFields.tsx, que é mesmo só para esse contexto.
export default function GradingFields({
  idPrefix,
  targetGrade,
  weightPercentage,
  onTargetGradeChange,
  onWeightPercentageChange,
}: GradingFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-800">
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
  );
}
