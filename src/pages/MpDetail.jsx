// src/pages/MpDetail.jsx
import { useEffect, useState, useMemo } from 'react';
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

// Mapping pro názvy stran - použijeme stejné jako v jiných komponentách
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

// Barevné schéma pro strany - použijeme stejné jako v jiných komponentách
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

// Základní fallback pro neznámé strany
const DEFAULT_PARTY_COLOR = 'var(--surface-3)';

// Pomocná funkce pro formátování názvu strany
const formatPartyName = (partyId) => {
  if (!partyId) return 'Nezařazení';
  const normalized = partyId
    .replace(/CSL/g, 'ČSL')
    .replace(/CSSD/g, 'ČSSD')
    .replace(/-/g, ' ')
    .trim();
  return PARTY_NAME_MAP[normalized] || normalized;
};

// Pomocná funkce pro získání barvy strany
const getPartyColor = (partyId) => {
  const name = formatPartyName(partyId);
  return PARTY_COLORS[name] || DEFAULT_PARTY_COLOR;
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

  // Memoizace zpracovaných dat pro časovou osu
  const timelineData = useMemo(() => {
    if (!mpData || !mpData.party_timeline || !mpData.mandate_periods) return [];

    // Kombinujeme party_timeline a mandate_periods
    // Nejprve zpracujeme party_timeline
    let timelineEvents = [...mpData.party_timeline].map(t => ({
      type: 'party',
      party_id: t.party_id,
      from: t.from,
      to: t.to || '2026-05-02' // Použijeme aktuální datum jako "dosud"
    }));

    // Pak přidáme mandate_periods jako události
    const mandateEvents = mpData.mandate_periods.map(m => ({
      type: 'mandate',
      term_id: m.term_id,
      from: m.from,
      to: m.to || '2026-05-02'
    }));

    timelineEvents = [...timelineEvents, ...mandateEvents];

    // Seřadíme všechny události podle data 'from'
    timelineEvents.sort((a, b) => new Date(a.from) - new Date(b.from));

    // Zjednodušíme data v rámci stejného term_id a party_id, pokud se překrývají nebo jdou bezprostředně za sebou
    const simplifiedTimeline = [];
    timelineEvents.forEach(event => {
      const lastEvent = simplifiedTimeline[simplifiedTimeline.length - 1];
      if (lastEvent &&
          lastEvent.type === event.type &&
          lastEvent.party_id === event.party_id && // Pro party
          lastEvent.term_id === event.term_id && // Pro mandate
          new Date(lastEvent.to) >= new Date(event.from)) {
        // Sloučíme - prodloužíme 'to' poslední události
        lastEvent.to = event.to > lastEvent.to ? event.to : lastEvent.to;
      } else {
        simplifiedTimeline.push({...event});
      }
    });

    // Nyní seskupíme podle typu a v rámci typu podle party_id/term_id a přidáme úroveň (level)
    const grouped = { party: [], mandate: [] };
    simplifiedTimeline.forEach(event => {
        const key = event.type === 'party' ? event.party_id : event.term_id;
        if (!grouped[event.type][key]) {
            grouped[event.type][key] = [];
        }
        grouped[event.type][key].push(event);
    });

    // Přiřadíme úroveň (level) každé události v rámci její skupiny
    const finalTimeline = [];
    Object.keys(grouped).forEach(type => {
        Object.keys(grouped[type]).forEach(key => {
            const eventsForGroup = grouped[type][key];
            eventsForGroup.forEach((event, index) => {
                finalTimeline.push({
                    ...event,
                    level: index // Každá změna ve skupině dostane vyšší level
                });
            });
        });
    });

    // Seřadíme finálně podle data 'from'
    return finalTimeline.sort((a, b) => new Date(a.from) - new Date(b.from));
  }, [mpData]);

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

  // Vykreslení časové osy
  const renderTimeline = () => {
    if (!timelineData || timelineData.length === 0) {
      return <div className="timeline-empty">Není dostupná žádná historická data.</div>;
    }

    // Určíme minimální a maximální datum pro škálování osy
    const dates = timelineData.flatMap(event => [new Date(event.from), new Date(event.to)]);
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const totalMonths = (maxDate.getFullYear() - minDate.getFullYear()) * 12 + (maxDate.getMonth() - minDate.getMonth());

    // Určíme počet unikátních úrovní (levels) pro vertikální řazení
    const maxLevel = Math.max(...timelineData.map(e => e.level), 0);

    return (
      <div className="timeline-container">
        <div className="timeline-track vertical">
          {/* Vykreslení hlaviček pro období a roky */}
          <div className="timeline-header">
            <div className="timeline-periods">
              {/* Tady by mohl být dynamický seznam období, zatím pevně daný */}
              {/* Například extrahujeme všechna unikátní období z timelineData */}
              {Array.from(new Set(timelineData.filter(e => e.type === 'mandate').map(e => e.term_id))).sort().map(term => (
                <span key={term} className="timeline-period-label">{term}</span>
              ))}
            </div>
            <div className="timeline-years">
              {/* Dynamicky vygenerujeme roky mezi min a max datem */}
              {Array.from({ length: maxDate.getFullYear() - minDate.getFullYear() + 1 }, (_, i) => minDate.getFullYear() + i).map(year => (
                <span key={year} className="timeline-year-label">{year}</span>
              ))}
            </div>
          </div>

          {/* Vykreslení událostí */}
          {timelineData.map((event, index) => {
            const startDate = new Date(event.from);
            const endDate = new Date(event.to);
            const startMonthOffset = (startDate.getFullYear() - minDate.getFullYear()) * 12 + (startDate.getMonth() - minDate.getMonth());
            const durationMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1; // +1 pro inkluzivní konec

            const leftPercent = (startMonthOffset / totalMonths) * 100;
            const widthPercent = (durationMonths / totalMonths) * 100;
            const topPercent = (event.level / (maxLevel + 1)) * 100; // +1 aby nebyl 0 při jedné úrovni

            return (
              <div
                key={index}
                className={`timeline-item ${event.type === 'party' ? 'timeline-party-item' : 'timeline-mandate-item'}`}
                style={{
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  top: `${topPercent}%`,
                  height: '20px', // Pevná výška pro každý segment
                  position: 'absolute',
                  backgroundColor: event.type === 'party' ? getPartyColor(event.party_id) : 'var(--text-muted)',
                  borderRadius: '4px',
                  border: '1px solid var(--bg-primary)', // Ohraničení pro lepší odlišení
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  color: 'white', // Bílý text pro lepší čitelnost
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {event.type === 'party' ? formatPartyName(event.party_id) : event.term_id}
              </div>
            );
          })}
        </div>
      </div>
    );
  };


  return (
    <div className="app-container">
      <Link to={`/poslanci?term=${selectedTerm}`} className="back-link">&larr; zpět na žebříček</Link>
      
      <h1 className="mp-detail-title">{mpData.name}</h1>

      <div className="card mp-info-card">
        <div className="mp-info-section">
          <h3>Historie Mandátů a Stranické Příslušnosti</h3>
          {renderTimeline()}
        </div>
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
            <h3>Vývoj Účasti</h3>
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
            <h3>Rozložení Hlasů</h3>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {pieData.map((entry, index) => <Cell key={`pie-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<CustomizedTooltip />} />
                <Legend content={CustomizedLegend} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}