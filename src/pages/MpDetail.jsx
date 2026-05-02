// src/pages/MpDetail.jsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTerm } from '../context/TermContext';
import { fetchJSON } from '../utils/dataCache';
import { useVotingsIndex } from '../context/DataContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

// Použijeme globální proměnné pro barvy, pokud existují, jinak fallback
const VOTE_COLORS = { 
  yes: 'var(--vote-yes, #22c55e)', 
  no: 'var(--vote-no, #ef4444)', 
  abstain: 'var(--vote-abstain, #eab308)', 
  absent: 'var(--vote-absent, #6b7280)', 
  not_logged: 'var(--text-muted, #9ca3af)' 
};

// Barevné schéma pro strany - používáme globální nebo fallbacky
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
  'Jiné': 'var(--text-muted)', // Použijeme globální proměnnou
  'Nezařazení': 'var(--text-secondary)',
  'Změna 21': '#FF6B6B',
  'Piráti': '#696969',
  // Přidej více barev podle potřeby
};

const DEFAULT_PARTY_COLOR = 'var(--surface-3)'; // Fallback barva

// Pomocná funkce pro formátování názvu strany
const formatPartyName = (partyId) => {
  if (!partyId) return 'Nezařazení';
  const normalized = partyId.replace(/CSL/g, 'ČSL').replace(/CSSD/g, 'ČSSD').replace(/-/g, ' ').trim();
  const mapping = {
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
  return mapping[normalized.toLowerCase()] || normalized.toUpperCase();
};

export default function MpDetail() {
  const { mpId } = useParams();
  const { selectedTerm } = useTerm();
  const [mpData, setMpData] = useState(null);
  const [termStats, setTermStats] = useState(null);
  const [votesData, setVotesData] = useState(null);
  const [avgOverall, setAvgOverall] = useState(0);
  const [avgParty, setAvgParty] = useState(0);
  const votingsIndexMap = useVotingsIndex();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [mpsList, statsList, partyStats, votes] = await Promise.all([
          fetchJSON('/data/mps.json'),
          fetchJSON(`/data/term_${selectedTerm}_mp_stats.json`).catch(() => []),
          fetchJSON(`/data/term_${selectedTerm}_party_stats.json`).catch(() => []),
          fetchJSON(`/data/mps/mp_${mpId}_votes.json`).catch(() => null)
        ]);
        const mp = mpsList.find(m => m.id === parseInt(mpId));
        setMpData(mp || null);
        const stat = Array.isArray(statsList) ? statsList.find(s => s.mp_id === parseInt(mpId)) : null;
        setTermStats(stat);
        setVotesData(votes);

        if (Array.isArray(statsList) && statsList.length > 0) {
          const overall = statsList.reduce((s,m) => s + m.attendance_pct, 0) / statsList.length;
          setAvgOverall(overall.toFixed(1));
          if (stat?.party_id) {
            const pStat = partyStats.find(p => p.party_id === stat.party_id);
            if (pStat) setAvgParty(pStat.avg_attendance.toFixed(1));
          }
        }
      } catch (e) {
        console.error("Chyba při načítání detailu poslance:", e);
      } finally {
        setLoading(false);
      }
    }
    if (mpId) load();
  }, [mpId, selectedTerm]);

  if (loading) return <div className="loader-container"><div className="loader">Načítám detail poslance...</div></div>;
  if (!mpData) return <div className="error-state"><h3>Poslanec nenalezen.</h3><p>ID: {mpId}</p></div>;

  const prepareMonthlyAttendance = () => {
    if (!votesData || !votingsIndexMap) return [];
    const termVotes = votesData.terms[selectedTerm] || [];
    const monthly = {};
    for (const [votingId, code] of termVotes) {
      const idx = votingsIndexMap.get(votingId);
      if (!idx) continue;
      const month = idx.date.substring(0, 7);
      if (!monthly[month]) monthly[month] = { month, eligible: 0, attended: 0 };
      monthly[month].eligible++;
      const vote = ['yes','no','abstain','absent','not_logged'][code];
      if (['yes','no','abstain'].includes(vote)) monthly[month].attended++;
    }
    return Object.values(monthly)
      .map(m => ({ ...m, attendance_pct: m.eligible ? Math.round((m.attended / m.eligible) * 100) : 0 }))
      .sort((a,b) => a.month.localeCompare(b.month));
  };

  const prepareVotePie = () => {
    if (!votesData) return [];
    const termVotes = votesData.terms[selectedTerm] || [];
    const counts = { yes: 0, no: 0, abstain: 0, absent: 0, not_logged: 0 };
    for (const [, code] of termVotes) {
      const vote = ['yes','no','abstain','absent','not_logged'][code];
      counts[vote]++;
    }
    return Object.entries(counts).map(([key, value]) => ({
      name: {yes:'Ano',no:'Ne',abstain:'Zdržel',absent:'Omluven',not_logged:'Nepřihlášen'}[key],
      value,
      color: VOTE_COLORS[key]
    }));
  };

  // --- NOVÁ LOGIKA PRO ČASOVOU OSU ---
  const prepareTimelineData = () => {
    if (!mpData || !mpData.mandate_periods || !mpData.party_timeline) return [];

    // 1. Získání všech unikátních term_id z mandate_periods a party_timeline
    const allTerms = new Set();
    mpData.mandate_periods.forEach(m => allTerms.add(m.term_id));
    mpData.party_timeline.forEach(p => allTerms.add(p.term_id));
    const sortedTerms = Array.from(allTerms).sort(); // Seřazení podle ID (předpokládáme formát YYYY-YYYY)

    // 2. Zpracování mandate_periods
    const mandates = mpData.mandate_periods.map(m => ({
      type: 'mandate',
      term_id: m.term_id,
      from: m.from,
      to: m.to || 'dosud',
      party: null // Mandát sám o sobě nemá stranu
    }));

    // 3. Zpracování party_timeline a spojení opakujících se stran v rámci jednoho term_id
    const processedParties = [];
    const partyTimeline = [...mpData.party_timeline].sort((a, b) => a.from.localeCompare(b.from)); // Seřazení podle data

    let currentTerm = null;
    let currentParty = null;
    let currentFrom = null;
    let currentTo = null;

    partyTimeline.forEach(pt => {
      const termId = pt.term_id;
      const partyId = pt.party_id || 'nezaraz'; // Předpokládáme 'nezaraz' pro nezařazené

      if (termId === currentTerm && partyId === currentParty) {
        // Pokračujeme ve stejném období a stejné straně, aktualizujeme 'to'
        currentTo = pt.to || 'dosud';
      } else {
        // Ukončili jsme předchozí úsek (pokud existoval)
        if (currentTerm !== null) {
          processedParties.push({
            type: 'party',
            term_id: currentTerm,
            from: currentFrom,
            to: currentTo,
            party: currentParty
          });
        }
        // Začínáme nový úsek
        currentTerm = termId;
        currentParty = partyId;
        currentFrom = pt.from;
        currentTo = pt.to || 'dosud';
      }
    });

    // Nezapomeňte na poslední úsek
    if (currentTerm !== null) {
      processedParties.push({
        type: 'party',
        term_id: currentTerm,
        from: currentFrom,
        to: currentTo,
        party: currentParty
      });
    }

    // 4. Spojení mandate a party dat a seřazení podle data
    const allEvents = [...mandates, ...processedParties];
    allEvents.sort((a, b) => {
      // Nejprve podle term_id
      if (a.term_id < b.term_id) return -1;
      if (a.term_id > b.term_id) return 1;
      // Pak podle data od
      if (a.from < b.from) return -1;
      if (a.from > b.from) return 1;
      // Nakonec party před mandate, pokud jsou ve stejném čase
      if (a.type === 'party' && b.type === 'mandate') return -1;
      return 1;
    });

    // 5. Určení vertikálních úrovní
    const timelineData = [];
    const levels = {}; // { term_id: [ { from: '', to: '', party: '', type: '' }, ... ] }

    allEvents.forEach(event => {
      const termId = event.term_id;
      if (!levels[termId]) {
        levels[termId] = [];
      }

      // Najdi první volnou úroveň pro tento term_id a časový úsek
      let levelIndex = 0;
      while (levels[termId][levelIndex]) {
        const existingEvent = levels[termId][levelIndex];
        // Pokud se překrývají, přeskoč na další úroveň
        if (!(event.to < existingEvent.from || event.from > existingEvent.to.replace('dosud', '9999'))) {
          levelIndex++;
        } else {
          break;
        }
      }

      // Přiřaď úroveň a přidej do dat
      const itemWithLevel = { ...event, level: levelIndex };
      levels[termId][levelIndex] = { from: event.from, to: event.to };
      timelineData.push(itemWithLevel);
    });

    // 6. Přidání informací o termínu pro osu (pouze pro zobrazení)
    const timelineWithTerms = timelineData.map(item => ({
      ...item,
      termLabel: item.term_id
    }));

    return timelineWithTerms;
  };

  const timelineData = prepareTimelineData();
  const monthlyData = prepareMonthlyAttendance();
  const pieData = prepareVotePie();

  // Vlastní Tooltip pro Recharts - používá globální styly
  const CustomizedTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={`${entry.dataKey}-${index}`} className="tooltip-item" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="app-container">
      <Link to={`/poslanci?term=${selectedTerm}`} className="back-link">&larr; zpět na žebříček</Link>
      
      <h1 className="mp-detail-title">{mpData.name}</h1> {/* H1 je v globálním stylu */}

      {/* NOVÝ BLOK PRO ČASOVOU OSU */}
      <div className="card mp-info-card">
        <div className="panel-header"> {/* Používáme existující styl z global.css */}
          <h3>Historie mandátu a stranické příslušnosti</h3>
        </div>
        <TimelineTrack data={timelineData} />
      </div>
      {/* KONEC NOVÉHO BLOKU */}

      {termStats && (
        <div className="card mp-stats-card">
          <div className="panel-header">
            <h3>Statistiky pro {selectedTerm}</h3>
          </div>
          <div className="mp-stats-grid">
            <div className="mp-stat-item">
              <span className="stat-label">Účast:</span>
              <span className="stat-value">{termStats.attendance_pct}%</span>
            </div>
            <div className="mp-stat-item">
              <span className="stat-label">Rozdíl od průměru:</span>
              <span className={`stat-value ${termStats.attendance_pct - avgOverall >= 0 ? 'positive-diff' : 'negative-diff'}`}>
                {(termStats.attendance_pct - avgOverall).toFixed(1)}%
              </span>
            </div>
            {avgParty > 0 && (
              <div className="mp-stat-item">
                <span className="stat-label">Rozdíl od strany:</span>
                <span className={`stat-value ${termStats.attendance_pct - avgParty >= 0 ? 'positive-diff' : 'negative-diff'}`}>
                  {(termStats.attendance_pct - avgParty).toFixed(1)}%
                </span>
              </div>
            )}
            <div className="mp-stat-item">
              <span className="stat-label">Loajalita:</span>
              <span className="stat-value">
                {termStats.party_loyalty != null ? (termStats.party_loyalty*100).toFixed(1)+'%' : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )}

      {monthlyData.length > 0 && (
        <div className="card chart-card">
          <div className="panel-header">
            <h3>Vývoj účasti</h3>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <XAxis dataKey="month" stroke="var(--text-secondary)" />
                <YAxis unit="%" domain={[0,100]} stroke="var(--text-secondary)" />
                <Tooltip content={<CustomizedTooltip />} />
                <Bar dataKey="attendance_pct" fill="var(--accent-1)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {pieData.length > 0 && (
        <div className="card chart-card">
          <div className="panel-header">
            <h3>Rozložení hlasů</h3>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {pieData.map((entry, index) => <Cell key={`pie-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<CustomizedTooltip />} />
                <Legend content={<CustomizedLegend />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// NOVÁ KOMPONENTA PRO ČASOVOU OSU
const TimelineTrack = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="timeline-empty">Nenalezena žádná historická data.</div>;
  }

  // Získání unikátních term_id pro horní osu a letopočtů pro spodní osu
  const terms = [...new Set(data.map(d => d.termLabel))].sort();
  const yearsSet = new Set();
  data.forEach(d => {
    const startYear = d.from.split('-')[0];
    const endYear = (d.to === 'dosud' ? new Date().getFullYear().toString() : d.to.split('-')[0]);
    for (let y = parseInt(startYear); y <= parseInt(endYear); y++) {
      yearsSet.add(y.toString());
    }
  });
  const years = Array.from(yearsSet).sort();

  // Výpočet šířky pro každý rok (přibližně)
  const yearWidth = 40; // Např. 40px na rok
  const totalWidth = years.length * yearWidth;

  // Pomocná funkce pro převod data na pozici (v procentech relativně k celkové šířce)
  const getDatePosition = (dateStr) => {
    const year = dateStr.split('-')[0];
    const yearIndex = years.indexOf(year);
    if (yearIndex === -1) return 0; // Nebo vhodná chyba
    return (yearIndex * yearWidth / totalWidth) * 100;
  };

  // Pomocná funkce pro výpočet délky segmentu
  const getSegmentWidth = (from, to) => {
    const fromYear = from.split('-')[0];
    const toYear = (to === 'dosud' ? new Date().getFullYear().toString() : to.split('-')[0]);
    const fromIndex = years.indexOf(fromYear);
    const toIndex = years.indexOf(toYear);

    if (fromIndex === -1 || toIndex === -1) return 0;
    return ((toIndex - fromIndex + 1) * yearWidth / totalWidth) * 100;
  };

  // Seskupení dat podle term_id a úrovně pro vykreslení oddělených řádků
  const groupedData = data.reduce((acc, item) => {
    const key = `${item.term_id}_${item.level}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="timeline-container">
      {/* Horní osa - Volební období */}
      <div className="timeline-term-axis" style={{ width: `${totalWidth}px` }}>
        {terms.map(term => (
          <div key={term} className="axis-label-term" style={{ minWidth: `${(years.length / terms.length) * yearWidth}px` }}>
            {term}
          </div>
        ))}
      </div>

      {/* Samotná časová osa s položkami */}
      <div className="timeline-track vertical" style={{ width: `${totalWidth}px` }}>
        {Object.entries(groupedData).map(([key, items]) => {
          const [termId, level] = key.split('_');
          const topOffset = (parseInt(level) * 60) + 20; // Přibližný offset pro každý řádek (60px výška + 20px mezeru)

          return (
            <div key={key} className="timeline-level" style={{ marginTop: `${topOffset}px` }}>
              {items.map((item, idx) => {
                const left = getDatePosition(item.from);
                const width = getSegmentWidth(item.from, item.to);
                const isMandate = item.type === 'mandate';
                const partyName = isMandate ? 'Mandát' : formatPartyName(item.party);
                const bgColor = isMandate ? 'var(--surface-2)' : (PARTY_COLORS[formatPartyName(item.party)] || DEFAULT_PARTY_COLOR);

                return (
                  <div
                    key={`${item.term_id}-${item.from}-${item.party}-${idx}`}
                    className="timeline-item"
                    style={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: `${width}%`,
                      height: '40px',
                      backgroundColor: bgColor,
                      border: `1px solid ${isMandate ? 'var(--border-color)' : 'transparent'}`,
                      borderRadius: 'var(--radius-xs)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      color: 'var(--text-primary)',
                      zIndex: 10,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'default' // Nepoužíváme interakci
                    }}
                    title={`${partyName}: ${item.from} – ${item.to}`} // Tooltip při najetí
                  >
                    {partyName}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Spodní osa - Roky */}
      <div className="timeline-year-axis" style={{ width: `${totalWidth}px` }}>
        {years.map(year => (
          <div key={year} className="axis-label-year" style={{ minWidth: `${yearWidth}px` }}>
            {year}
          </div>
        ))}
      </div>
    </div>
  );
};

// Vlastní legenda pro Recharts - používá globální styly a barvy
const CustomizedLegend = (props) => {
  const { payload } = props;
  return (
    <ul className="custom-legend">
      {payload.map((entry, index) => (
        <li key={`item-${index}`} className="legend-item">
          <span className="legend-color" style={{ backgroundColor: entry.color }}></span>
          <span className="legend-label">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
};