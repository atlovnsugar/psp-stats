import { useEffect, useState, useMemo } from 'react';
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
  ArrowUpDown
} from 'lucide-react';

export default function VotingList() {
  const { selectedTerm } = useTerm();
  
  // Stavy pro data
  const [votings, setVotings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);
  
  // Stavy pro filtry a paginaci
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [filterResult, setFilterResult] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Efektivní načítání dat s ošetřením mounted stavu
  useEffect(() => {
    let isActive = true;
    setIsFullyLoaded(false);

    const fetchAllData = async () => {
      setLoading(true);
      setVotings([]);
      let pageNum = 1;
      let accumulated = [];

      while (isActive) {
        try {
          const url = `/data/votings_list_${selectedTerm}_p${pageNum}.json`;
          const data = await fetchJSON(url);
          
          if (!data || data.length === 0) {
            if (isActive) setIsFullyLoaded(true);
            break; 
          }

          accumulated = [...accumulated, ...data];
          if (isActive) setVotings([...accumulated]);
          pageNum++;
          
          // Krátká pauza pro udržení plynulosti UI
          await new Promise(r => setTimeout(r, 10));
        } catch (e) {
          console.warn(`Konec dat na straně ${pageNum}`, e);
          if (isActive) setIsFullyLoaded(true);
          break;
        }
      }
      if (isActive) setLoading(false);
    };

    if (selectedTerm) fetchAllData();

    return () => { isActive = false; };
  }, [selectedTerm]);

  // 2. Filtrování a vyhledávání (memoizované pro výkon)
  const filteredVotings = useMemo(() => {
    return votings.filter(v => {
      const matchResult = !filterResult || v.result === filterResult;
      const matchDateFrom = !filterDateFrom || v.date >= filterDateFrom;
      const matchDateTo = !filterDateTo || v.date <= filterDateTo;
      const matchSearch = !searchQuery || 
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.id.toString().includes(searchQuery);

      return matchResult && matchDateFrom && matchDateTo && matchSearch;
    });
  }, [votings, filterResult, filterDateFrom, filterDateTo, searchQuery]);

  // 3. Paginace - výpočty a navigace
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

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      {/* Horní sekce: Titulek a Vyhledávání */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Archiv hlasování
            </h1>
            {loading && !isFullyLoaded && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full border border-blue-100 dark:border-blue-800">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs font-bold uppercase tracking-wider">Synchronizace...</span>
              </div>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            {totalItems > 0 ? `Zobrazeno ${totalItems} záznamů pro období ${selectedTerm}` : 'Vyhledávám v archivech sněmovny...'}
          </p>
        </div>

        <div className="relative w-full lg:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text"
            placeholder="Hledat název bodu nebo ID..."
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Ovládací panel filtrů */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800">
        {/* Filtr: Výsledek */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
            <Filter className="w-3 h-3" /> Výsledek hlasování
          </label>
          <select 
            value={filterResult}
            onChange={(e) => { setFilterResult(e.target.value); setPage(1); }}
            className="w-full p-3 bg-white dark:bg-slate-800 border-none rounded-xl text-sm font-medium shadow-sm focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
          >
            <option value="">Všechny výsledky</option>
            <option value="Přijato">Přijato</option>
            <option value="Zamítnuto">Zamítnuto</option>
          </select>
        </div>

        {/* Filtr: Datum Od */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
            <Calendar className="w-3 h-3" /> Od data
          </label>
          <input 
            type="date"
            value={filterDateFrom}
            onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
            className="w-full p-3 bg-white dark:bg-slate-800 border-none rounded-xl text-sm font-medium shadow-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filtr: Datum Do */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
            <Calendar className="w-3 h-3" /> Do data
          </label>
          <input 
            type="date"
            value={filterDateTo}
            onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
            className="w-full p-3 bg-white dark:bg-slate-800 border-none rounded-xl text-sm font-medium shadow-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Přepínač: Položek na stránku */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
            Položek na stránku
          </label>
          <div className="grid grid-cols-4 gap-1.5 bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm">
            {[20, 50, 100, 200].map(n => (
              <button
                key={n}
                onClick={() => { setItemsPerPage(n); setPage(1); }}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  itemsPerPage === n 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                    : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hlavní tabulka dat */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="py-5 px-8">ID & Datum</th>
                <th className="py-5 px-6">Bod jednání</th>
                <th className="py-5 px-6 text-center">Výsledek</th>
                <th className="py-5 px-8 text-right">Poměr hlasů</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {currentVotings.map(v => (
                <tr key={v.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-all">
                  <td className="py-5 px-8 whitespace-nowrap">
                    <div className="font-mono text-xs text-blue-500 font-bold mb-1">#{v.id}</div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                      {new Date(v.date).toLocaleDateString('cs-CZ')}
                    </div>
                  </td>
                  <td className="py-5 px-6 max-w-md">
                    <Link 
                      to={`/hlasovani/${v.id}`}
                      className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-relaxed line-clamp-2"
                    >
                      {v.name}
                    </Link>
                  </td>
                  <td className="py-5 px-6 text-center">
                    <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      v.result === 'Přijato' 
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' 
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                    }`}>
                      {v.result}
                    </span>
                  </td>
                  <td className="py-5 px-8 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5 font-mono text-sm">
                      <span className="text-emerald-600 font-black">{v.vote_summary.yes}</span>
                      <span className="text-slate-300 dark:text-slate-600">/</span>
                      <span className="text-rose-600 font-black">{v.vote_summary.no}</span>
                      <span className="text-slate-300 dark:text-slate-600">/</span>
                      <span className="text-slate-400 font-medium">{v.vote_summary.abstain}</span>
                    </div>
                    <div className="w-24 h-1 bg-slate-100 dark:bg-slate-700 rounded-full mt-2 ml-auto overflow-hidden flex">
                      <div 
                        className="h-full bg-emerald-500" 
                        style={{ width: `${(v.vote_summary.yes / (v.vote_summary.yes + v.vote_summary.no + v.vote_summary.abstain)) * 100}%` }}
                      />
                      <div 
                        className="h-full bg-rose-500" 
                        style={{ width: `${(v.vote_summary.no / (v.vote_summary.yes + v.vote_summary.no + v.vote_summary.abstain)) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {currentVotings.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center animate-in fade-in slide-in-from-bottom-4">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6">
              <Inbox className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Žádné záznamy nenalezeny</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm">
              Zkuste upravit filtry nebo vyhledávací dotaz. Data pro období {selectedTerm} jsou stále prohledávána.
            </p>
          </div>
        )}
      </div>

      {/* Paginace - Profesionální verze */}
      {totalPages > 1 && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-12">
          <div className="text-sm font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full">
            Strana <span className="text-slate-900 dark:text-white font-bold">{safePage}</span> z <span className="text-slate-900 dark:text-white font-bold">{totalPages}</span>
          </div>
          
          <div className="flex items-center gap-1.5 p-1.5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
            <button 
              onClick={() => goToPage(1)}
              disabled={safePage === 1}
              className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-20 transition-all"
              title="První strana"
            >
              <ChevronsLeft className="w-5 h-5" />
            </button>
            
            <button 
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage === 1}
              className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-20 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="hidden sm:flex items-center gap-1 mx-2">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                let p;
                if (totalPages <= 5) p = i + 1;
                else if (safePage <= 3) p = i + 1;
                else if (safePage >= totalPages - 2) p = totalPages - 4 + i;
                else p = safePage - 2 + i;

                return (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`w-10 h-10 rounded-xl text-sm font-black transition-all ${
                      safePage === p 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-110' 
                        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button 
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage === totalPages}
              className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-20 transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <button 
              onClick={() => goToPage(totalPages)}
              disabled={safePage === totalPages}
              className="p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-20 transition-all"
              title="Poslední strana"
            >
              <ChevronsRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}