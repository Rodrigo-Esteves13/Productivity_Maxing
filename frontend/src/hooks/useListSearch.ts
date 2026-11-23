import { useDeferredValue, useMemo, useState } from 'react';
import { filterByQuery } from '../lib/listFilter';

// Estado de pesquisa para uma lista local: o valor do campo atualiza ja, o
// filtro corre com o valor diferido (nao trava a escrita em listas grandes).
export function useListSearch<T>(
  items: readonly T[],
  getFields: (item: T) => ReadonlyArray<string | null | undefined>,
) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(
    () => filterByQuery(items, deferredQuery, getFields),
    // getFields e normalmente uma funcao inline: so os dados e a pesquisa decidem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, deferredQuery],
  );
  return {
    query,
    setQuery,
    filtered,
    isFiltering: deferredQuery.trim().length > 0,
    clear: () => setQuery(''),
  };
}
