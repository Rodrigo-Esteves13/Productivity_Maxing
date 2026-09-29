// src/lib/formatDuration.ts

// Shared by StudySessionWidget.tsx (Focus page) and GlobalStudyTimer.tsx
// (the mini timer visible on every page) - both render the exact same
// "elapsed since start" clock, so there's no reason to keep two copies
// in sync by hand.
export function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}
