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

// Barevné schéma pro strany - používáme stejné jako v Dashboardu
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

      {/* Timeline místo mp-info-card */}
      <div className="card">
        <div className="panel-header">
          <h3>Historie mandátů a příslušnosti</h3>
        </div>
        <TimelineTrack mpData={mpData} />
      </div>

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

// Komponenta pro časovou osu
// src/pages/MpDetail.jsx (komponenta TimelineTrack je upravena)

// ... (ostatní importy a části komponenty MpDetail.js zůstávají stejné) ...

// Komponenta pro časovou osu - UKÁZKA POUZE ZMĚNY STRANICKÉ PŘÍSLUŠNOSTI
const TimelineTrack = ({ mpData }) => {
  const { party_timeline } = mpData;

  if (!party_timeline || party_timeline.length === 0) {
    return <div className="text-center py-4 text-muted">Nejsou k dispozici data o stranické příslušnosti.</div>;
  }

  // Zjistíme celkový časový rozsah z party_timeline
  const allStartDates = party_timeline.map(t => new Date(t.from));
  const allEndDates = party_timeline.map(t => t.to ? new Date(t.to) : null); // null znamená "dosud"

  const minDate = new Date(Math.min(...allStartDates));
  // Pro maximální datum: pokud je nějaké období "dosud", použijeme aktuální datum, jinak největší 'to'
  const openEndedExists = allEndDates.includes(null);
  const maxDate = openEndedExists ? new Date() : new Date(Math.max(...allEndDates));

  // Pokud je nějaké období "dosud", přidej trochu rezervy pro zobrazení (např. +1 rok)
  if (openEndedExists) {
    const futureDate = new Date(maxDate);
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    // Pro výpočet procent použijeme maxDate jako aktuální datum, ale pro osu můžeme mít rezervu
    // Použijeme futureDate jako referenci pro škálování, ale maxDate pro poslední segment
  }
  const scaleMaxDate = openEndedExists ? new Date(maxDate.getFullYear() + 1, 0, 1) : maxDate; // Použijeme jako referenci pro škálování osy


  // Generování roků pro osu X (od minDate do scaleMaxDate)
  const years = [];
  for (let y = minDate.getFullYear(); y <= scaleMaxDate.getFullYear(); y++) {
    years.push(y);
  }

  // Pomocná funkce pro formátování data
  const formatDate = (dateString) => {
    if (!dateString) return 'dosud';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('cs-CZ', { year: 'numeric', month: 'short' }).replace(' ', ' ');
  };

  return (
    <div className="timeline-container">
      {/* Horní popiska - volební období (odvozeno od let) */}
      {/* Jednoduchý příklad: předpokládejme období jako 2017-2021, 2021-2025, atd. */}
      {/* Můžeš chtít přidat statický mapping nebo načíst z externího zdroje */}
      {/* Prozatím ukážeme roky jako proxy pro období */}
      <div className="timeline-axis-labels-top">
        {years.map(year => {
          // Příklad: přiřazení volebního období na základě roku
          // Toto je zjednodušení, můžeš to upravit podle potřeby
          let termLabel = '';
          if (year >= 2013 && year <= 2017) termLabel = '2013-2017';
          else if (year >= 2017 && year <= 2021) termLabel = '2017-2021';
          else if (year >= 2021 && year <= 2025) termLabel = '2021-2025';
          else if (year >= 2025 && year <= 2029) termLabel = '2025-2029';
          else termLabel = `${year}-${year+4}`; // Obecné generování, pokud není specifikováno
          return (
            <span key={`top-${year}`} className="timeline-term-label" style={{ flex: 1 }}>
              {termLabel}
            </span>
          );
        })}
      </div>

      {/* Časová osa */}
      <div className="timeline-track horizontal">
        <div className="timeline-axis-line"></div> {/* Základní čára osy */}
        {party_timeline.map((entry, index) => {
          const startDate = new Date(entry.from);
          const endDate = entry.to ? new Date(entry.to) : new Date(); // Pro "dosud" použijeme aktuální datum
          const durationMs = endDate - startDate;
          const totalDurationMs = scaleMaxDate - minDate; // Použijeme scaleMaxDate pro škálování
          const widthPercentage = (durationMs / totalDurationMs) * 100;
          const startPercentage = ((startDate - minDate) / totalDurationMs) * 100;

          const displayName = PARTY_NAME_MAP[entry.party_id.toLowerCase()] || entry.party_id.toUpperCase();
          const color = PARTY_COLORS[displayName] || 'var(--surface-3)'; // Fallback barva

          return (
            <div
              key={`party-${index}`}
              className="timeline-segment"
              style={{
                left: `${startPercentage}%`,
                width: `${widthPercentage}%`,
                backgroundColor: color,
                opacity: 0.85,
              }}
              title={`${displayName}: ${formatDate(entry.from)} – ${formatDate(entry.to)}`}
            >
              <span className="timeline-segment-label">{displayName}</span>
            </div>
          );
        })}
      </div>

      {/* Dolní popiska - roky */}
      <div className="timeline-axis-labels-bottom">
        {years.map(year => (
          <span key={`bottom-${year}`} className="timeline-year-label" style={{ flex: 1 }}>
            {year}
          </span>
        ))}
      </div>
    </div>
  );
};

// ... (ostatní části komponenty MpDetail.js zůstávají stejné) ...


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