import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 border-b border-neutral-800 pb-5">
      <div>
        <h1 className="text-2xl font-bold leading-7 text-white sm:text-3xl sm:tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-neutral-400">{description}</p>
        )}
      </div>
      {action && (
        <div className="mt-4 sm:ml-4 sm:mt-0">
          {action}
        </div>
      )}
    </div>
  );
}