import ToolbarButton from '../UI/ToolbarButton';
import { PrinterIcon, UploadIcon, SlidersIcon, GraduationCapIcon, TargetIcon, EyeIcon } from '../UI/Icons';
import TaskExportButtons from './TaskExportButtons';
import { DashboardWidgetToggles } from './DashboardWidgetToggles';
import type { DashboardPageState } from '../../hooks/useDashboardPage';
import { useI18n } from '../../i18n/useI18n';

interface DashboardToolbarProps {
  page: DashboardPageState;
  onImport: () => void;
}

// Botoes do topo do Dashboard: import/export, modos e preferencias.
export default function DashboardToolbar({ page, onImport }: DashboardToolbarProps) {
  const { t } = useI18n();
  const { density, toggleDensity } = page.tableDensity;

  return (
    <div className="print-hide flex flex-wrap items-center gap-x-1 gap-y-2">
      <ToolbarButton tone="muted" size="md" onClick={onImport}>
        <UploadIcon />
        {t('ui.import')}
      </ToolbarButton>
      {/* Exportar e imprimir levam as tasks no ecra: bloqueados enquanto
          ainda sao as do periodo anterior. */}
      <div className="contents" inert={page.isStale}>
        <TaskExportButtons
          tasks={page.filteredTasks}
          areas={page.academicAreas}
          academicTaskTypes={page.academicTaskTypes}
        />
        <ToolbarButton tone="muted" size="md" onClick={() => window.print()}>
          <PrinterIcon />
          {t('ui.print')}
        </ToolbarButton>
      </div>
      <ToolbarButton
        tone="muted"
        size="md"
        pressed={page.isExamMode}
        onClick={() => page.setIsExamMode((prev) => !prev)}
        title={t('examMode.toggleHelp')}
      >
        <GraduationCapIcon />
        {t('examMode.toggle')}
      </ToolbarButton>
      <ToolbarButton
        tone="muted"
        size="md"
        pressed={page.isSingleTaskMode}
        onClick={() => page.setIsSingleTaskMode((prev) => !prev)}
        title={t('singleTaskMode.toggleHelp')}
      >
        <EyeIcon />
        {t('singleTaskMode.toggle')}
      </ToolbarButton>
      <ToolbarButton
        tone="muted"
        size="md"
        pressed={page.isPlanMode}
        onClick={() => page.setIsPlanMode((prev) => !prev)}
        title={t('planMode.toggleHelp')}
      >
        <TargetIcon />
        {t('planMode.toggle')}
      </ToolbarButton>
      <ToolbarButton tone="muted" size="md" onClick={toggleDensity} title={t('ui.toggleTableRowDensity')}>
        <SlidersIcon />
        {density === 'compact' ? t('ui.comfortable') : t('ui.compact')}
      </ToolbarButton>
      {page.archivedCount > 0 && (
        <label className="flex pointer-coarse:min-h-11 items-center gap-1.5 text-sm text-neutral-400 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={page.showArchived}
            onChange={page.toggleShowArchived}
            className="accent-violet-500"
          />
          {t('ui.showArchivedCount', { count: page.archivedCount })}
        </label>
      )}
      <DashboardWidgetToggles
        visibility={page.widgets.visibility}
        toggle={page.widgets.toggle}
        orderControls={page.widgetOrder}
      />
    </div>
  );
}
