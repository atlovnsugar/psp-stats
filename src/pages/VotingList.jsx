import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTerm } from '../context/TermContext';
import { fetchJSON } from '../utils/dataCache';

export default function VotingList() {
  const { selectedTerm } = useTerm();
  
  // Stavy pro data
  const [votings, setVotings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  
  // Stavy pro navigaci
  const [currentPage, setCurrentPage] = useState(1); // Odpovídá _pX.json
  const [pageSize, setPageSize] = useState(20);    // Počet zobrazených z aktuálního souboru
  const [subPage, setSubPage] = useState(0);       // Interní index pro slicing (0, 1, 2...)

  // Filtry
  const [filterResult, setFilterResult] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Hlavní funkce pro načtení konkrétního souboru
  const loadData = useCallback(async (partNum) => {
    setLoading(true);
    setError(false);
    try {
      const url = `/data/votings_list_${selectedTerm}_p${partNum}.json`;
      const data = await fetchJSON(url);
      
      if (!data || data.length === 0) {
        setVotings([]);
      } else {
        setVotings(data);
      }
    } catch (e) {
      console.error("Nepodařilo se načíst data:", e);
      setVotings([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedTerm]);

  // Efekt při změně období nebo hlavní stránky (souboru)
  useEffect(() => {
    loadData(currentPage);
    setSubPage(0); // Reset vnitřního listování při novém souboru
  }, [selectedTerm, currentPage, loadData]);

  // --- LOGIKA FILTROVÁNÍ A STRÁNKOVÁNÍ ---
  
  // 1. Nejprve aplikujeme filtry na data z aktuálního souboru
  const filteredData = votings.filter(v => {
    if (filterResult && v.result !== filterResult) return false;
    if (filterDateFrom && v.date < filterDateFrom) return false;
    if (filterDateTo && v.date > filterDateTo) return false;
    return true;
  });

  // 2. Poté data rozsekáme podle pageSize
  const totalSubPages = Math.ceil(filteredData.length / pageSize);
  const displayedVotings = filteredData.slice(subPage * pageSize, (subPage * pageSize) + pageSize);

  // Funkce pro navigaci
  const handleNext = () => {
    if (subPage < totalSubPages - 1) {
      setSubPage(prev => prev + 1);
    } else {
      setCurrentPage(prev => prev + 1);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrev = () => {
    if (subPage > 0) {
      setSubPage(prev => prev - 1);
    } else if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      // Poznámka: Po načtení předchozího souboru by bylo ideální skočit na jeho konec,
      // ale pro jednoduchost skočíme na začátek.
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // UI komponenta pro navigaci
  const Pagination = () => (
    <div className="flex items-center justify-between py-3">
      <div className="flex gap-2">
        <button
          disabled={currentPage === 1 && subPage === 0}
          onClick={handlePrev}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          &larr; Předchozí
        </button>
        <button
          disabled={votings.length === 0 || (subPage >= totalSubPages - 1 && displayedVotings.length < pageSize)}
          onClick={handleNext}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors shadow-sm"
        >
          Další &rarr;
        </button>
      </div>
      <div className="text-sm text-gray-500">
        Soubor <span className="font-semibold text-gray-800">{currentPage}</span> 
        {totalSubPages > 1 && ` (část ${subPage + 1}/${totalSubPages})`}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Hlasování</h1>
          <p className="text-gray-500 font-medium">Volební období {selectedTerm}</p>
        </div>

        {/* Nastavení počtu položek */}
        <div className="flex items-center gap-3 bg-gray-100 p-1.5 rounded-xl">
          <span className="text-xs font-bold text-gray-500 uppercase ml-2">Na stránku:</span>
          {[20, 50, 100].map(size => (
            <button
              key={size}
              onClick={() => { setPageSize(size); setSubPage(0); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                pageSize === size ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Filtry Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-400 uppercase">Výsledek</label>
          <select 
            value={filterResult} 
            onChange={e => {setFilterResult(e.target.value); setSubPage(0);}}
            className="w-full border-gray-200 rounded-xl text-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Všechny výsledky</option>
            <option value="prijato">Přijato</option>
            <option value="zamitnuto">Zamítnuto</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-400 uppercase">Datum od</label>
          <input 
            type="date" 
            value={filterDateFrom} 
            onChange={e => {setFilterDateFrom(e.target.value); setSubPage(0);}}
            className="w-full border-gray-200 rounded-xl text-sm focus:ring-indigo-500 focus:border-indigo-500" 
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-gray-400 uppercase">Datum do</label>
          <input 
            type="date" 
            value={filterDateTo} 
            onChange={e => {setFilterDateTo(e.target.value); setSubPage(0);}}
            className="w-full border-gray-200 rounded-xl text-sm focus:ring-indigo-500 focus:border-indigo-500" 
          />
        </div>
      </div>

      <Pagination />

      {/* Tabulka */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-indigo-600 font-semibold">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              Načítám...
            </div>
          </div>
        )}

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Datum</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Název hlasování</th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Výsledek</th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Ano / Ne / Zdrž</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayedVotings.map(v => (
              <tr key={v.id} className="hover:bg-indigo-50/30 transition-colors group">
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500 font-mono">{v.date}</td>
                <td className="px-6 py-4 text-sm">
                  <Link to={`/hlasovani/${v.id}?term=${selectedTerm}`} className="text-gray-900 font-semibold group-hover:text-indigo-600 transition-colors">
                    {v.title}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-center">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                    v.result === 'prijato' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {v.result === 'prijato' ? 'přijato' : 'zamítnuto'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-center text-gray-400 font-medium">
                  <span className="text-green-600">{v.vote_summary.yes}</span>
                  <span className="mx-1 text-gray-300">/</span>
                  <span className="text-red-500">{v.vote_summary.no}</span>
                  <span className="mx-1 text-gray-300">/</span>
                  <span>{v.vote_summary.abstain}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && displayedVotings.length === 0 && (
          <div className="text-center py-20">
            <div className="text-gray-300 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-400 font-medium">Žádná hlasování nevyhovují filtrům v této části dat.</p>
            {currentPage > 1 && (
              <button onClick={() => setCurrentPage(1)} className="mt-4 text-indigo-600 text-sm font-bold hover:underline">
                Zpět na začátek
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-4">
        <Pagination />
      </div>
    </div>
  );
}