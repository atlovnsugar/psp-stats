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

// Mapovací funkce pro názvy volebních období
const formatTermName = (termId) => {
  const termMap = {
    '1992-1996': '1. volební období',
    '1996-1998': '2. volební období',
    '1998-2002': '3. volební období',
    '2002-2006': '4. volební období',
    '2006-2010': '5. volební období',
    '2010-2013': '6. volební období',
    '2013-2017': '7. volební období',
    '2017-2021': '8. volební období',
    '2021-2025': '9. volební období',
    '2025-now': '10. volební období',
  };
  return termMap[termId] || termId;
};

// Komponenta pro časovou osu// Komponenta pro časovou osu
// Komponenta pro časovou osu
// Komponenta pro časovou osu
// Komponenta pro časovou osu
const TimelineTrack = ({ mpData }) => {
  const { mandate_periods, party_timeline } = mpData;

  // 0. Agresivní normalizace party_id, která chytí všechny varianty "Nezařazení"
  const getNormalizedPartyId = (partyId) => {
    if (!partyId) return 'Nezařazení';
    
    // Extrémně jednoduchá a silná normalizace pro Nezařazení
    if (partyId.toLowerCase().includes('nezaraz') || partyId.toLowerCase().includes('nezař')) {
      return 'Nezařazení';
    }

    // Pro zbytek stran (ODS, ČSSD atd.)
    const normalized = partyId
      .replace(/CSL/g, 'ČSL')
      .replace(/CSSD/g, 'ČSSD')
      .replace(/-/g, ' ')
      .trim();
    
    return PARTY_NAME_MAP[normalized] || normalized;
  };

  // 1. Zploštění a hrubé seskupení
  const normalizedParties = party_timeline.map(party => ({
    party_id: getNormalizedPartyId(party.party_id),
    from: new Date(party.from).getTime(),
    to: party.to ? new Date(party.to).getTime() : new Date('2099-12-31').getTime(),
    originalFrom: party.from,
    originalTo: party.to
  }));

  const partiesGrouped = {};
  normalizedParties.forEach(party => {
    const id = party.party_id;
    if (!partiesGrouped[id]) partiesGrouped[id] = [];
    partiesGrouped[id].push(party);
  });

  const mergedEvents = [];

  // 2. Matematické sloučení intervalů
  Object.keys(partiesGrouped).forEach(partyId => {
    const intervals = partiesGrouped[partyId].sort((a, b) => a.from - b.from);
    
    let currentStart = intervals[0].from;
    let currentEnd = intervals[0].to;
    let originalFromStr = intervals[0].originalFrom;
    let originalToStr = intervals[0].originalTo;

    for (let i = 1; i < intervals.length; i++) {
      const next = intervals[i];
      if (next.from <= currentEnd) {
        if (next.to > currentEnd) {
          currentEnd = next.to;
          originalToStr = next.originalTo;
        }
      } else {
        mergedEvents.push({
          type: 'party_change',
          party_id: partyId,
          startDate: new Date(currentStart),
          endDate: currentEnd === new Date('2099-12-31').getTime() ? null : new Date(currentEnd),
          from: originalFromStr,
          to: originalToStr
        });
        
        currentStart = next.from;
        currentEnd = next.to;
        originalFromStr = next.originalFrom;
        originalToStr = next.originalTo;
      }
    }
    
    mergedEvents.push({
      type: 'party_change',
      party_id: partyId,
      startDate: new Date(currentStart),
      endDate: currentEnd === new Date('2099-12-31').getTime() ? null : new Date(currentEnd),
      from: originalFromStr,
      to: originalToStr
    });
  });

  const timelineEvents = mergedEvents.sort((a, b) => a.startDate - b.startDate);

  // 3. Výpočet hranic osy
  const allStartDates = [
    ...timelineEvents.map(e => e.startDate),
    ...mandate_periods.map(m => new Date(m.from))
  ];
  const allEndDates = [
    ...timelineEvents.map(e => e.endDate),
    ...mandate_periods.map(m => m.to ? new Date(m.to) : null)
  ];

  const minDate = new Date(Math.min(...allStartDates));
  const validEndDates = allEndDates.filter(d => d !== null);
  const maxDate = new Date(Math.max(...validEndDates, ...allStartDates));

  const hasOpenEnded = allEndDates.some(e => e === null);
  if (hasOpenEnded) {
    const today = new Date();
    if (maxDate < today) {
       maxDate.setTime(today.getTime());
    }
    maxDate.setMonth(maxDate.getMonth() + 6); 
  }

  const totalDurationMs = maxDate - minDate;
  
  // -- DYNAMICKÁ LOGIKA PRO POPISKY --
  // Zjistíme, kolik let osa pokrývá
  const totalYearsSpan = maxDate.getFullYear() - minDate.getFullYear();
  
  // Určíme krok pro popisky roků: 
  // Pokud je to < 8 let, ukazujeme každý rok (1). Pokud 8-15 let, každý druhý rok (2). Nad 15 let každý čtvrtý (4) atd.
  let yearStep = 1;
  if (totalYearsSpan > 20) yearStep = 5;
  else if (totalYearsSpan > 12) yearStep = 4;
  else if (totalYearsSpan > 7) yearStep = 2;

  const years = [];
  for (let y = minDate.getFullYear(); y <= maxDate.getFullYear(); y += yearStep) {
    years.push(y);
  }
  
  // Zjistíme, zda schovat text popisků volebních období (nečáry!), pokud je jich příliš mnoho
  // Pokud je průměrná délka zobrazeného období na ose menší než určitá šířka, raději text schováme (ukážeme ho jako tooltip)
  const showTermLabels = mandate_periods.length <= 5; // Nad 5 období text obvykle překáží

  return (
    <div className="timeline-container">
      <div className="timeline-track horizontal" style={{ overflow: 'visible' }}> 
        
        {/* Indikátory volebních období (nad osou) */}
        <div className="timeline-terms-track" style={{ position: 'relative', height: '24px', marginBottom: '6px' }}>
          {mandate_periods.map((period, index) => {
            const startDate = new Date(period.from);
            const endDate = period.to ? new Date(period.to) : new Date();
            const durationMs = endDate - startDate;
            
            const startPercentage = ((startDate - minDate) / totalDurationMs) * 100;
            const widthPercentage = (durationMs / totalDurationMs) * 100;

            const isLastPeriod = index === mandate_periods.length - 1;

            return (
              <div
                key={`term-${index}`}
                className="timeline-term-block"
                title={`${formatTermName(period.term_id)} (${startDate.getFullYear()} - ${endDate.getFullYear()})`}
                style={{
                  position: 'absolute',
                  left: `${startPercentage}%`,
                  width: `${widthPercentage}%`,
                  height: '50px',
                  borderLeft: '1px dashed var(--text-muted)',
                  borderRight: period.to ? '1px dashed var(--text-muted)' : 'none',
                  display: 'flex',
                  justifyContent: isLastPeriod ? 'flex-start' : 'center',
                  alignItems: 'flex-start',
                  boxSizing: 'border-box',
                  // Přidáme jemný hover efekt na samotný ohraničující blok
                  cursor: 'help'
                }}
              >
                {/* Text období vykreslíme jen, pokud jich není moc, abychom zamezili překrývání */}
                {showTermLabels && (
                  <span className="term-label-text" style={{ 
                    fontSize: '0.70rem', 
                    color: 'var(--text-secondary)', 
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                    padding: '0 4px',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '4px',
                    marginTop: '-4px',
                    marginLeft: isLastPeriod ? '4px' : '0',
                    overflow: 'visible' 
                  }}>
                    {formatTermName(period.term_id)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Časová osa (samotné grafické bloky členství) */}
        <div className="timeline-line">
          {timelineEvents.map((event, index) => {
            const isCurrent = event.endDate === null;
            const endDateForCalculation = isCurrent ? new Date() : event.endDate;
            const durationMs = endDateForCalculation - event.startDate;
            const widthPercentage = (durationMs / totalDurationMs) * 100;
            const startPercentage = ((event.startDate - minDate) / totalDurationMs) * 100;

            const label = event.party_id; 
            
            const colorKey = Object.keys(PARTY_COLORS).find(key => key.toUpperCase() === label.toUpperCase());
            const color = colorKey ? PARTY_COLORS[colorKey] : (PARTY_COLORS['Jiné'] || '#64748b');

            // Pokud je blok velmi úzký (např. < 5% šířky), schováme text uvnitř bloku, aby nelezl ven
            const showSegmentLabel = widthPercentage > 5;

            return (
              <div
                key={`${event.type}-${index}`}
                className="timeline-segment party-segment"
                style={{
                  left: `${startPercentage}%`,
                  width: `${widthPercentage}%`,
                  backgroundColor: color,
                  opacity: isCurrent ? 1.0 : 0.8,
                }}
                title={`${label}: ${event.from} – ${event.to || 'dosud'}`}
              >
                {showSegmentLabel && <span className="segment-label">{label}</span>}
              </div>
            );
          })}
        </div>
        
        {/* Popisky roků (spodní) */}
        <div className="timeline-axis-bottom" style={{ marginTop: '8px' }}>
          {years.map(year => {
             // Výpočet pozice popisku roku (aby nebyl jen v obyčejném flex kontejneru, ale seděl přesně na daném roce)
             const yearDate = new Date(`${year}-01-01`);
             const posPercentage = ((yearDate - minDate) / totalDurationMs) * 100;
             
             // Nevykreslujeme roky, které by 'vypadly' z osy doleva/doprava
             if (posPercentage < 0 || posPercentage > 100) return null;

             return (
              <span 
                key={year} 
                className="timeline-axis-label-bottom"
                style={{
                  position: 'absolute',
                  left: `${posPercentage}%`,
                  transform: 'translateX(-50%)' // Vycentrování na samotnou 'tečku' roku
                }}
              >
                {year}
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