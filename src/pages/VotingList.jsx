import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTerm } from '../context/TermContext';
import { fetchJSON } from '../utils/dataCache';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Search, 
  Calendar, 
  Filter, 
  Inbox, 
  Loader2,
  X
} from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');

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
          
          if (!data || data.length === 0) break;

          accumulated = [...accumulated, ...data];
          if (isActive) setVotings([...accumulated]);
          pageNum++;
        } catch (e) {
          break;
        }
      }
      if (isActive) setLoading(false);
    };

    setVotings([]);
    setPage(1);
    if (selectedTerm) fetchAllData();

    return () => { isActive = false; };
  }, [selectedTerm]);

  // 2. Filtrace (nad načtenými daty) - včetně hledání
  const filteredVotings = votings.filter(v => {
    const matchResult = !filterResult || v.result === filterResult;
    const matchDateFrom = !filterDateFrom || v.date >= filterDateFrom;
    const matchDateTo = !filterDateTo || v.date <= filterDateTo;
    const matchSearch = !searchQuery || 
      (v.title && v.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      v.id.toString().includes(searchQuery);

    return matchResult && matchDateFrom && matchDateTo && matchSearch;
  });

  // 3. Výpočet paginace
  const totalItems = filteredVotings.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const currentVotings = filteredVotings.slice(startIndex, startIndex + itemsPerPage);

  const goToPage = (p) => {
    const target = Math.max(1, Math.min(p, totalPages));
    setPage(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Komponenta paginace s čísly stránek
  const Pagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, safePage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) pages.push(i);

    return (
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-8">
        <div className="text-sm font-medium text-slate-500 order-2 md:order-1">
          Zobrazeno <span className="text-slate-900 dark:text-white font-bold">{totalItems === 0 ? 0 : startIndex + 1}</span> až{' '}
          <span className="text-slate-900 dark:text-white font-bold">{Math.min(startIndex + itemsPerPage, totalItems)}</span> z{' '}
          <span className="text-slate-900 dark:text-white font-bold">{totalItems}</span> záznamů
        </div>
        
        <div className="flex items-center gap-1 p-1.5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 order-1 md:order-2">
          <button onClick={() => goToPage(1)} disabled={safePage === 1} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-20 transition-all text-slate-900 dark:text-slate-100"><ChevronsLeft size={18} /></button>
          <button onClick={() => goToPage(safePage - 1)} disabled={safePage === 1} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-20 transition-all text-slate-900 dark:text-slate-100"><ChevronLeft size={18} /></button>
          
          <div className="flex items-center gap-1 mx-2">
            {pages.map(p => (
              <button
                key={p}
                onClick={() => goToPage(p)}
                className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${
                  safePage === p 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button onClick={() => goToPage(safePage + 1)} disabled={safePage === totalPages} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-20 transition-all text-slate-900 dark:text-slate-100"><ChevronRight size={18} /></button>
          <button onClick={() => goToPage(totalPages)} disabled={safePage === totalPages} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-20 transition-all text-slate-900 dark:text-slate-100"><ChevronsRight size={18} /></button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-500">
      {/* Nadpis a Vyhledávání */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Hlasování
            </h1>
            {loading && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-800">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest">Aktualizace...</span>
              </div>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
            Období: <span className="text-blue-600 dark:text-blue-400 font-bold">{selectedTerm}</span>
          </p>
        </div>

        <div className="relative w-full lg:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Hledat bod nebo ID..."
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm text-slate-900 dark:text-slate-100"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Filtry */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-inner">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
            <Filter size={12} /> Výsledek
          </label>
          <select 
            value={filterResult}
            onChange={(e) => { setFilterResult(e.target.value); setPage(1); }}
            className="w-full p-3 bg-white dark:bg-slate-800 border-none rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500 cursor-pointer text-slate-900 dark:text-slate-100"
          >
            <option value="">Všechny</option>
            <option value="prijato">Přijato</option>
            <option value="zamitnuto">Zamítnuto</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
            <Calendar size={12} /> Od data
          </label>
          <input 
            type="date"
            value={filterDateFrom}
            onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
            className="w-full p-3 bg-white dark:bg-slate-800 border-none rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
            <Calendar size={12} /> Do data
          </label>
          <input 
            type="date"
            value={filterDateTo}
            onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
            className="w-full p-3 bg-white dark:bg-slate-800 border-none rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
            Stránkování
          </label>
          <div className="grid grid-cols-4 gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm">
            {[20, 50, 100, 200].map(n => (
              <button
                key={n}
                onClick={() => { setItemsPerPage(n); setPage(1); }}
                className={`py-2 text-[10px] font-black rounded-lg transition-all ${
                  itemsPerPage === n 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(filterResult || filterDateFrom || filterDateTo || searchQuery) && (
        <button 
          onClick={() => { setFilterResult(''); setFilterDateFrom(''); setFilterDateTo(''); setSearchQuery(''); setPage(1); }}
          className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors px-2"
        >
          <X size={14} /> Zrušit všechny filtry
        </button>
      )}

      {/* Tabulka */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/40 dark:shadow-none border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-700">
                <th className="py-5 px-8">ID & Datum</th>
                <th className="py-5 px-6">Bod jednání</th>
                <th className="py-5 px-6 text-center">Výsledek</th>
                <th className="py-5 px-8 text-right">Poměr hlasů</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {currentVotings.map(v => (
                <tr key={v.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-all">
                  <td className="py-5 px-8 whitespace-nowrap">
                    <div className="font-mono text-[10px] text-blue-500 font-bold mb-1 opacity-70">#{v.id}</div>
                    <div className="font-bold text-slate-900 dark:text-slate-200 text-sm">
                      {v.date}
                    </div>
                  </td>
                  <td className="py-5 px-6">
                    <Link 
                      to={`/hlasovani/${v.id}?term=${selectedTerm}`}
                      className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-relaxed block max-w-lg"
                    >
                      {v.title}
                    </Link>
                  </td>
                  <td className="py-5 px-6 text-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                      v.result === 'prijato' 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' 
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                    }`}>
                      {v.result === 'prijato' ? 'Přijato' : 'Zamítnuto'}
                    </span>
                  </td>
                  <td className="py-5 px-8 text-right">
                    <div className="flex items-center justify-end gap-1.5 font-mono text-xs mb-1.5">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">{v.vote_summary.yes}</span>
                      <span className="text-slate-300 dark:text-slate-600">/</span>
                      <span className="text-rose-600 dark:text-rose-400 font-bold">{v.vote_summary.no}</span>
                      <span className="text-slate-300 dark:text-slate-600">/</span>
                      <span className="text-slate-400 font-bold">{v.vote_summary.abstain}</span>
                    </div>
                    <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full ml-auto overflow-hidden flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${(v.vote_summary.yes / Math.max(1, v.vote_summary.yes + v.vote_summary.no + v.vote_summary.abstain)) * 100}%` }} />
                      <div className="h-full bg-rose-500" style={{ width: `${(v.vote_summary.no / Math.max(1, v.vote_summary.yes + v.vote_summary.no + v.vote_summary.abstain)) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {currentVotings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center bg-slate-50/30 dark:bg-slate-900/10">
            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl shadow-sm flex items-center justify-center mb-6 text-slate-300">
              <Inbox size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Nic jsme nenašli</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
              {loading ? "Pracujeme na tom, stahujeme další stránky z archivu..." : "Zkuste změnit filtry nebo hledaný výraz."}
            </p>
          </div>
        )}
      </div>

      <Pagination />
    </div>
  );
}