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

// Barevné schéma pro strany - použijeme globální nebo vytvoříme nové specifické pro časovou osu
// Pokud existují globální proměnné pro barvy stran, použijeme je.
// Jinak můžeme definovat lokální mapování.
// Např. z globálního dashboardu:
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

// Příklad barev pro časovou osu (může být jiné než v grafu)
const PARTY_TIMELINE_COLORS = {
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
  'Piráti': '#696969',
  // Přidáme i další, které se mohou objevit
  'Nezařazení (SZ)': '#4f92f0',
  'US-DEU': '#64748b',
  'US': '#64748b',
  'VV': '#64748b',
  'ODA': '#64748b',
  'SPR-RSČ': '#64748b',
  'Úsvit': '#64748b',
  'TOP 09-STAN': '#6600a1',
  'Motoristé': '#64748b'
};

// Základní fallback pro neznámé strany
const DEFAULT_PARTY_COLOR = 'var(--surface-3)'; // Použijeme barvu z globálního systému


// Pomocná funkce pro formátování názvů stran
const formatPartyName = (partyId) => {
  if (!partyId) return 'Nezařazení';
  const normalized = partyId
    .replace(/CSL/g, 'ČSL')
    .replace(/CSSD/g, 'ČSSD')
    .replace(/-/g, ' ')
    .trim();
  return PARTY_NAME_MAP[normalized] || normalized.toUpperCase();
};

// Pomocná funkce pro získání barvy strany
const getPartyColor = (partyId) => {
  const name = formatPartyName(partyId);
  return PARTY_TIMELINE_COLORS[name] || DEFAULT_PARTY_COLOR;
};

// Pomocná funkce pro sloučení změn strany v rámci jednoho období
const mergePartyTimelineWithinTerms = (partyTimeline, mandatePeriods) => {
  if (!partyTimeline || partyTimeline.length === 0) return [];

  const mergedTimeline = [];
  let currentTerm = null;
  let currentParty = null;
  let currentStart = null;

  // Projdeme timeline chronologicky
  [...partyTimeline].sort((a, b) => new Date(a.from) - new Date(b.from)).forEach(timelineEntry => {
    const entryStart = new Date(timelineEntry.from);
    // Najdeme, do kterého mandátu patří
    const term = mandatePeriods.find(m => new Date(m.from) <= entryStart && (!m.to || new Date(m.to) >= entryStart));

    if (!term) {
      // Pokud neodpovídá žádnému známému mandátu, přidáme jako samostatný záznam
      mergedTimeline.push({
        party_id: timelineEntry.party_id,
        from: timelineEntry.from,
        to: timelineEntry.to || null,
        term_id: 'Neznámé období'
      });
      return;
    }

    const termId = term.term_id;

    // Pokud jsme v novém období
    if (termId !== currentTerm) {
      // Pokud byl předchozí záznam aktivní, uzavřeme ho
      if (currentTerm && currentParty && currentStart) {
        mergedTimeline.push({
          party_id: currentParty,
          from: currentStart,
          to: null, // Zatím neuzavřeno, bude uzavřeno při přechodu na novou stranu nebo období
          term_id: currentTerm
        });
      }
      // Resetujeme pro nové období
      currentTerm = termId;
      currentParty = timelineEntry.party_id;
      currentStart = timelineEntry.from;
    } else {
      // Jsme ve stejném období
      // Pokud se změnila strana
      if (timelineEntry.party_id !== currentParty) {
        // Uzavřeme předchozí záznam na den před začátkem nového
        // POZNÁMKA: Pro přesnost by bylo lepší mít `to` záznamu, který končí, ale pokud není, uzavřeme ho na datum nového začátku.
        // Zjednodušíme: uzavřeme na den před začátek nového záznamu, pokud je to možné, jinak stejný den.
        // Nejjednodušší způsob je uzavřít na 'from' nového záznamu a začít nový.
        if (currentParty && currentStart) {
            mergedTimeline.push({
              party_id: currentParty,
              from: currentStart,
              to: timelineEntry.from, // Uzavřeme na začátek nového období
              term_id: currentTerm
            });
        }
        // Začneme nový záznam
        currentParty = timelineEntry.party_id;
        currentStart = timelineEntry.from;
      }
      // Pokud se strana nezměnila, neděláme nic, jen pokračujeme
    }
  });

  // Uzavřeme poslední záznam
  if (currentTerm && currentParty && currentStart) {
    mergedTimeline.push({
      party_id: currentParty,
      from: currentStart,
      to: null, // Zůstane null, pokud je to poslední záznam a 'dosud'
      term_id: currentTerm
    });
  }

  // Teď provedeme sloučení stejných stran v rámci stejného období
  const finalMerged = [];
  mergedTimeline.forEach(entry => {
    const lastEntry = finalMerged[finalMerged.length - 1];
    if (lastEntry && lastEntry.term_id === entry.term_id && lastEntry.party_id === entry.party_id) {
      // Sloučíme: rozšíříme `to` posledního záznamu
      // Pokud má nový záznam `to`, použijeme jeho `to`, pokud je pozdější
      if (entry.to && (!lastEntry.to || new Date(entry.to) > new Date(lastEntry.to))) {
          lastEntry.to = entry.to;
      }
      // Pokud nový záznam nemá `to` (dosud), a poslední také nemá, nebo má dříve, aktualizujeme
      if (!entry.to && (!lastEntry.to || new Date(lastEntry.to) < new Date(entry.from))) {
          // V tomto případě, pokud předchozí měl `to`, ale aktuální nemá a začíná později, je to chyba nebo mezera.
          // Zjednodušíme: pokud aktuální nemá `to`, znamená to, že je to poslední známý stav v období.
          // Takže pokud je aktuální `from` po posledním `to`, je to nový interval.
          // Ale pokud aktuální `from` je stejný nebo blízko posledního `to`, můžeme sloučit.
          // Nejbezpečnější způsob je: Pokud se strana shoduje a období je stejné, ponecháme `to` posledního záznamu nebo jej aktualizujeme na null, pokud aktuální nemá `to`.
          // Zjednodušíme: Pokud aktuální nemá `to`, ponecháme `to` posledního, pokud tam bylo. Pokud neměl ani poslední `to`, necháme tak.
          // Pokud aktuální nemá `to`, znamená to, že je to poslední známý stav. Pokud poslední měl `to`, aktualizujeme na null.
          if (lastEntry.to) {
              lastEntry.to = null; // Poslední záznam v řadě stejné strany v období nemá `to` = dosud
          }
      }
    } else {
      // Jinak přidáme nový záznam
      finalMerged.push({...entry});
    }
  });

  return finalMerged;
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

  // Výpočet sloučené časové osy
  const mergedTimeline = mpData.party_timeline ? mergePartyTimelineWithinTerms(mpData.party_timeline, mpData.mandate_periods) : [];

  return (
    <div className="app-container">
      <Link to={`/poslanci?term=${selectedTerm}`} className="back-link">&larr; zpět na žebříček</Link>
      
      <h1 className="mp-detail-title">{mpData.name}</h1> {/* H1 je v globálním stylu */}

      {/* Nahrazení mp-info-card časovou osou */}
      <div className="card timeline-card">
        <div className="panel-header">
          <h2>Politická kariéra</h2>
        </div>
        <TimelineVisualization timelineData={mergedTimeline} mandateData={mpData.mandate_periods} />
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

// Komponenta pro vizualizaci časové osy
const TimelineVisualization = ({ timelineData, mandateData }) => {
  if (!timelineData || timelineData.length === 0) {
    return (
      <div className="timeline-container">
        <div className="timeline-empty">Žádná historická data o příslušnosti k politickým stranám.</div>
      </div>
    );
  }

  // Seznam všech unikátních volebních období, seřazených chronologicky
  const uniqueMandates = [...new Set(mandateData.map(m => m.term_id))].sort(); // Předpokládá, že term_id lze seřadit lexikograficky

  // Vytvoříme strukturu pro každé období
  const timelineStructure = uniqueMandates.map(termId => {
    const termInfo = mandateData.find(m => m.term_id === termId);
    const periodsInTerm = timelineData.filter(t => t.term_id === termId);
    return { termId, period: termInfo, entries: periodsInTerm };
  });

  return (
    <div className="timeline-container">
      <div className="timeline-track vertical">
        {timelineStructure.map((termStruct, termIndex) => (
          <div key={`term-${termStruct.termId}`} className="timeline-term-block">
            {/* Oddělovač pro období */}
            <div className="timeline-item">
              <div className="timeline-dot timeline-term-dot"></div>
              <div className="timeline-item-content">
                <div className="timeline-item-left">
                  <div className="timeline-date">{termStruct.termId}</div>
                  <div className="timeline-session">({termStruct.period?.from} – {termStruct.period?.to || 'dosud'})</div>
                </div>
              </div>
            </div>

            {/* Položky pro jednotlivé období */}
            {termStruct.entries.map((entry, entryIndex) => {
              const startDate = entry.from ? new Date(entry.from).toLocaleDateString('cs-CZ', { year: 'numeric', month: 'short' }).replace('~', '') : 'Datum neznámo';
              const endDate = entry.to ? new Date(entry.to).toLocaleDateString('cs-CZ', { year: 'numeric', month: 'short' }).replace('~', '') : 'dosud';
              const partyName = formatPartyName(entry.party_id);
              const partyColor = getPartyColor(entry.party_id);

              return (
                <div key={`entry-${termIndex}-${entryIndex}`} className="timeline-item">
                  <div className="timeline-dot" style={{ backgroundColor: partyColor }}></div>
                  <div className="timeline-item-content">
                    <div className="timeline-item-left">
                      <div className="timeline-date">{startDate} – {endDate}</div>
                      <div className="timeline-session">Volební období: {entry.term_id}</div>
                    </div>
                    <div className="timeline-item-right">
                      <span className="timeline-badge" style={{ backgroundColor: `${partyColor}20`, color: partyColor, border: `1px solid ${partyColor}40` }}>
                        {partyName}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};