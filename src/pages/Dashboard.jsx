// src/pages/Dashboard.jsx
import { useEffect, useState, useMemo } from 'react';
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

// TODO: [2026-04-22] Přidat další strany do mappingu podle nových dat
// TODO: [2026-04-25] Implementovat možnost konfigurace mappingu přes API

// Barevné schéma pro strany - používáme barvy z původního design systému
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

// TODO: [2026-04-20] Přidat fallback pro neznámé strany s ikonkou otazníku
// TODO: [2026-04-22] Implementovat lokalizované názvy pro různá volební období

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

  const topMps = useMemo(() => {
    if (!mpStats.length) return [];
    
    return [...mpStats]
      .sort((a, b) => b.attendance_pct - a.attendance_pct)
      .slice(0, 10)
      .map(stat => {
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
  }, [mpStats, mpsMap, avgOverallAttendance]);

  if (overallLoading && !mpStats.length && !partyStats.length) {
    return (
      <div className="app-layout">
        {/* Background animation z původního designu */}
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

  return (
    <div className="app-layout relative">
      {/* Background animation z původního designu */}
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

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative z-10">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
        {/* Party comparison */}
        <section className="party-section">
          <div className="card h-full">
            <div className="card-header flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Účast podle stran</h2>
              <span className="text-sm text-muted">
                {partyStats.length} {partyStats.length === 1 ? 'strana' : 'strany'}
              </span>
            </div>
            
            {partyLoading ? (
              <div className="chart-skeleton h-[300px]"></div>
            ) : partyStats.length > 0 ? (
              <div className="chart-container h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={partyStats.map(p => ({
                      name: formatPartyName(p.party_id),
                      prumernaUcast: p.avg_attendance,
                      celkovaUcast: p.total_eligible_votes ? 
                        ((p.total_attended / p.total_eligible_votes) * 100).toFixed(1) : 0
                    }))}
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
                    <Tooltip 
                      formatter={(value, name) => [
                        `${value.toFixed(1)}%`,
                        name === 'prumernaUcast' ? 'Průměrná účast' : 'Celková účast'
                      ]}
                      labelStyle={{ color: 'var(--text-primary)' }}
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-secondary)', 
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius)'
                      }}
                    />
                    <Bar 
                      dataKey="prumernaUcast" 
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    >
                      {partyStats.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={getPartyColor(entry.party_id)} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-muted">
                <p>Žádná data o stranách pro toto období</p>
              </div>
            )}
          </div>
        </section>

        {/* Top MPs */}
        <section className="top-mps-section">
          <div className="card h-full">
            <div className="card-header flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Nejaktivnější poslanci</h2>
              <span className="text-sm text-muted">TOP 10</span>
            </div>
            
            {mpsLoading ? (
              <div className="table-skeleton">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="skeleton-row mb-3"></div>
                ))}
              </div>
            ) : topMps.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="data-table min-w-full">
                  <thead>
                    <tr>
                      <th className="w-12">#</th>
                      <th>Jméno</th>
                      <th className="w-24">Strana</th>
                      <th className="w-24">Účast</th>
                      <th className="w-32">Rozdíl od průměru</th>
                      <th className="w-32">Rozdíl od strany</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topMps.map((mp, idx) => (
                      <tr 
                        key={mp.mp_id} 
                        onClick={() => setSelectedMpId(mp.mp_id)}
                        className="cursor-pointer hover:bg-surface-1 transition-colors"
                        aria-label={`Zobrazit detail poslance ${mp.name}`}
                      >
                        <td className="font-bold text-center">{idx + 1}</td>
                        <td>
                          <div className="font-bold">{mp.name}</div>
                        </td>
                        <td>
                          <span 
                            className="party-badge inline-block px-2 py-1 rounded text-xs font-semibold"
                            style={{ 
                              backgroundColor: `${getPartyColor(mp.party_id)}20`, 
                              color: getPartyColor(mp.party_id),
                              border: `1px solid ${getPartyColor(mp.party_id)}40`
                            }}
                          >
                            {mp.party_name}
                          </span>
                        </td>
                        <td className="font-mono text-center">{mp.attendance_pct}%</td>
                        <td className={`text-center ${mp.diffFromAvg >= 0 ? 'text-success' : 'text-danger'}`}>
                          {mp.diffFromAvg > 0 ? '+' : ''}{mp.diffFromAvg}%
                        </td>
                        <td className={`text-center ${mp.diffFromParty >= 0 ? 'text-success' : 'text-danger'}`}>
                          {mp.diffFromParty > 0 ? '+' : ''}{mp.diffFromParty}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted">
                <p>Žádní poslanci k zobrazení</p>
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
      <div className="card animate-pulse">
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
    <div className={`card transition-all ${highlight ? 'border-2 border-accent-1 shadow-lg' : ''}`}>
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

// TODO: [2026-04-20] Přidat skeleton loading pro grafy
// TODO: [2026-04-25] Přidat možnost exportu dat do CSV
// TODO: [2026-04-28] Implementovat filtrování podle stran