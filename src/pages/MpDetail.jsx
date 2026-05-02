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

// --- NOVÁ KOMPONENTA PRO ČASOVOU OSU ---
const TimelineComponent = ({ mandatePeriods, partyTimeline }) => {
  // Pomocná funkce pro porovnání dat
  const compareDates = (a, b) => new Date(a) - new Date(b);

  // 1. Zpracování mandatePeriods - přidání "type"
  const mandates = mandatePeriods.map(m => ({
    ...m,
    type: 'mandate',
    start: new Date(m.from),
    end: m.to ? new Date(m.to) : new Date('2099-12-31') // Upravíme "dosud" na vzdálené datum
  }));

  // 2. Zpracování partyTimeline - přidání "type" a úprava "to"
  const parties = partyTimeline.map(p => ({
    ...p,
    type: 'party',
    start: new Date(p.from),
    end: p.to ? new Date(p.to) : new Date('2099-12-31') // Upravíme "dosud" na vzdálené datum
  }));

  // 3. Sloučení a seřazení všech událostí podle data začátku
  const allEvents = [...mandates, ...parties].sort((a, b) => compareDates(a.start, b.start));

  // 4. Sloučení duplicitních záznamů ve stejném období
  const mergedParties = [];
  const seenTerms = new Set(); // Pro sledování zpracovaných období

  for (const event of allEvents) {
    if (event.type === 'party') {
      const termId = event.term_id; // Předpokládáme, že event obsahuje term_id
      const partyId = event.party_id;

      // Pokud je toto období již zpracováno pro tuto stranu, přeskočíme
      const key = `${termId}_${partyId}`;
      if (seenTerms.has(key)) {
        continue;
      }

      // Najdeme všechny záznamy pro stejné období a stejnou stranu
      const sameTermSameParty = parties.filter(p => p.term_id === termId && p.party_id === partyId);

      if (sameTermSameParty.length > 1) {
        // Sloučíme do jednoho intervalu
        const start = new Date(Math.min(...sameTermSameParty.map(p => new Date(p.start))));
        const end = new Date(Math.max(...sameTermSameParty.map(p => new Date(p.end))));
        mergedParties.push({
          ...sameTermSameParty[0], // Použijeme data z prvního záznamu
          start,
          end,
        });
      } else {
        // Pokud je jen jeden záznam, přidáme ho přímo
        mergedParties.push(event);
      }

      // Označíme období jako zpracované pro tuto stranu
      seenTerms.add(key);
    } else {
      // Mandáty přidáme přímo
      mergedParties.push(event);
    }
  }

  // 5. Seřazení sloučených záznamů
  const sortedTimeline = mergedParties.sort((a, b) => compareDates(a.start, b.start));

  // 6. Vykreslení časové osy
  if (sortedTimeline.length === 0) {
    return <div className="timeline-empty">Není dostupná žádná historická data.</div>;
  }

  return (
    <div className="timeline-container">
      <div className="timeline-track vertical">
        {sortedTimeline.map((item, index) => {
          const startDate = item.start.toLocaleDateString('cs-CZ', { year: 'numeric', month: 'short' }).replace(' ', ' ');
          const endDate = item.end.getFullYear() < 2099 ? item.end.toLocaleDateString('cs-CZ', { year: 'numeric', month: 'short' }).replace(' ', ' ') : 'dosud';
          const partyOrTermLabel = item.type === 'party' ? item.party_id.toUpperCase() : `Mandát: ${item.term_id}`;

          return (
            <div key={index} className="timeline-item">
              <div className="timeline-dot"></div>
              <div className="timeline-item-content">
                <div className="timeline-item-left">
                  <div className="timeline-date">{startDate} – {endDate}</div>
                  <div className="timeline-session">{partyOrTermLabel}</div>
                </div>
                <div className="timeline-item-right">
                  <span className={`timeline-badge ${item.type === 'party' ? 'vote-abstain' : 'vote-yes'}`}>
                    {item.type === 'party' ? 'Strana' : 'Mandát'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
// --- KONEC NOVÉ KOMPONENTY ---

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

      {/* Nahrazení původního mp-info-card časovou osou */}
      <div className="card">
        <div className="panel-header">
          <h2>Historie Mandátů a Stranické Příslušnosti</h2>
        </div>
        <TimelineComponent mandatePeriods={mpData.mandate_periods} partyTimeline={mpData.party_timeline} />
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