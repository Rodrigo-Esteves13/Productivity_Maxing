import ProgramSelector from './ProgramSelector';
import PeriodSelector from './PeriodSelector';
import ArchivePeriodButton from './ArchivePeriodButton';
import RestorePeriodButton from './RestorePeriodButton';

// [ Program v ]  [ Period v ]  Archive/Restore period - always in this
// order, always visible.
export default function AcademicSelectors() {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <ProgramSelector />
      <PeriodSelector />
      <ArchivePeriodButton />
      <RestorePeriodButton />
    </div>
  );
}
