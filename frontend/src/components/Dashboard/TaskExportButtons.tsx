import type { Area, AcademicTaskTypeOption, Task } from '../../types/models';
import { tasksToCsv, tasksToMarkdown } from '../../utils/taskExportFormats';
import { downloadTextFile } from '../../utils/downloadTextFile';
import { DownloadIcon } from '../UI/Icons';

interface TaskExportButtonsProps {
  tasks: Task[];
  areas: Area[];
  academicTaskTypes: AcademicTaskTypeOption[];
}

// Exports exactly what's currently visible in the filtered dashboard table,
// not the full unfiltered task list - matches the principle of least
// surprise (the export mirrors what's on screen when the button is
// clicked). Purely client-side: no new backend endpoint needed, the tasks
// are already loaded for the table itself.
export default function TaskExportButtons({ tasks, areas, academicTaskTypes }: TaskExportButtonsProps) {
  const dateStr = new Date().toISOString().split('T')[0];

  const handleExportCsv = () => {
    const csv = tasksToCsv(tasks, areas, academicTaskTypes);
    downloadTextFile(csv, `pmaxing_tasks_${dateStr}.csv`, 'text/csv;charset=utf-8');
  };

  const handleExportMarkdown = () => {
    const markdown = tasksToMarkdown(tasks, areas, academicTaskTypes);
    downloadTextFile(markdown, `pmaxing_tasks_${dateStr}.md`, 'text/markdown;charset=utf-8');
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleExportCsv}
        disabled={tasks.length === 0}
        title={tasks.length === 0 ? 'No tasks to export' : 'Export the tasks currently shown as CSV'}
        className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 disabled:opacity-40 disabled:hover:text-neutral-400"
      >
        <DownloadIcon />
        CSV
      </button>
      <button
        type="button"
        onClick={handleExportMarkdown}
        disabled={tasks.length === 0}
        title={tasks.length === 0 ? 'No tasks to export' : 'Export the tasks currently shown as Markdown'}
        className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 disabled:opacity-40 disabled:hover:text-neutral-400"
      >
        <DownloadIcon />
        Markdown
      </button>
    </div>
  );
}
