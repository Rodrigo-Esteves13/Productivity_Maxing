import { useEffect, useState } from 'react';
import { getTimeByArea, type AreaTimeBreakdown } from '../../api/studySessionsService';
import { ClockIcon } from '../UI/Icons';
import ProgressBar from '../UI/ProgressBar';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import ColorDot from '../UI/ColorDot';
import { formatDuration } from '../../lib/timeFormat';

// "Where does my study time actually go" - a horizontal breakdown of all
// finished Focus sessions by Area, all-time. Complements AreaBreakdownCard
// (which is about grades) and StudyActivityCard (which is about daily
// consistency) - this one is specifically about where the hours land.
export default function TimeByAreaCard() {
  const [rows, setRows] = useState<AreaTimeBreakdown[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTimeByArea()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => console.error('Failed to load time by area:', err))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) return null;
  if (rows.length === 0) return null;

  const maxMinutes = Math.max(...rows.map((r) => r.totalMinutes));

  return (
    <DashboardCard>
      <CardHeading className="mb-3">
        <ClockIcon className="shrink-0" />
        Time by course
      </CardHeading>
      <ul className="space-y-2.5">
        {rows.slice(0, 8).map((row) => (
          <li key={row.areaId ?? 'none'} className="text-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <ColorDot size="xs" color={row.areaColorHex ?? '#525252'} />
                <span className="truncate text-neutral-200">{row.areaName}</span>
              </div>
              <span className="text-xs text-neutral-500 shrink-0">
                {formatDuration(row.totalMinutes)}
              </span>
            </div>
            <ProgressBar
              percent={maxMinutes > 0 ? (row.totalMinutes / maxMinutes) * 100 : 0}
              fillColor={row.areaColorHex ?? undefined}
            />
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
