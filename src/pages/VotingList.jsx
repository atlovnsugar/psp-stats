import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTerm } from '../context/TermContext';
import { fetchJSON } from '../utils/dataCache';

// Normalizace data na čistý řetězec YYYY-MM-DD (imunní vůči časovým pásmům)
const normalizeDate = (dateStr) => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (str.includes('.')) {
    const [d, m, y] = str.split('.').map(s => s.trim());
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return str.split('T')[0].split(' ')[0];
};

// Mapování UI labelů na číselná ID volebních období v JSON
const TERM_MAP = {
  '2025-now': '10',
  '2021-2025': '9',
  '2017-2021': '8',
  '2013-2017': '7',
  '2010-2013': '6',
  '2006-2010': '5',
  '2002-2006': '4',
  '1998-2002': '3',
  '1996-1998': '2',
  '1992-1996': '1'
};

const matchesTerm = (votingTerm, selectedTerm) => {
  if (!selectedTerm || selectedTerm === 'all') return true;
  if (votingTerm == null) return false;
  const vStr = String(votingTerm).trim();
  const sStr = String(selectedTerm).trim();
  if (vStr === sStr) return true;
  return vStr === (TERM_MAP[sStr] || sStr);
};

export default function VotingList() {
  const { selectedTerm } = useTerm();
  const [votings, setVotings] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const loaderDiv = useRef(null);

  const [filterResult, setFilterResult] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Čisté načtení jedné stránky (bez stavových update uvnitř smyček)
  const fetchPageData = useCallback(async (pageNum) => {
    try {
      const data = await fetchJSON(`/data/votings_list_page${pageNum}.json`);
      if (!data || data.length === 0) return [];
      return data;
    } catch (e) {
      console.error(`Chyba při načítání stránky ${pageNum}:`, e);
      return [];
    }
  }, []);

  // 🔹 SMART PRE-FETCH: Při změně období načte dávku stránek najednou.
  // Zastaví se, jakmile najde data pro vybrané období nebo dosáhne limitu.
  useEffect(() => {
    let cancelled = false;
    const loadInitialBatch = async () => {
      setLoading(true);
      setVotings([]);
      setHasMore(true);
      setPage(1);

      let accumulated = [];
      let currentPage = 1;
      const MAX_PAGES = 12;

      try {
        while (currentPage <= MAX_PAGES && !cancelled) {
          const pageData = await fetchPageData(currentPage);
          if (pageData.length === 0) {
            setHasMore(false);
            break;
          }
          accumulated.push(...pageData);

          const hasTermMatch = pageData.some(v => matchesTerm(v.term_id ?? v.term, selectedTerm));
          if (hasTermMatch) break;

          currentPage++;
        }
      } catch (e) {
        console.error('Chyba při načítání hlasování:', e);
        setHasMore(false);
      }

      if (!cancelled) {
        setVotings(accumulated);
        setPage(currentPage);
        setLoading(false);
      }
    };

    loadInitialBatch();
    return () => { cancelled = true; };
  }, [selectedTerm, fetchPageData]);

  // 🔹 Načítání dalších stránek při ručním scrollu
  useEffect(() => {
    if (page === 1) return;
    let cancelled = false;
    const loadNext = async () => {
      setLoading(true);
      const newData = await fetchPageData(page);
      if (!cancelled) {
        if (newData.length === 0) setHasMore(false);
        else setVotings(prev => [...prev, ...newData]);
        setLoading(false);
      }
    };
    loadNext();
    return () => { cancelled = true; };
  }, [page, fetchPageData]);

  // 🔹 Intersection Observer pro infinite scroll
  useEffect(() => {
    if (!hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1 }
    );
    if (loaderDiv.current) observer.observe(loaderDiv.current);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  // 🔹 Klientská filtrace (běží pouze v paměti, nezpůsobuje fetch)
  const filteredVotings = useMemo(() => {
    return votings.filter(v => {
      if (!matchesTerm(v.term_id ?? v.term, selectedTerm)) return false;
      if (filterResult && v.result !== filterResult) return false;
      const vDate = normalizeDate(v.date);
      if (filterDateFrom && vDate < filterDateFrom) return false;
      if (filterDateTo && vDate > filterDateTo) return false;
      return true;
    });
  }, [votings, selectedTerm, filterResult, filterDateFrom, filterDateTo]);

  const isSearching = filteredVotings.length === 0 && hasMore && !loading;

  return (
    <div className="p-4 max-w-6xl mx-auto text-left">
      <h1 className="text-2xl font-bold mb-2">Hlasování</h1>
      <p className="text-gray-500 mb-4">Období: {selectedTerm}</p>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterResult}
          onChange={(e) => setFilterResult(e.target.value)}
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
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm"
          />
          <span>Do:</span>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
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
            {filteredVotings.map((v) => (
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
            {filteredVotings.length === 0 && !isSearching && !loading && (
              <tr>
                <td colSpan="4" className="text-center py-8 text-gray-400">
                  Žádná hlasování nevyhovují filtrům
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div ref={loaderDiv} className="py-4 text-center text-sm text-gray-500">
        {loading && 'Načítám další hlasování…'}
        {isSearching && 'Hledám data pro vybrané období…'}
        {!hasMore && filteredVotings.length > 0 && 'Všechna hlasování načtena'}
      </div>
    </div>
  );
}