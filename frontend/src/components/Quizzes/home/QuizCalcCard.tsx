import Button from '../../UI/Button';
import Card from '../../UI/Card';
import ToggleChip from '../../UI/ToggleChip';
import { useI18n } from '../../../i18n/useI18n';
import type { QuizQuestion } from '../../../lib/quizFormat';
import { CALC_SIZES, makeGenerated } from '../../../lib/quizPlay';
import { GENERATOR_KINDS, type GeneratorKind } from '../../../lib/quizGenerators';
import type { QuizMode } from '../../../lib/quizSession';
import type { QuizHomeState } from './useQuizHome';

interface QuizCalcCardProps {
  home: QuizHomeState;
  // Geradores de calculo ligados neste quiz (perguntas feitas pela app).
  generators: GeneratorKind[];
  onStart: (mode: QuizMode, questions: QuizQuestion[]) => void;
}

export default function QuizCalcCard({ home, generators, onStart }: QuizCalcCardProps) {
  const { t } = useI18n();
  return (
    <Card>
      <h2 className="font-semibold text-white">{t('quizzes.calc.title')}</h2>
      <p className="mt-1 text-sm text-neutral-400">{home.hasGenerators ? t('quizzes.calc.help') : t('quizzes.calc.empty')}</p>
      {home.hasGenerators && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {generators.map((kind) => (
              <ToggleChip
                key={kind}
                size="sm"
                pressed={home.calcChosen.includes(kind)}
                title={t(`quizGen.${kind}.desc`)}
                onClick={() => home.toggleCalcKind(kind)}
              >
                {t(`quizGen.${kind}.name`)}
              </ToggleChip>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {CALC_SIZES.map((n) => (
              <ToggleChip key={n} size="sm" pressed={home.calcSize === n} onClick={() => home.setCalcSize(n)}>
                {n}
              </ToggleChip>
            ))}
          </div>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => onStart(
            'practice',
            makeGenerated(home.calcChosen.length ? home.calcChosen : generators, home.calcSize, t),
          )}
          >
            {t('quizzes.calc.start', { count: home.calcSize })}
          </Button>
        </>
      )}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-violet-300">{t('quizzes.calc.manage')}</summary>
        <p className="mt-2 text-xs text-neutral-400">{t('quizzes.calc.manageHelp')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {GENERATOR_KINDS.map((kind) => (
            <ToggleChip key={kind} size="sm" pressed={generators.includes(kind)} title={t(`quizGen.${kind}.desc`)} onClick={() => home.toggleGenerator(kind)}>
              {t(`quizGen.${kind}.name`)}
            </ToggleChip>
          ))}
        </div>
      </details>
    </Card>
  );
}
