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

// Barevné schéma pro strany - použijeme existující nebo definujeme nové
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
  'Jiné': 'var(--surface-3)', // Fallback
  'Nezařazení': '#4f92f0',
  'Změna 21': '#FF6B6B',
  'Piráti': '#696969'
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

  // --- NOVÁ FUNKCE PRO PŘÍPRAVU DAT PRO ČASOVOU OSU ---
  const prepareTimelineData = () => {
    if (!mpData || !mpData.party_timeline || !mpData.mandate_periods) return [];

    // 1. Získej všechny jedinečné roky z mandate_periods a party_timeline
    const allDates = new Set();
    mpData.mandate_periods.forEach(m => {
      allDates.add(new Date(m.from).getFullYear());
      if (m.to) allDates.add(new Date(m.to).getFullYear());
    });
    mpData.party_timeline.forEach(p => {
      allDates.add(new Date(p.from).getFullYear());
      if (p.to) allDates.add(new Date(p.to).getFullYear());
    });
    const years = Array.from(allDates).sort((a, b) => a - b);

    // 2. Vytvoř pole pro každý rok
    const yearData = years.map(year => ({
      year: year,
      terms: new Set(), // Pro sledování volebních období v daném roce
      parties: [],      // Pro sledování členství ve stranách v daném roce
      levels: {}        // Pro přiřazení každého členství k určité úrovni (řádce)
    }));

    // 3. Projdi mandate_periods a přidej období do příslušných let
    mpData.mandate_periods.forEach(m => {
      const fromYear = new Date(m.from).getFullYear();
      const toYear = m.to ? new Date(m.to).getFullYear() : new Date().getFullYear(); // Pokud není "to", nastav na aktuální rok
      for (let y = fromYear; y <= toYear; y++) {
        const yearObj = yearData.find(yd => yd.year === y);
        if (yearObj) {
          yearObj.terms.add(m.term_id);
        }
      }
    });

    // 4. Projdi party_timeline a seskupuj změny podle období
    const groupedChanges = {};
    mpData.party_timeline.forEach((p, index) => {
      const fromYear = new Date(p.from).getFullYear();
      const termKey = p.term_id; // Seskupuj podle term_id

      if (!groupedChanges[termKey]) {
        groupedChanges[termKey] = [];
      }
      // Přidáme i index pro pořadí, pokud je potřeba
      groupedChanges[termKey].push({...p, originalIndex: index});
    });

    // 5. Zpracuj seskupené změny a přidej je do dat pro osu
    Object.keys(groupedChanges).forEach(termKey => {
      const changes = groupedChanges[termKey];
      // Seřaď podle data (from) - zajistí pořadí změn v rámci období
      changes.sort((a, b) => new Date(a.from) - new Date(b.from));

      let currentParty = null;
      let currentStart = null;

      changes.forEach(change => {
        // Pokud se strana změnila nebo je to první změna v období
        if (currentParty !== change.party_id || currentStart === null) {
          // Pokud už bylo nějaké členství, uzavři ho
          if (currentParty !== null && currentStart !== null) {
            const toYear = new Date(changes.find(c => new Date(c.from) > new Date(currentStart))?.from || change.from).getFullYear();
            const fromYear = new Date(currentStart).getFullYear();
            // Přidáme do levels jako samostatný segment
            for (let y = fromYear; y < toYear; y++) {
                const yearObj = yearData.find(yd => yd.year === y);
                if (yearObj) {
                    const levelKey = `${currentParty}_${termKey}_${currentStart}`;
                    if (!yearObj.levels[levelKey]) {
                        yearObj.levels[levelKey] = { party: currentParty, term: termKey, from: currentStart, to: null };
                    }
                }
            }
            // Upravíme "to" pro poslední rok
            const lastYearObj = yearData.find(yd => yd.year === toYear - 1);
            if (lastYearObj && lastYearObj.levels[levelKey]) {
                lastYearObj.levels[levelKey].to = changes.find(c => new Date(c.from) > new Date(currentStart))?.from || change.from;
            }
          }

          // Zahájíme nové členství
          currentParty = change.party_id;
          currentStart = change.from;
        }
      });

      // Uzavřít poslední členství v tomto období
      if (currentParty !== null && currentStart !== null) {
        const finalChange = changes[changes.length - 1];
        const toYear = finalChange.to ? new Date(finalChange.to).getFullYear() : new Date().getFullYear();
        const fromYear = new Date(currentStart).getFullYear();
        const levelKey = `${currentParty}_${termKey}_${currentStart}`;
        for (let y = fromYear; y <= toYear; y++) {
            const yearObj = yearData.find(yd => yd.year === y);
            if (yearObj) {
                if (!yearObj.levels[levelKey]) {
                    yearObj.levels[levelKey] = { party: currentParty, term: termKey, from: currentStart, to: finalChange.to };
                }
            }
        }
      }
    });

    // 6. Převedeme levels na pole a seřadíme pro vizuální oddělení (např. podle počátečního data)
    yearData.forEach(yd => {
        yd.levelArray = Object.values(yd.levels).sort((a, b) => new Date(a.from) - new Date(b.from));
    });

    return yearData;
  };

  const timelineData = prepareTimelineData();
  const monthlyData = prepareMonthlyAttendance();
  const pieData = prepareVotePie();

  // --- NOVÁ KOMPONENTA PRO ČASOVOU OSU ---
  const TimelineVisualization = () => {
    if (!timelineData || timelineData.length === 0) {
      return <div className="timeline-empty">Nenalezena žádná data pro časovou osu.</div>;
    }

    // Získej všechny unikátní úrovně pro výpočet výšky kontejneru
    const maxLevels = Math.max(...timelineData.map(d => d.levelArray.length), 1);

    return (
      <div className="timeline-container">
        <div className="timeline-track vertical">
          {timelineData.map((dataPoint, index) => (
            <div key={dataPoint.year} className="timeline-item">
              <div className="timeline-dot"></div>
              <div className="timeline-item-content">
                <div className="timeline-item-left">
                  <div className="timeline-date">{dataPoint.year}</div>
                  <div className="timeline-session">
                    {Array.from(dataPoint.terms).join(', ') || 'Není mandát'}
                  </div>
                </div>
                <div className="timeline-item-right">
                  {/* Zobrazíme každou úroveň odděleně */}
                  <div className="party-lines-container" style={{ height: `${maxLevels * 24}px` }}> {/* Přibližně 24px na řádek */}
                    {dataPoint.levelArray.map((levelData, levelIndex) => {
                      const bgColor = PARTY_COLORS[levelData.party.toUpperCase()] || 'var(--surface-3)';
                      return (
                        <div
                          key={`${dataPoint.year}-${levelData.party}-${levelIndex}`}
                          className="party-line-segment"
                          style={{ backgroundColor: bgColor }}
                          title={`${levelData.party} (${levelData.term}): ${levelData.from} - ${levelData.to || 'dosud'}`}
                        ></div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

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
      
      <h1 className="mp-detail-title">{mpData.name}</h1>

      {/* Nahrazená sekce časovou osou */}
      <div className="card mp-timeline-card">
          <div className="panel-header">
              <h3>Historie Mandátů a Stranické Příslušnosti</h3>
          </div>
          <TimelineVisualization />
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