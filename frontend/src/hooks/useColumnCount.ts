import { useEffect, useState } from 'react';

// Mesmo breakpoint `lg` do Tailwind, que é onde o Dashboard passa a 2 colunas.
const TWO_COLUMN_QUERY = '(min-width: 1024px)';

export function useColumnCount(): 1 | 2 {
  const [isWide, setIsWide] = useState(
    () => window.matchMedia(TWO_COLUMN_QUERY).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(TWO_COLUMN_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsWide(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return isWide ? 2 : 1;
}
