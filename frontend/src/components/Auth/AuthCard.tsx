import type { ReactNode } from 'react';

interface AuthCardProps {
  title: string;
  children: ReactNode;
}

export default function AuthCard({ title, children }: AuthCardProps) {
  return (
    <div className="max-w-md mx-auto mt-20 bg-neutral-900/50 p-8 border border-neutral-800 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">{title}</h2>
      {children}
    </div>
  );
}
