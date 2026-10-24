import ProgramSelector from './ProgramSelector';
import PeriodSelector from './PeriodSelector';
import ArchivePeriodButton from './ArchivePeriodButton';
import RestorePeriodButton from './RestorePeriodButton';

// [ Program v ]  [ Period v ]  Archive/Restore period - always in this
// order, always visible. The period dropdown and its actions wrap as one
// group, so "Archive period" never ends up alone on its own line.
export default function AcademicSelectors() {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <ProgramSelector />
      <div className="flex flex-wrap items-center gap-3">
        <PeriodSelector />
        <ArchivePeriodButton />
        <RestorePeriodButton />
      </div>
    </div>
  );
}
