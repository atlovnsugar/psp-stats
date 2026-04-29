import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTerm } from '../context/TermContext';
import { fetchJSON } from '../utils/dataCache';

export default function VotingList() {
  const { selectedTerm } = useTerm();
  
  // Stavy pro data
  const [votings, setVotings] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Stavy pro filtry a paginaci
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [filterResult, setFilterResult] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // 1. Postupné načítání všech dat pro dané období
  useEffect(() => {
    let isActive = true;

    const fetchAllData = async () => {
      setLoading(true);
      let pageNum = 1;
      let accumulated = [];

      while (isActive) {
        try {
          const url = `/data/votings_list_${selectedTerm}_p${pageNum}.json`;
          const data = await fetchJSON(url);
          
          if (!data || data.length === 0) {
            break; // Narazili jsme na konec dat
          }

          accumulated = [...accumulated, ...data];
          
          if (isActive) {
            setVotings(accumulated); // Okamžitý update UI po každém souboru
          }
          
          pageNum++;
        } catch (e) {
          // Očekávaná chyba (404), když už nejsou další _pX.json soubory
          break;
        }
      }
      
      if (isActive) {
        setLoading(false);
      }
    };

    // Reset před načítáním nového období
    setVotings([]);
    setPage(1);
    fetchAllData();

    // Úklid, pokud uživatel přepne období dřív, než se vše načte
    return () => {
      isActive = false;
    };
  }, [selectedTerm]);

  // 2. Reset stránky na první, když se změní jakýkoliv filtr
  useEffect(() => {
    setPage(1);
  }, [filterResult, filterDateFrom, filterDateTo, itemsPerPage]);

  // 3. Filtrace (probíhá nad všemi dosud načtenými daty)
  const filteredVotings = votings.filter(v => {
    if (filterResult && v.result !== filterResult) return false;
    if (filterDateFrom && v.date < filterDateFrom) return false;
    if (filterDateTo && v.date > filterDateTo) return false;
    return true;
  });

  // 4. Výpočet paginace
  const totalItems = filteredVotings.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (page - 1) * itemsPerPage;
  const currentVotings = filteredVotings.slice(startIndex, startIndex + itemsPerPage);

  // Zajištění, abychom nebyli na neexistující stránce
  if (page > totalPages && totalPages > 0) {
    setPage(totalPages);
  }

  // UI Komponenta pro navigaci (aby se kód neopakoval)
  const PaginationControls = () => (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3">
      <div className="text-sm text-gray-500">
        Zobrazeno <span className="font-medium text-gray-900">{totalItems === 0 ? 0 : startIndex + 1}</span> až{' '}
        <span className="font-medium text-gray-900">{Math.min(startIndex + itemsPerPage, totalItems)}</span> z{' '}
        <span className="font-medium text-gray-900">{totalItems}</span> výsledků
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0 }); }}
          disabled={page === 1}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
        >
          Předchozí
        </button>
        <div className="text-sm font-medium text-gray-700 px-2">
          {page} / {totalPages}
        </div>
        <button
          onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0 }); }}
          disabled={page === totalPages}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
        >
          Další
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Hlasování</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-500 font-medium">Období: {selectedTerm}</span>
            {loading && (
              <span className="inline-flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium animate-pulse">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Načítám archiv...
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500 font-medium">Položek na stránku:</label>
          <select 
            value={itemsPerPage} 
            onChange={e => setItemsPerPage(Number(e.target.value))}
            className="border-gray-300 rounded-md text-sm py-1.5 pl-3 pr-8 focus:border-indigo-500 focus:ring-indigo-500 shadow-sm"
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>

      {/* Ovládací panel filtrů */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1 w-full sm:w-auto flex-1 min-w-[200px]">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Výsledek hlasování</label>
          <select 
            value={filterResult} 
            onChange={e => setFilterResult(e.target.value)}
            className="w-full border-gray-300 rounded-md shadow-sm text-sm py-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Všechny výsledky</option>
            <option value="prijato">Přijato</option>
            <option value="zamitnuto">Zamítnuto</option>
          </select>
        </div>
        
        <div className="flex flex-col gap-1 w-full sm:w-auto">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Datum od</label>
          <input 
            type="date" 
            value={filterDateFrom} 
            onChange={e => setFilterDateFrom(e.target.value)}
            className="w-full border-gray-300 rounded-md shadow-sm text-sm py-2 focus:ring-indigo-500 focus:border-indigo-500" 
          />
        </div>

        <div className="flex flex-col gap-1 w-full sm:w-auto">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Datum do</label>
          <input 
            type="date" 
            value={filterDateTo} 
            onChange={e => setFilterDateTo(e.target.value)}
            className="w-full border-gray-300 rounded-md shadow-sm text-sm py-2 focus:ring-indigo-500 focus:border-indigo-500" 
          />
        </div>
        
        {/* Resetovací tlačítko filtrů (zobrazí se jen když jsou aktivní) */}
        {(filterResult || filterDateFrom || filterDateTo) && (
          <button 
            onClick={() => { setFilterResult(''); setFilterDateFrom(''); setFilterDateTo(''); }}
            className="text-sm text-indigo-600 font-medium hover:text-indigo-800 py-2 px-2 transition-colors"
          >
            Smazat filtry
          </button>
        )}
      </div>

      <PaginationControls />

      {/* Tabulka */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/80">
              <tr>
                <th scope="col" className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Datum</th>
                <th scope="col" className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Název hlasování</th>
                <th scope="col" className="px-5 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Výsledek</th>
                <th scope="col" className="px-5 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">Ano / Ne / Zdrž</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {currentVotings.map(v => (
                <tr key={v.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-5 py-3.5 text-sm whitespace-nowrap text-gray-600 font-medium">{v.date}</td>
                  <td className="px-5 py-3.5 text-sm">
                    <Link to={`/hlasovani/${v.id}?term=${selectedTerm}`} className="text-indigo-600 hover:text-indigo-900 font-medium hover:underline">
                      {v.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-center">
                    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide w-full max-w-[90px] ${
                      v.result === 'prijato' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {v.result === 'prijato' ? 'Přijato' : 'Zamítnuto'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-center font-medium">
                    <span className="text-emerald-600">{v.vote_summary.yes}</span>
                    <span className="mx-1 text-gray-300">/</span>
                    <span className="text-rose-600">{v.vote_summary.no}</span>
                    <span className="mx-1 text-gray-300">/</span>
                    <span className="text-gray-400">{v.vote_summary.abstain}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stavová hlášení */}
        {currentVotings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            {loading ? (
              <p className="text-gray-500 text-sm">Zatím nebyly načteny záznamy odpovídající filtrům. Pokračuji v hledání...</p>
            ) : (
              <>
                <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Žádné výsledky</h3>
                <p className="text-gray-500 text-sm">Zkuste upravit filtry nebo zvolit širší časové období.</p>
              </>
            )}
          </div>
        )}
      </div>

      {totalItems > 0 && <PaginationControls />}
    </div>
  );
}