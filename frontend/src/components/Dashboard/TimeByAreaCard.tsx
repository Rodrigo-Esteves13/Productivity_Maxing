import { useEffect, useState } from 'react';
import { getTimeByArea, type AreaTimeBreakdown } from '../../api/studySessionsService';
import { ClockIcon } from '../UI/Icons';

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

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
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 shadow-xl">
      <p className="text-xs uppercase tracking-wide text-neutral-500 mb-3 flex items-center gap-1.5">
        <ClockIcon className="shrink-0" />
        Time by course
      </p>
      <ul className="space-y-2.5">
        {rows.slice(0, 8).map((row) => (
          <li key={row.areaId ?? 'none'} className="text-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: row.areaColorHex ?? '#525252' }}
                />
                <span className="truncate text-neutral-200">{row.areaName}</span>
              </div>
              <span className="text-xs text-neutral-500 shrink-0">
                {formatMinutes(row.totalMinutes)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{
                  width: `${maxMinutes > 0 ? (row.totalMinutes / maxMinutes) * 100 : 0}%`,
                  backgroundColor: row.areaColorHex ?? undefined,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
