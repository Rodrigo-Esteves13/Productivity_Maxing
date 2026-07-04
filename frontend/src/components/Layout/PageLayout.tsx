import type { ReactNode } from 'react';
import { Navbar } from '../Navbar';
import { Footer } from '../Footer';

interface PageLayoutProps {
  children: ReactNode;
}

export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      <Navbar />
      {/* O container principal que alinha tudo ao centro e dá margens */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}