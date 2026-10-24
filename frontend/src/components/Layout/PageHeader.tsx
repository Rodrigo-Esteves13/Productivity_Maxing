import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8 border-b border-neutral-800 pb-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl sm:tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-neutral-400">{description}</p>
        )}
      </div>
      {action && (
        <div className="min-w-0 lg:ml-4">
          {action}
        </div>
      )}
    </div>
  );
}