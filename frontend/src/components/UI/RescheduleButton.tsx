import React from 'react';

interface RescheduleButtonProps {
  isLoading: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export default function RescheduleButton({ isLoading, onClick }: RescheduleButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      title="Reschedule for tomorrow"
      className="mt-1 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-violet-400 hover:text-violet-300 hover:bg-violet-900/30 border border-transparent hover:border-violet-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? 'Rescheduling...' : '+1 Day'}
    </button>
  );
}