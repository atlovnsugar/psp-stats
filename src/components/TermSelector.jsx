import { useEffect, useState } from 'react';
import { useTerm } from '../context/TermContext';
import { fetchJSON } from '../utils/dataCache';

export default function TermSelector() {
  const { selectedTerm, setTerm } = useTerm();
  const [terms, setTerms] = useState([]);

  useEffect(() => {
    fetchJSON('/data/terms.json').then(setTerms).catch(console.error);
  }, []);

  return (
    <select value={selectedTerm} onChange={e => setTerm(e.target.value)}>
      {terms.map(t => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  );
}