import { createContext, useContext, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const TermContext = createContext();
const DEFAULT_TERM = '2025-now';

export function TermProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTerm = searchParams.get('term') || DEFAULT_TERM;

  // Zajistit, že term je v URL vždy
  useEffect(() => {
    if (!searchParams.get('term')) {
      setSearchParams({ term: DEFAULT_TERM }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const setTerm = useCallback((termId) => {
    setSearchParams({ term: termId }, { replace: true });
  }, [setSearchParams]);

  return (
    <TermContext.Provider value={{ selectedTerm, setTerm }}>
      {children}
    </TermContext.Provider>
  );
}

export function useTerm() {
  const context = useContext(TermContext);
  if (!context) throw new Error('useTerm must be used within TermProvider');
  return context;
}