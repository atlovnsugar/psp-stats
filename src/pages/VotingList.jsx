import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTerm } from '../context/TermContext';
import { fetchJSON } from '../utils/dataCache';

export default function VotingList() {
  const { selectedTerm } = useTerm();
  
  // Data a stavy načítání
  const [allVotings, setAllVotings] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Stavy pro stránkování a filtry
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filterResult, setFilterResult] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Funkce pro načtení VŠECH dat daného období (aby bylo přepínání stránek instantní)
  const loadAllData = useCallback(async () => {
    setLoading(true);
    let loadedData = [];
    let pageNum = 1;
    let keepFetching = true;

    try {
      while (keepFetching) {
        // Načítáme postupně soubory p1, p2, p3...
        const data = await fetchJSON(`/data/votings_list_${selectedTerm}_p${pageNum}.json`);
        
        if (data && data.length > 0) {
          loadedData = [...loadedData, ...data];
          pageNum++;
        } else {
          keepFetching = false;
        }
        
        // Bezpečnostní pojistka, aby se aplikace nezacyklila (např. max 50 souborů)
        if (pageNum > 50) keepFetching = false;
      }
      setAllVotings(loadedData);
    } catch (e) {
      console.error("Konec dat nebo chyba načítání:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedTerm]);

  // Při změně období načteme nová data a resetujeme stránku
  useEffect(() => {
    setCurrentPage(1);
    loadAllData();
  }, [selectedTerm, loadAllData]);

  // 1. FILTROVÁNÍ (probíhá nad všemi daty)
  const filteredVotings = allVotings.filter(v => {
    if (filterResult && v.result !== filterResult) return false;
    if (filterDateFrom && v.date < filterDateFrom) return false;
    if (filterDateTo && v.date > filterDateTo) return false;
    return true;
  });

  // 2. VÝPOČET STRÁNKOVÁNÍ
  const totalItems = filteredVotings.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  
  // Získáme pouze data pro aktuální stránku
  const indexOfLastItem = currentPage * pageSize;
  const indexOfFirstItem = indexOfLastItem - pageSize;
  const currentItems = filteredVotings.slice(indexOfFirstItem, indexOfLastItem);

  // Funkce pro změnu stránky (scrollování nahoru pro lepší UX)
  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Pomocná komponenta pro navigaci
  const PaginationControls = () => (
    <div className="flex items-center justify-between bg-white px-4 py-3 border-t border-gray-200 sm:px-6 my-4 rounded-lg shadow-sm">
      <div className="flex flex-1 justify-between sm:hidden">
        <button onClick={() => paginate(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
          Předchozí
        </button>
        <button onClick={() => paginate(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
                className="relative ml-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
          Další
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Zobrazeno <span className="font-medium">{totalItems > 0 ? indexOfFirstItem + 1 : 0}</span> až <span className="font-medium">{Math.min(indexOfLastItem, totalItems)}</span> z <span className="font-medium">{totalItems}</span> výsledků
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            disabled={currentPage === 1}
            onClick={() => paginate(currentPage - 1)}
            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-30"
          >
            ←
          </button>
          {[...Array(totalPages)].map((_, i) => {
            // Zobrazíme jen okolní stránky, pokud je jich moc
            if (i + 1 === 1 || i + 1 === totalPages || (i + 1 >= currentPage - 2 && i + 1 <= currentPage + 2)) {
              return (
                <button
                  key={i + 1}
                  onClick={() => paginate(i + 1)}
                  className={`px-3 py-1 border rounded ${currentPage === i + 1 ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100'}`}
                >
                  {i + 1}
                </button>
              );
            }
            if (i + 1 === currentPage - 3 || i + 1 === currentPage + 3) return <span key={i}>...</span>;
            return null;
          })}
          <button 
            disabled={currentPage === totalPages}
            onClick={() => paginate(currentPage + 1)}
            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-30"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Hlasování (Období {selectedTerm})</h1>
        {loading && <span className="text-sm text-indigo-600 animate-pulse">Načítám data...</span>}
      </div>

      {/* Filtry a nastavení stránky */}
      <div className="bg-gray-50 p-4 rounded-xl mb-6 flex flex-wrap gap-4 items-end border border-gray-200">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase">Výsledek</label>
          <select value={filterResult} onChange={e => {setFilterResult(e.target.value); setCurrentPage(1);}}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
            <option value="">Všechny výsledky</option>
            <option value="prijato">Přijato</option>
            <option value="zamitnuto">Zamítnuto</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase">Od - Do</label>
          <div className="flex gap-2">
            <input type="date" value={filterDateFrom} onChange={e => {setFilterDateFrom(e.target.value); setCurrentPage(1);}}
                   className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            <input type="date" value={filterDateTo} onChange={e => {setFilterDateTo(e.target.value); setCurrentPage(1);}}
                   className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
        </div>

        <div className="flex flex-col gap-1 ml-auto">
          <label className="text-xs font-semibold text-gray-500 uppercase">Na stránku</label>
          <select value={pageSize} onChange={e => {setPageSize(Number(e.target.value)); setCurrentPage(1);}}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white font-bold text-indigo-600">
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
      </div>

      {/* Horní navigace */}
      {totalPages > 1 && <PaginationControls />}

      {/* Tabulka */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Datum</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Název hlasování</th>
              <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Výsledek</th>
              <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Ano/Ne/Zdrž</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {currentItems.map(v => (
              <tr key={v.id} className="hover:bg-indigo-50/50 transition-colors">
                <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-600 font-medium">{v.date}</td>
                <td className="px-4 py-3 text-sm">
                  <Link to={`/hlasovani/${v.id}?term=${selectedTerm}`} className="text-indigo-600 hover:text-indigo-800 font-semibold">
                    {v.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-center">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${
                    v.result === 'prijato' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {v.result === 'prijato' ? 'přijato' : 'zamítnuto'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-center text-gray-500 font-mono">
                  <span className="text-green-600">{v.vote_summary.yes}</span>/
                  <span className="text-red-600">{v.vote_summary.no}</span>/
                  <span className="text-gray-400">{v.vote_summary.abstain}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {currentItems.length === 0 && !loading && (
          <div className="py-20 text-center">
            <p className="text-gray-400 text-lg">Žádná hlasování pro tyto filtry nebyla nalezena.</p>
          </div>
        )}
      </div>

      {/* Dolní navigace */}
      {totalPages > 1 && <PaginationControls />}
    </div>
  );
}