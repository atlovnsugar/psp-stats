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
      // OPRAVA 1: Zahrnutí selectedTerm do URL. 
      // POZNÁMKA: Tuto URL uprav podle toho, jak máš soubory reálně pojmenované.
      // Pokud máš např. složky podle období: `/data/${selectedTerm}/votings_list_page${pageNum}.json`
      // Pokud máš název v souboru: `/data/votings_list_${selectedTerm}_page${pageNum}.json`
      const data = await fetchJSON(`/data/${selectedTerm}/votings_list_page${pageNum}.json`);
      
      if (data.length === 0) {
        setHasMore(false);
      } else {
        setVotings(prev => [...prev, ...data]);
      }
    } catch (e) {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [selectedTerm]); // OPRAVA 1: Přidáno selectedTerm do závislostí!

  // Resetování seznamu a stránkování při změně volebního období
  useEffect(() => {
    setVotings([]);
    setPage(1);
    setHasMore(true);
    // Nevoláme loadPage(1) přímo zde, odchytí to useEffect pro změnu 'page' níže,
    // ale pokud chceme instantní načtení:
    loadPage(1);
  }, [selectedTerm, loadPage]);

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

  useEffect(() => {
    if (page === 1) return;
    loadPage(page);
  }, [page, loadPage]);

  const [filterResult, setFilterResult] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // OPRAVA 2: Bezpečnější filtrování pomocí Date objektů
  const filteredVotings = votings.filter(v => {
    if (filterResult && v.result !== filterResult) return false;

    if (filterDateFrom || filterDateTo) {
      // Předpoklad: v.date v JSONu je v rozumném formátu (ISO, "YYYY-MM-DD", atd.)
      // Pokud je v JSONu cokoliv jako "15. 3. 1996", je nutné string nejprve rozdělit a poskládat
      const itemDate = new Date(v.date);

      if (filterDateFrom) {
        const fromDate = new Date(filterDateFrom);
        if (itemDate < fromDate) return false;
      }

      if (filterDateTo) {
        const toDate = new Date(filterDateTo);
        // Posuneme čas na konec daného dne, aby filtr bral i hlasování v tento den
        toDate.setHours(23, 59, 59, 999);
        if (itemDate > toDate) return false;
      }
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