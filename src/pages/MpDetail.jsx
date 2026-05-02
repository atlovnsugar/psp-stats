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
const TimelineTrack = ({ mpData }) => {
  const { mandate_periods, party_timeline } = mpData;

  // Připravíme data pro osu - spojení mandátů a změn stran
  const timelineEvents = [];

  // Přidáme mandáty jako události
  mandate_periods.forEach(period => {
    timelineEvents.push({
      type: 'mandate',
      term_id: period.term_id,
      from: period.from,
      to: period.to || null, // null znamená "dosud"
      startDate: new Date(period.from),
      endDate: period.to ? new Date(period.to) : null, // null znamená "dosud"
    });
  });

  // Přidáme změny stran jako události
  party_timeline.forEach(timelineEntry => {
    timelineEvents.push({
      type: 'party_change',
      party_id: timelineEntry.party_id,
      from: timelineEntry.from,
      to: timelineEntry.to || null,
      startDate: new Date(timelineEntry.from),
      endDate: timelineEntry.to ? new Date(timelineEntry.to) : null,
    });
  });

  // Seřadíme podle počátečního data
  timelineEvents.sort((a, b) => a.startDate - b.startDate);

  // Zjistíme celkový časový rozsah
  const allStartDates = timelineEvents.map(e => e.startDate);
  const allEndDates = timelineEvents.map(e => e.endDate).filter(d => d !== null); // Odfiltrujeme null (dosud)
  const minDate = new Date(Math.min(...allStartDates));
  const maxDate = new Date(Math.max(...allEndDates, ...allStartDates)); // Pokud je nějaké "dosud", použije se aktuální datum jako horní hranice

  // Přidáme "dosud" jako aktuální datum, pokud je v datech nějaké "dosud"
  const hasOpenEnded = timelineEvents.some(e => e.endDate === null);
  if (hasOpenEnded) {
    maxDate.setFullYear(maxDate.getFullYear() + 1); // Přidáme rok jako rezervu pro "dosud"
  }

  // Generování roků pro osu X
  const years = [];
  for (let y = minDate.getFullYear(); y <= maxDate.getFullYear(); y++) {
    years.push(y);
  }

  return (
    <div className="timeline-container">
      <div className="timeline-track horizontal">
        {/* Popisky roků (spodní) */}
        <div className="timeline-axis-bottom">
          {years.map(year => (
            <span key={year} className="timeline-axis-label-bottom">{year}</span>
          ))}
        </div>
        {/* Časová osa */}
        <div className="timeline-line">
          {timelineEvents.map((event, index) => {
            const isCurrent = event.endDate === null; // Značí "dosud"
            const endDateForCalculation = isCurrent ? new Date() : event.endDate; // Pro výpočet délky použijeme aktuální datum
            const durationMs = endDateForCalculation - event.startDate;
            const totalDurationMs = maxDate - minDate;
            const widthPercentage = (durationMs / totalDurationMs) * 100;
            const startPercentage = ((event.startDate - minDate) / totalDurationMs) * 100;

            let label, color;
            if (event.type === 'mandate') {
              label = `Mandát (${event.term_id})`;
              color = 'var(--text-muted)'; // Neutrální barva pro mandát
            } else { // party_change
              label = formatPartyName(event.party_id);
              color = PARTY_COLORS[event.party_id.toUpperCase()] || PARTY_COLORS['Jiné'];
            }

            return (
              <div
                key={`${event.type}-${index}`}
                className={`timeline-segment ${event.type === 'party_change' ? 'party-segment' : 'mandate-segment'}`}
                style={{
                  left: `${startPercentage}%`,
                  width: `${widthPercentage}%`,
                  backgroundColor: color,
                  opacity: isCurrent ? 1.0 : 0.8, // Aktuální segment může být plnější
                }}
                title={`${label}: ${event.from} – ${event.to || 'dosud'}`}
              >
                <span className="segment-label">{label}</span>
              </div>
            );
          })}
        </div>
        {/* Popisky volebních období (horní) */}
        <div className="timeline-axis-top">
          {years.map(year => {
            // Najdeme odpovídající mandát pro daný rok
            const correspondingMandate = mandate_periods.find(m =>
              year >= new Date(m.from).getFullYear() && (m.to ? year <= new Date(m.to).getFullYear() : true)
            );
            return (
              <span key={year} className="timeline-axis-label-top">
                {correspondingMandate ? correspondingMandate.term_id : ''}
              </span>
            );
          })}
        </div>
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