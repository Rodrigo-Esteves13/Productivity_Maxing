import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../UI/Button';
import Select from '../UI/Select';
import EmptyState from '../UI/EmptyState';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import IconButton from '../UI/IconButton';
import { XIcon } from '../UI/Icons';
import ConfirmActionDialog from './ConfirmActionDialog';
import {
  getTurmaPrograms,
  importTurmaProgram,
  removeTurmaProgram,
  shareTurmaProgram,
  type TurmaProgram,
} from '../../api/turmasService';
import { getPrograms } from '../../api/academicService';
import { useLoadOnce } from '../../hooks/useLoadOnce';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { useFeedback } from '../../context/useFeedback';
import { useAuth } from '../../context/useAuth';
import { useI18n } from '../../i18n/useI18n';

interface TurmaProgramsTabProps {
  turmaId: string;
  isDelegado: boolean;
}

// Licenciatura da turma: quem ja montou o Grades com os semestres todos
// partilha uma copia (sem notas) e os colegas importam-na com um clique.
export default function TurmaProgramsTab({ turmaId, isDelegado }: TurmaProgramsTabProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { notify } = useFeedback();
  const fetcher = useCallback(() => getTurmaPrograms(turmaId), [turmaId]);
  const { data, isLoading, error, reload } = useLoadOnce(fetcher);
  const { data: myPrograms } = useLoadOnce(getPrograms);
  const [programId, setProgramId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const confirm = useConfirmAction(t('turma.actionError'));

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
    } catch {
      notify(t('turma.actionError'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const share = () =>
    run('share', async () => {
      await shareTurmaProgram(turmaId, programId);
      setProgramId('');
      reload();
    });

  const requestImport = (program: TurmaProgram) =>
    confirm.request({
      title: t('turma.programs.import'),
      message: t('turma.programs.importConfirm', { name: program.name }),
      confirmLabel: t('turma.programs.import'),
      tone: 'default',
      run: async () => {
        const result = await importTurmaProgram(turmaId, program.id);
        notify(t('turma.programs.imported', { periods: result.periods, courses: result.courses }), 'success');
      },
    });

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
        {myPrograms && myPrograms.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1">
              <Select label={t('turma.programs.shareLabel')} value={programId} onChange={(e) => setProgramId(e.target.value)}>
                <option value="">{t('turma.programs.pick')}</option>
                {myPrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="button" disabled={!programId || busy !== null} onClick={() => void share()}>
              {t('turma.programs.share')}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-neutral-300">
            {t('turma.programs.noPrograms')}{' '}
            <Link to="/report-card" className="font-medium text-violet-400 hover:text-violet-300">
              {t('turma.programs.openGrades')}
            </Link>
          </p>
        )}
        <p className="text-xs text-neutral-400">{t('turma.programs.hint')}</p>
      </div>

      {isLoading ? (
        <LinesSkeleton lines={3} />
      ) : error ? (
        <ErrorState message={t('turma.loadError')} />
      ) : !data || data.length === 0 ? (
        <EmptyState message={t('turma.programs.none')} />
      ) : (
        <ul className="space-y-3">
          {data.map((program) => {
            const courses = program.snapshot.periods.reduce((n, p) => n + p.courses.length, 0);
            return (
              <li key={program.id} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">{program.name}</p>
                    <p className="text-xs text-neutral-500">
                      {t('turma.programs.summary', {
                        periods: program.snapshot.periods.length,
                        courses,
                        name: program.sharedByName ?? t('social.anonymous'),
                      })}
                    </p>
                  </div>
                  <Button type="button" disabled={busy !== null} onClick={() => requestImport(program)}>
                    {t('turma.programs.import')}
                  </Button>
                  {(isDelegado || program.sharedById === user?.id) && (
                    <IconButton
                      label={t('turma.programs.remove')}
                      tone="danger"
                      onClick={() => void run(program.id, async () => {
                        await removeTurmaProgram(turmaId, program.id);
                        reload();
                      })}
                    >
                      <XIcon className="h-4 w-4" />
                    </IconButton>
                  )}
                </div>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-violet-400 hover:text-violet-300">
                    {t('turma.programs.seeCourses')}
                  </summary>
                  <div className="mt-2 space-y-2">
                    {program.snapshot.periods.map((period) => (
                      <div key={period.name + period.startDate}>
                        <p className="text-xs font-semibold text-neutral-300">{period.name}</p>
                        <p className="text-xs text-neutral-500">
                          {period.courses.map((c) => c.name).join(' · ') || t('turma.programs.noCourses')}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmActionDialog state={confirm} />
    </div>
  );
}
