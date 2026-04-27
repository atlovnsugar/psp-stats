import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTerm } from '../context/TermContext';
import { fetchJSON } from '../utils/dataCache';

export default function VotingList() {
  const { selectedTerm } = useTerm();
  const [votings, setVotings] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const loaderDiv = useRef(null);

  const loadPage = useCallback(async (pageNum) => {
    setLoading(true);
    try {
      const data = await fetchJSON(`/data/votings_list_page${pageNum}.json`);
      if (!data || data.length === 0) {
        setHasMore(false);
      } else {
        setVotings(prev => [...prev, ...data]);
      }
    } catch (e) {
      console.error('Chyba při načítání hlasování:', e);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset paginace a dat při změně volebního období
  useEffect(() => {
    setVotings([]);
    setPage(1);
    setHasMore(true);
    loadPage(1);
  }, [selectedTerm, loadPage]);

  // Intersection Observer pro infinite scroll
  useEffect(() => {
    if (!hasMore || loading) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1 }
    );
    if (loaderDiv.current) observer.observe(loaderDiv.current);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  // Načtení další stránky při změně page
  useEffect(() => {
    if (page === 1) return;
    loadPage(page);
  }, [page, loadPage]);

  const [filterResult, setFilterResult] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Bezpečné parsování data (podporuje YYYY-MM-DD i DD.MM.YYYY)
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    if (typeof dateStr === 'string' && dateStr.includes('.')) {
      const [d, m, y] = dateStr.split('.').map(s => s.trim());
      return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
    }
    return new Date(dateStr);
  };

  const filteredVotings = votings.filter(v => {
    // 1. Filtr podle volebního období
    const vTerm = v.term_id ?? v.term;
    if (selectedTerm && vTerm != null && String(vTerm) !== String(selectedTerm)) {
      return false;
    }

    // 2. Filtr podle výsledku
    if (filterResult && v.result !== filterResult) return false;

    // 3. Filtr podle data
    if (filterDateFrom || filterDateTo) {
      const vDate = parseDate(v.date);
      if (!vDate || isNaN(vDate.getTime())) return true; // Pokud nelze parsovat, necháme projít

      if (filterDateFrom) {
        const from = new Date(filterDateFrom);
        from.setHours(0, 0, 0, 0);
        if (vDate < from) return false;
      }
      if (filterDateTo) {
        const to = new Date(filterDateTo);
        to.setHours(23, 59, 59, 999); // Inkluzivně do konce vybraného dne
        if (vDate > to) return false;
      }
    }

    return true;
  });

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Hlasování</h1>
      <p className="text-gray-500 mb-4">Období {selectedTerm}</p>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterResult}
          onChange={e => setFilterResult(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white"
        >
          <option value="">Všechny výsledky</option>
          <option value="prijato">Přijato</option>
          <option value="zamitnuto">Zamítnuto</option>
        </select>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Od:</span>
          <input
            type="date"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm"
          />
          <span>Do:</span>
          <input
            type="date"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Název</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Výsledek</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ano/Ne/Zdrž</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredVotings.map(v => (
              <tr key={v.id} className="hover:bg-indigo-50 transition-colors">
                <td className="px-3 py-2 text-sm whitespace-nowrap text-gray-600">{v.date}</td>
                <td className="px-3 py-2 text-sm">
                  <Link to={`/hlasovani/${v.id}?term=${selectedTerm}`} className="text-indigo-600 hover:underline">
                    {v.title}
                  </Link>
                </td>
                <td className="px-3 py-2 text-sm text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    v.result === 'prijato' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {v.result === 'prijato' ? 'přijato' : 'zamítnuto'}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm text-center text-gray-500">
                  {v.vote_summary?.yes ?? 0}/{v.vote_summary?.no ?? 0}/{v.vote_summary?.abstain ?? 0}
                </td>
              </tr>
            ))}
            {filteredVotings.length === 0 && !loading && (
              <tr>
                <td colSpan="4" className="text-center py-8 text-gray-400">Žádná hlasování nevyhovují filtrům</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div ref={loaderDiv} className="py-4 text-center text-sm text-gray-500">
        {loading && 'Načítám další hlasování…'}
        {!hasMore && filteredVotings.length > 0 && 'Všechna hlasování načtena'}
      </div>
    </div>
  );
}