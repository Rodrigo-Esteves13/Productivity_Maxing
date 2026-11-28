import { useEffect, useRef, useState } from 'react';
import { searchNotebook } from '../api/notebookService';
import type { NotebookSearchResult } from '../types/models';

// Debounce simples da pesquisa - evita um pedido por tecla premida.
const SEARCH_DEBOUNCE_MS = 300;

// Pesquisa global do caderno, com o atalho "/".
export function useNotebookSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // "/" foca a pesquisa (como no GitHub/YouTube), se nao estiveres a escrever.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  const [searchResults, setSearchResults] = useState<NotebookSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  // Sobe para repetir a pesquisa depois de um erro (botao "Tentar de novo").
  const [searchAttempt, setSearchAttempt] = useState(0);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchFailed(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    setSearchFailed(false);
    const timeout = setTimeout(() => {
      searchNotebook(trimmed)
        .then((results) => {
          if (!cancelled) setSearchResults(results);
        })
        .catch(() => {
          if (cancelled) return;
          setSearchResults([]);
          setSearchFailed(true);
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [searchQuery, searchAttempt]);

  return {
    searchQuery,
    setSearchQuery,
    searchInputRef,
    searchResults,
    isSearching,
    searchFailed,
    retrySearch: () => setSearchAttempt((n) => n + 1),
    isSearchActive: searchQuery.trim().length > 0,
  };
}
