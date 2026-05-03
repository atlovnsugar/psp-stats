// src/pages/VotingList.jsx
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

// Importujeme Lucide ikony, předpokládáme, že jsou nainstalované

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
          console.error("Chyba při načítání dat hlasování:", e);
          break; // Zastavíme smyčku při chybě
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

    return (
      <div className="pagination-container">
        <div className="pagination-wrapper">
          <button onClick={() => goToPage(1)} disabled={safePage === 1} className="pagination-btn">
            <ChevronsLeft size={16} />
          </button>
          <button onClick={() => goToPage(safePage - 1)} disabled={safePage === 1} className="pagination-btn">
            <ChevronLeft size={16} />
          </button>

          {start > 1 && (
            <>
              <span className="pagination-ellipsis">...</span>
              <button onClick={() => goToPage(1)} className="pagination-page">
                1
              </button>
            </>
          )}

          {pages.map(p => (
            <button
              key={p}
              onClick={() => goToPage(p)}
              className={`pagination-page ${safePage === p ? 'active' : ''}`}
            >
              {p}
            </button>
          ))}

          {end < totalPages && (
            <>
              <button onClick={() => goToPage(totalPages)} className="pagination-page">
                {totalPages}
              </button>
              <span className="pagination-ellipsis">...</span>
            </>
          )}

          <button onClick={() => goToPage(safePage + 1)} disabled={safePage === totalPages} className="pagination-btn">
            <ChevronRight size={16} />
          </button>
          <button onClick={() => goToPage(totalPages)} disabled={safePage === totalPages} className="pagination-btn">
            <ChevronsRight size={16} />
          </button>
        </div>
        <div className="pagination-info">
          Zobrazeno <strong>{totalItems === 0 ? 0 : startIndex + 1}</strong> až{' '}
          <strong>{Math.min(startIndex + itemsPerPage, totalItems)}</strong> z{' '}
          <strong>{totalItems}</strong> záznamů
        </div>
      </div>
    );
  };

  // Funkce pro získání barvy badge based on result
  const getResultBadgeClass = (result) => {
    return result === 'prijato' ? 'timeline-badge vote-yes' : 'timeline-badge vote-no';
  };

  // Funkce pro získání barvy progress baru
const getProgressStyle = (yes, no, abstain) => {
  const total = yes + no + abstain;
  if (total === 0) return { yes: 0, no: 0, abstain: 0 }; // Pokud nikdo neglasoval, vše je 0%
  return {
    yes: (yes / total) * 100,
    no: (no / total) * 100,
    abstain: (abstain / total) * 100, // Přidán výpočet pro abstain
  };
};

  return (
    <div className="app-container">
      {/* Nadpis a Vyhledávání */}
      <div className="list-header">
        <div className="header-title-section">
          <div className="title-and-loader">
            <h1>Hlasování</h1>
            {loading && (
              <div className="loading-indicator">
                <Loader2 size={14} className="loader-spinner-icon" />
                <span>Aktualizace...</span>
              </div>
            )}
          </div>
          <p className="term-info">
            Období: <span className="term-highlight">{selectedTerm}</span>
          </p>
        </div>

        <div className="search-wrapper">
          <div className="search-icon">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Hledat bod nebo ID..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Filtry */}
      <div className="filters-row">
        <div className="filter-group">
          <label>
            <Filter size={12} /> Výsledek
          </label>
          <select
            value={filterResult}
            onChange={(e) => { setFilterResult(e.target.value); setPage(1); }}
            className="filter-select"
          >
            <option value="">Všechny</option>
            <option value="prijato">Přijato</option>
            <option value="zamitnuto">Zamítnuto</option>
          </select>
        </div>

        <div className="filter-group">
          <label>
            <Calendar size={12} /> Od data
          </label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
            className="filter-input"
          />
        </div>

        <div className="filter-group">
          <label>
            <Calendar size={12} /> Do data
          </label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
            className="filter-input"
          />
        </div>

        <div className="filter-group pagination-controls">
          <label>Stránkování</label>
          <div className="items-per-page-selector">
            {[20, 50, 100, 200].map(n => (
              <button
                key={n}
                onClick={() => { setItemsPerPage(n); setPage(1); }}
                className={`items-per-page-btn ${itemsPerPage === n ? 'active' : ''}`}
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
          className="clear-filters-btn"
        >
          <X size={14} /> Zrušit všechny filtry
        </button>
      )}

      {/* Tabulka */}
      <div className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID & Datum</th>
                <th>Bod jednání</th>
                <th>Výsledek</th>
                <th>Poměr hlasů</th>
              </tr>
            </thead>
            <tbody>
              {currentVotings.length > 0 ? (
                currentVotings.map(v => {
                  const progress = getProgressStyle(v.vote_summary.yes, v.vote_summary.no, v.vote_summary.abstain);
                  return (
                    <tr key={v.id}>
                      <td className="voting-id-date">
                        <a 
                          href={`https://www.psp.cz/sqw/hlasy.sqw?G=${v.id}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="id-tag hover:text-primary transition-colors cursor-pointer"
                          title="Zobrazit na psp.cz"
                        >
                          #{v.id}
                        </a>
                        <span className="date-text">{v.date}</span>
                      </td>
                      <td className="voting-title">
                        <Link to={`/hlasovani/${v.id}?term=${selectedTerm}`}>
                          {v.title}
                        </Link>
                      </td>
                      <td className="voting-result">
                        <span className={getResultBadgeClass(v.result)}>
                          {v.result === 'prijato' ? 'Přijato' : 'Zamítnuto'}
                        </span>
                      </td>
                      <td className="voting-ratio">
                        <div className="ratio-numbers">
                          <span className="yes-count">{v.vote_summary.yes}</span>
                          <span>/</span>
                          <span className="no-count">{v.vote_summary.no}</span>
                          <span>/</span>
                          <span className="abstain-count">{v.vote_summary.abstain}</span>
                        </div>
                        <div className="ratio-progress-bar">
                          <div
                            className="progress-fill yes"
                            style={{ width: `${progress.yes}%` }}
                          ></div>
                          <div
                            className="progress-fill no"
                            style={{ width: `${progress.no}%` }}
                          ></div>
                          <div
                            className="progress-fill abstain"
                            style={{ width: `${progress.abstain}%` }}
                            ></div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4">
                    <div className="empty-state">
                      <div className="empty-icon">
                        <Inbox size={40} />
                      </div>
                      <h3>Nic jsme nenašli</h3>
                      <p>
                        {loading ? "Pracujeme na tom, stahujeme další stránky z archivu..." : "Zkuste změnit filtry nebo hledaný výraz."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination />
    </div>
  );
}