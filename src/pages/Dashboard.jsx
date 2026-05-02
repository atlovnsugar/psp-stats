// src/pages/Dashboard.jsx
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTerm } from '../context/TermContext';
import { fetchJSON } from '../utils/dataCache';
import { useMpsMap, useVotingsIndex } from '../context/DataContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import MpModal from '../components/MpModal';

// Mapping pro názvy stran - podle skutečných politických stran v ČR
const PARTY_NAME_MAP = {
  'kdu csl': 'KDU-ČSL',
  'ods': 'ODS',
  'ms': 'Motoristé',
  'cssd': 'ČSSD',
  'nezaraz': 'Nezařazení',
  'spd': 'SPD',
  'top09': 'TOP 09',
  'stan': 'STAN',
  'pirati': 'Piráti',
  'ano': 'ANO',
  'kscm': 'KSČM',
  'usvit': 'Úsvit',
  'top09 s': 'TOP 09-STAN',
  'vv': 'VV',
  'sz': 'Zelení',
  'nez sz': 'Nezařazení (SZ)',
  'us deu': 'US-DEU',
  'us': 'US',
  'spr rsc': 'SPR-RSČ',
  'oda': 'ODA'
};

// Barevné schéma pro strany
const PARTY_COLORS = {
  'ODS': '#005EB8',
  'ČSSD': '#e17800',
  'ANO': '#19d8fa',
  'KDU-ČSL': '#f3f02b',
  'TOP 09': '#6600a1',
  'SPD': '#103A6B',
  'STAN': '#7c7c7c',
  'Zelení': '#66B246',
  'KSČM': '#D21F1B',
  'SPOLU': '#005EB8',
  'Jiné': '#64748b',
  'Nezařazení': '#4f92f0',
  'Změna 21': '#FF6B6B',
  'Piráti': '#696969'
};

// Formátovací funkce pro názvy stran
const formatPartyName = (partyId) => {
  if (!partyId) return 'Nezařazení';

  const normalized = partyId
    .replace(/CSL/g, 'ČSL')
    .replace(/CSSD/g, 'ČSSD')
    .replace(/-/g, ' ')
    .trim();

  return PARTY_NAME_MAP[normalized] || normalized;
};

export default function Dashboard() {
  const { selectedTerm } = useTerm();
  const [mpStats, setMpStats] = useState([]);
  const [partyStats, setPartyStats] = useState([]);
  const [votingsCount, setVotingsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [partyLoading, setPartyLoading] = useState(true);
  const [mpsLoading, setMpsLoading] = useState(true);
  const [selectedMpId, setSelectedMpId] = useState(null);
  const [partyError, setPartyError] = useState(null);
  const [mpsError, setMpsError] = useState(null);

  // Stav pro filtraci žebříčku poslanců
  const [leaderboardView, setLeaderboardView] = useState('top'); // 'top', 'bottom'
  const [leaderboardLimit, setLeaderboardLimit] = useState(10);
  const [selectedPartyFilter, setSelectedPartyFilter] = useState('all'); // 'all' nebo party_id

  const mpsMap = useMpsMap();
  const votingsIndex = useVotingsIndex();

  const overallLoading = loading || partyLoading || mpsLoading;

  // Memoizace pro lepší výkon
  const avgOverallAttendance = useMemo(() => {
    if (!mpStats.length) return 0;
    const total = mpStats.reduce((sum, mp) => sum + mp.attendance_pct, 0);
    return (total / mpStats.length).toFixed(1);
  }, [mpStats]);

  const formatNumber = (num) => {
    return new Intl.NumberFormat('cs-CZ').format(num);
  };

  // Získání barvy pro stranu
  const getPartyColor = (partyId) => {
    const name = formatPartyName(partyId);
    return PARTY_COLORS[name] || PARTY_COLORS['Jiné'];
  };

  useEffect(() => {
    let isMounted = true;

    async function loadPartyStats() {
      setPartyLoading(true);
      try {
        const party = await fetchJSON(`/data/term_${selectedTerm}_party_stats.json`).catch(err => {
          console.warn('Party stats not available for term', selectedTerm, err);
          return [];
        });
        if (isMounted) {
          setPartyStats(party);
          setPartyError(null);
        }
      } catch (e) {
        console.error('Error loading party stats:', e);
        if (isMounted) {
          setPartyError('Nepodařilo se načíst data stran');
          setPartyStats([]);
        }
      } finally {
        if (isMounted) {
          setPartyLoading(false);
        }
      }
    }

    async function loadMpStats() {
      setMpsLoading(true);
      try {
        const [stats, vIndex] = await Promise.all([
          fetchJSON(`/data/term_${selectedTerm}_mp_stats.json`),
          fetchJSON('/data/votings_index.json').catch(() => [])
        ]);

        if (isMounted) {
          setMpStats(stats);
          setVotingsCount(vIndex.filter(v => v.term_id === selectedTerm).length);
          setMpsError(null);
        }
      } catch (e) {
        console.error('Error loading MP stats:', e);
        if (isMounted) {
          setMpsError('Nepodařilo se načíst data poslanců');
          setMpStats([]);
        }
      } finally {
        if (isMounted) {
          setMpsLoading(false);
        }
      }
    }

    if (selectedTerm) {
      setLoading(true);
      Promise.all([loadPartyStats(), loadMpStats()])
        .finally(() => {
          if (isMounted) {
            setLoading(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [selectedTerm]);

  const getPartyAvg = (partyId) => {
    const party = partyStats.find(p => p.party_id === partyId);
    return party ? party.avg_attendance : 0;
  };

  // Memoizace seznamu poslanců pro žebříček s ohledem na filtry
  const leaderboardMps = useMemo(() => {
    if (!mpStats.length) return [];

    // 1. Seřazení podle účasti
    let sortedMps = [...mpStats];
    if (leaderboardView === 'top') {
      sortedMps.sort((a, b) => b.attendance_pct - a.attendance_pct);
    } else { // bottom
      sortedMps.sort((a, b) => a.attendance_pct - b.attendance_pct);
    }

    // 2. Filtrování podle strany
    if (selectedPartyFilter !== 'all') {
      sortedMps = sortedMps.filter(mp => mp.party_id === selectedPartyFilter);
    }

    // 3. Omezení počtu
    const limitedMps = sortedMps.slice(0, leaderboardLimit);

    // 4. Přidání dalších informací
    return limitedMps.map(stat => {
      const mpInfo = mpsMap.get(stat.mp_id) || {};
      const partyAvg = getPartyAvg(stat.party_id);
      const formattedPartyName = formatPartyName(stat.party_id);

      return {
        ...stat,
        name: mpInfo.name || `Poslanec #${stat.mp_id}`,
        party_name: formattedPartyName,
        diffFromAvg: (stat.attendance_pct - avgOverallAttendance).toFixed(1),
        diffFromParty: (stat.attendance_pct - partyAvg).toFixed(1)
      };
    });
  }, [mpStats, mpsMap, avgOverallAttendance, leaderboardView, leaderboardLimit, selectedPartyFilter]);

  // Memoizace unikátních stran pro filtr
  const uniqueParties = useMemo(() => {
    if (!mpStats.length) return [];
    const partiesSet = new Set();
    mpStats.forEach(mp => {
      if (mp.party_id) {
        partiesSet.add(mp.party_id);
      }
    });
    return Array.from(partiesSet).sort();
  }, [mpStats]);

  if (overallLoading && !mpStats.length && !partyStats.length) {
    return (
      <div className="app-layout">
        <div className="bg-animation">
          <div className="orb"></div>
          <div className="orb"></div>
          <div className="orb"></div>
        </div>

        <div className="loading-skeleton">
          <div className="skeleton-header"></div>
          <div className="skeleton-grid">
            <div className="skeleton-card"></div>
            <div className="skeleton-card"></div>
            <div className="skeleton-card"></div>
          </div>
          <div className="skeleton-chart"></div>
          <div className="skeleton-table"></div>
        </div>
      </div>
    );
  }

  const hasErrors = mpsError || partyError;
  if (hasErrors) {
    return (
      <div className="app-layout">
        <div className="bg-animation">
          <div className="orb"></div>
          <div className="orb"></div>
          <div className="orb"></div>
        </div>

        <div className="card error-section">
          <h2 className="text-2xl font-bold mb-4">Chyba při načítání dat</h2>
          {mpsError && <p className="error-message text-warning mb-2">⚠️ {mpsError}</p>}
          {partyError && <p className="error-message text-warning mb-4">⚠️ {partyError}</p>}
          <button
            className="btn btn-primary mt-4"
            onClick={() => window.location.reload()}
            aria-label="Znovu načíst stránku"
          >
            Zkusit znovu
          </button>
        </div>
      </div>
    );
  }

  // Vlastní Tooltip komponenta pro Recharts
  const CustomizedTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry, index) => {
            // Přizpůsobení textu pro klíč 'prumernaUcast'
            const displayName = entry.dataKey === 'prumernaUcast' 
              ? 'Průměrná účast na hlasováních' 
              : entry.name;
              
            return (
              <p key={`item-${index}`} className="tooltip-item" style={{ color: entry.color }}>
                {displayName}: {entry.value.toFixed(1)}%
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="app-layout relative">
      <div className="bg-animation">
        <div className="orb"></div>
        <div className="orb"></div>
        <div className="orb"></div>
      </div>

      <header className="dashboard-header mb-6 relative z-10">
        <h1 className="text-2xl font-bold mb-2">Přehled období {selectedTerm}</h1>
        <p className="text-muted">
          Aktuální data z {formatNumber(votingsCount)} hlasování s účastí {formatNumber(mpStats.length)} poslanců
        </p>
      </header>

      {/* Summary cards - vedle sebe */}
      <div className="stats-grid summary-cards relative z-10"> {/* Používáme existující grid styl z global.css */}
        <SummaryCard
          title="Hlasování"
          value={formatNumber(votingsCount)}
          description="Celkem v tomto volebním období"
          icon="🗳️"
          loading={mpsLoading}
        />
        <SummaryCard
          title="Poslanci"
          value={formatNumber(mpStats.length)}
          description="Aktivních poslanců v období"
          icon="👥"
          loading={mpsLoading}
        />
        <SummaryCard
          title="Prům. účast"
          value={`${avgOverallAttendance}%`}
          description="Celková průměrná účast"
          icon="📊"
          loading={mpsLoading}
          highlight={true}
        />
      </div>

      {/* Party comparison a Leaderboard vedle sebe */}
      <div className="stats-grid dashboard-grid relative z-10"> {/* Používáme existující grid styl z global.css */}
        {/* Party comparison */}
{/* Party comparison */}
        <section className="party-section">
          <div className="card h-full">
            <div className="panel-header"> 
              <h2>Účast podle stran</h2>
              {/* Obalíme span s počtem stran do podmínky, abychom zamezili chybám, než se data načtou */}
              {!partyLoading && (
                <span className="text-muted">
                  {/* Počet unikátních stran spočítáme až po normalizaci a sloučení (viz níže) */}
                </span>
              )}
            </div>

            {partyLoading ? (
              <div className="chart-container skeleton-chart"></div> 
            ) : partyStats.length > 0 ? (
              (() => {
                // 1. Normalizace a sloučení dat stran
                const groupedPartyStats = {};
                
                partyStats.forEach(p => {
                  const normalizedName = formatPartyName(p.party_id);
                  
                  if (!groupedPartyStats[normalizedName]) {
                    // Inicializace nové skupiny (strany)
                    groupedPartyStats[normalizedName] = {
                      name: normalizedName,
                      original_party_ids: [p.party_id], // Jen pro přehled
                      total_attended: p.total_attended || 0,
                      total_eligible_votes: p.total_eligible_votes || 0,
                      // Pokud má záznam 'avg_attendance', uložíme ho pro případ, že chybí absolutní čísla
                      fallback_avg: p.avg_attendance || 0,
                      count: 1
                    };
                  } else {
                    // Přičtení hodnot k existující skupině
                    groupedPartyStats[normalizedName].total_attended += (p.total_attended || 0);
                    groupedPartyStats[normalizedName].total_eligible_votes += (p.total_eligible_votes || 0);
                    groupedPartyStats[normalizedName].fallback_avg += (p.avg_attendance || 0);
                    groupedPartyStats[normalizedName].count += 1;
                    groupedPartyStats[normalizedName].original_party_ids.push(p.party_id);
                  }
                });

                // 2. Převod sloučeného objektu zpět na pole a výpočet finálních průměrů
                const mergedChartData = Object.values(groupedPartyStats).map(group => {
                  let finalAvg = 0;
                  // Pokud máme k dispozici absolutní čísla hlasů, spočítáme přesný vážený průměr
                  if (group.total_eligible_votes > 0) {
                    finalAvg = (group.total_attended / group.total_eligible_votes) * 100;
                  } else {
                    // Pokud absolutní čísla chybí (fallback), uděláme prostý průměr procent (méně přesné, ale bezpečné)
                    finalAvg = group.fallback_avg / group.count;
                  }
                  
                  return {
                    name: group.name,
                    prumernaUcast: finalAvg,
                    // Zachováváme pro zpětnou kompatibilitu, pokud by to někde bylo potřeba
                    celkovaUcast: finalAvg.toFixed(1) 
                  };
                });

                // 3. Vykreslení grafu s čistými daty
                return (
                  <>
                    <div className="text-right text-muted text-sm mb-2 mt-[-20px]">
                      {mergedChartData.length} {mergedChartData.length === 1 ? 'strana' : 'strany'}
                    </div>
                    <div className="chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={mergedChartData}
                          margin={{ top: 5, right: 0, left: -15, bottom: 5 }}
                        >
                          <XAxis
                            dataKey="name"
                            stroke="var(--text-secondary)"
                            fontSize={12}
                            interval={0}
                            tickLine={false}
                          />
                          <YAxis
                            unit="%"
                            stroke="var(--text-secondary)"
                            fontSize={12}
                            domain={[0, 100]}
                            tickFormatter={(value) => `${value}%`}
                          />
                          <Tooltip content={<CustomizedTooltip />} />
                          <Bar
                            dataKey="prumernaUcast"
                            radius={[4, 4, 0, 0]}
                            isAnimationActive={false}
                          >
                            {mergedChartData.map((entry, index) => {
                              // Najdeme původní ID pro získání správné barvy
                              // Vezmeme původní ID z první shody v našem setu
                              const originalPartyMatch = partyStats.find(p => formatPartyName(p.party_id) === entry.name);
                              const partyIdForColor = originalPartyMatch ? originalPartyMatch.party_id : entry.name;
                              
                              return (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={getPartyColor(partyIdForColor)}
                                />
                              );
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                );
              })()
            ) : (
              <div className="text-center py-8 text-muted">
                <p>Žádná data o stranách pro toto období</p>
              </div>
            )}
          </div>
        </section>

        {/* Top MPs - interaktivní */}
{/* Top MPs - interaktivní */}
        <section className="top-mps-section mt-8">
          <div className="card h-full">
            <div className="panel-header" style={{ marginBottom: '20px' }}> {/* Větší odstup od filtrů */}
              <h2>Nejaktivnější poslanci</h2>
            </div>
            
            {/* Přepracované filtry pomocí grid layoutu definovaného v global.css */}
            <div className="filters-row mb-6"> 
              
              <div className="filter-group">
                <label>Zobrazení</label>
                <select
                  value={leaderboardView}
                  onChange={(e) => setLeaderboardView(e.target.value)}
                  className="filter-select"
                >
                  <option value="top">Nejlepší účast</option>
                  <option value="bottom">Nejhorší účast</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Počet poslanců</label>
                <select
                  value={leaderboardLimit}
                  onChange={(e) => setLeaderboardLimit(Number(e.target.value))}
                  className="filter-select"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Strana</label>
                <select
                  value={selectedPartyFilter}
                  onChange={(e) => setSelectedPartyFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">Všechny strany</option>
                  {uniqueParties.map(partyId => (
                    <option key={partyId} value={partyId}>{formatPartyName(partyId)}</option>
                  ))}
                </select>
              </div>

            </div>

            {mpsLoading ? (
              <div className="table-wrapper">
                 <table className="data-table">
                   <thead>
                     <tr>
                       <th className="w-12 text-center">#</th>
                       <th>Jméno</th>
                       <th className="w-32">Strana</th>
                       <th className="w-32 text-center">Účast na hlasováních</th>
                       <th className="w-32 text-center">Rozdíl od průměru Sněmovny</th>
                       <th className="w-32 text-center">Rozdíl od politické strany poslance</th>
                     </tr>
                   </thead>
                 </table>
                <div className="table-skeleton">
                  {[...Array(leaderboardLimit)].map((_, i) => (
                    <div key={i} className="skeleton-row mb-3"></div>
                  ))}
                </div>
              </div>
            ) : leaderboardMps.length > 0 ? (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      {/* Přidáno text-center tam, kde chceme zarovnání doprostřed */}
                      <th className="w-12 text-center">#</th>
                      <th>Jméno</th>
                      <th className="w-32">Strana</th>
                      <th className="w-32 text-center">Účast na hlasováních</th>
                      <th className="w-32 text-center">Rozdíl od průměru Sněmovny</th>
                      <th className="w-32 text-center">Rozdíl od politické strany poslance</th>
                    </tr>
                  </thead>
<tbody>
                    {leaderboardMps.map((mp, originalIdx) => {
                      const displayRank = leaderboardView === 'top' ? originalIdx + 1 : `-${originalIdx + 1}`;
                      return (
                        <tr
                          key={mp.mp_id}
                          onClick={() => setSelectedMpId(mp.mp_id)}
                          className="cursor-pointer"
                        >
                          <td className="font-bold text-center">{displayRank}</td>
                          <td>
                            <div className="font-bold">{mp.name}</div>
                          </td>
                          {/* Upravený sloupec "Strana" */}
                          <td>
                            <div className="party-name-cell">
                              <span 
                                className="party-color-dot" 
                                style={{ backgroundColor: getPartyColor(mp.party_id) }}
                              ></span>
                              <span>{mp.party_name}</span>
                            </div>
                          </td>
                          <td className="font-mono text-center">{mp.attendance_pct}%</td>
                          <td className={`text-center ${mp.diffFromAvg >= 0 ? 'text-success' : 'text-danger'}`}>
                            {mp.diffFromAvg > 0 ? '+' : ''}{mp.diffFromAvg}%
                          </td>
                          <td className={`text-center ${mp.diffFromParty >= 0 ? 'text-success' : 'text-danger'}`}>
                            {mp.diffFromParty > 0 ? '+' : ''}{mp.diffFromParty}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted">
                <p>Žádní poslanci neodpovídají filtrům.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {selectedMpId && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedMpId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mp-modal-title"
        >
          <div
            className="modal max-w-3xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="close-btn"
              onClick={() => setSelectedMpId(null)}
              aria-label="Zavřít detail poslance"
            >
              &times;
            </button>
            <h2 id="mp-modal-title" className="sr-only">Detail poslance</h2>
            <MpModal
              mpId={selectedMpId}
              termId={selectedTerm}
              onClose={() => setSelectedMpId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const SummaryCard = ({ title, value, description, icon, loading, highlight = false }) => {
  if (loading) {
    return (
      <div className="card skeleton-card"> {/* Používáme existující styl pro skeleton card z global.css */}
        <div className="flex flex-col h-full justify-between">
          <div>
            <div className="h-4 bg-surface-2 rounded w-3/4 mb-2"></div>
            <div className="h-6 bg-surface-2 rounded w-1/2"></div>
          </div>
          <div className="h-4 bg-surface-2 rounded w-full mt-4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card ${highlight ? 'border-2 border-accent-1 shadow-lg' : ''}`}> {/* Používáme existující styl card z global.css */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted mb-1">{title}</div>
          <div className={`text-3xl font-bold ${highlight ? 'text-accent-1' : 'text-accent-1'}`}>
            {value}
          </div>
        </div>
        <div className="text-2xl" aria-hidden="true">{icon}</div>
      </div>
      <div className="mt-2 text-sm text-muted border-t border-surface-1 pt-2">
        {description}
      </div>
    </div>
  );
};