import DetailRow from '../UI/DetailRow';
import ColorDot from '../UI/ColorDot';
import type { Area, TaskTypeOption } from '../../types/models';
import GradeComponentsPanel from './GradeComponentsPanel';
import AreaInterestPicker from './AreaInterestPicker';
import AreaProposalBlock from './AreaProposalBlock';
import AreaStatusBadge from './AreaStatusBadge';
import { useI18n } from '../../i18n/useI18n';
import { useCatalogLabel } from '../../hooks/useCatalogLabel';

interface AreaDetailViewProps {
  area: Area;
  taskTypes: TaskTypeOption[];
  onPropose: (area: Area) => void;
  onWithdraw: (area: Area) => void;
}

export default function AreaDetailView({ area, taskTypes, onPropose, onWithdraw }: AreaDetailViewProps) {
  const { t } = useI18n();
  const { optionLabel } = useCatalogLabel();
  const associatedType = optionLabel('taskType', area.defaultTaskType, taskTypes);

  return (
    <div className="-mt-2">
      <DetailRow label={t('ui.areaName')}>{area.name}</DetailRow>
      <DetailRow label={t('ui.visibility')}>
        <AreaStatusBadge area={area} />
      </DetailRow>
      <DetailRow label={t('ui.associatedColor')}>
        <div className="flex items-center gap-3">
          <ColorDot color={area.colorHex} variant="square" size="md" />
          <span className="text-neutral-200 font-mono text-sm uppercase tracking-widest">
            {area.colorHex}
          </span>
        </div>
      </DetailRow>
      <DetailRow label={t('ui.associatedType')}>
        {associatedType ?? <span className="text-neutral-500 italic">{t('ui.noneAskedEveryTime')}</span>}
      </DetailRow>
      <DetailRow label={t('ui.credits')}>
        {area.credits ?? <span className="text-neutral-500 italic">{t('ui.notSet')}</span>}
      </DetailRow>
      <GradeComponentsPanel area={area} />
      <AreaInterestPicker area={area} />
      <AreaProposalBlock area={area} onPropose={onPropose} onWithdraw={onWithdraw} />
    </div>
  );
}
