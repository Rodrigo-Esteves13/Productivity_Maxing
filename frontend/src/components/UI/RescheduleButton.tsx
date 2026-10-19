import React from 'react';
import { useI18n } from '../../i18n/useI18n';

interface RescheduleButtonProps {
  isLoading: boolean;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}

export default function RescheduleButton({ isLoading, onClick, className = '' }: RescheduleButtonProps) {
  const { t } = useI18n();
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      title={t('common.rescheduleTomorrow')}
      className={`inline-flex items-center leading-none px-1.5 py-0.5 rounded text-[10px] uppercase font-bold text-violet-400 hover:text-violet-300 hover:bg-violet-900/30 border border-transparent hover:border-violet-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0 ${className}`}
    >
      {isLoading ? t('ui.rescheduling') : '+1 Day'}
    </button>
  );
}