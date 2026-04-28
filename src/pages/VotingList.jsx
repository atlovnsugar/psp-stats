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

  // Filtry
  const [filterResult, setFilterResult] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Pomocná funkce pro převod data z JSONu (DD.MM.YYYY) na porovnatelný objekt Date
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr.includes('.')) {
      const [d, m, y] = dateStr.split('.');
      return new Date(y, m - 1, d);
    }
    return new Date(dateStr); // Pro případ, že by v JSONu byl ISO formát
  };

  const loadPage = useCallback(async (pageNum, term) => {
    if (!term) return;
    setLoading(true);
    try {
      // OPRAVA 1: Cesta k datům nyní dynamicky reflektuje vybrané období
      // Předpokládám strukturu /data/term[číslo]/votings_list_page[strana].json
      const data = await fetchJSON(`/data/term${term}/votings_list_page${pageNum}.json`);
      
      if (!data || data.length === 0) {
        setHasMore(false);
      } else {
        // Pokud načítáme první stránku nového období, nahradíme stará data (prev => data)
        setVotings(prev => pageNum === 1 ? data : [...prev, ...data]);
      }
    } catch (e) {
      console.error("Chyba při načítání dat:", e);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Efekt pro reset při změně volebního období (selectedTerm)
  useEffect(() => {
    setVotings([]);
    setPage(1);
    setHasMore(true);
    loadPage(1, selectedTerm);
  }, [selectedTerm, loadPage]);

  // Infinite scroll
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

  // Načtení další stránky při inkrementaci 'page'
  useEffect(() => {
    if (page > 1) {
      loadPage(page, selectedTerm);
    }
  }, [page, selectedTerm, loadPage]);

  // OPRAVA 2: Logika filtrování s korektním porovnáváním dat
  const filteredVotings = votings.filter(v => {
    if (filterResult && v.result !== filterResult) return false;
    
    const vDate = parseDate(v.date);
    if (!vDate) return true;

    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      fromDate.setHours(0, 0, 0, 0);
      if (vDate < fromDate) return false;
    }
    
    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      if (vDate > toDate) return false;
    }
    
    return true;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Hlasování</h1>
      <p className="text-sm text-gray-500 mb-4">Období {selectedTerm}</p>

      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filterResult} onChange={e => setFilterResult(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white">
          <option value="">Všechny výsledky</option>
          <option value="prijato">Přijato</option>
          <option value="zamitnuto">Zamítnuto</option>
        </select>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Od:</span>
          <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                 className="border border-gray-300 rounded-md px-2 py-1 text-sm" />
          <span>Do:</span>
          <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                 className="border border-gray-300 rounded-md px-2 py-1 text-sm" />
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
                  {v.vote_summary.yes}/{v.vote_summary.no}/{v.vote_summary.abstain}
                </td>
              </tr>
            ))}
            {filteredVotings.length === 0 && !loading && (
              <tr><td colSpan="4" className="text-center py-8 text-gray-400">Žádná hlasování nevyhovují</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div ref={loaderDiv} className="py-4 text-center text-sm text-gray-500">
        {loading && 'Načítám další hlasování…'}
        {!hasMore && 'Všechna hlasování načtena'}
      </div>
    </div>
  );
}