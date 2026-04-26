import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTerm } from '../context/TermContext';
import { fetchJSON } from '../utils/dataCache';
import { useVotingsIndex } from '../context/DataContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const VOTE_COLORS = { yes: '#22c55e', no: '#ef4444', abstain: '#eab308', absent: '#6b7280', not_logged: '#9ca3af' };

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
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (mpId) load();
  }, [mpId, selectedTerm]);

  if (loading) return <div className="loader"></div>;
  if (!mpData) return <div className="card text-center">Poslanec nenalezen.</div>;

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

  return (
    <div>
      <Link to={`/poslanci?term=${selectedTerm}`} className="text-muted">&larr; zpět na žebříček</Link>
      <h1 className="font-bold" style={{fontSize:'2rem', marginTop:'8px'}}>{mpData.name}</h1>

      <div className="card flex-wrap" style={{gap:'20px'}}>
        <div>
          <h3>Mandáty</h3>
          <ul>
            {mpData.mandate_periods.map((p,i) => (
              <li key={i}>{p.term_id}: {p.from} – {p.to || 'dosud'}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Stranická příslušnost</h3>
          <ul>
            {mpData.party_timeline.map((t,i) => (
              <li key={i}>{t.party_id.toUpperCase()}: {t.from} – {t.to || 'dosud'}</li>
            ))}
          </ul>
        </div>
      </div>

      {termStats && (
        <div className="card">
          <h3>Statistiky pro {selectedTerm}</h3>
          <div className="flex-wrap" style={{justifyContent:'space-between'}}>
            <div>Účast: <strong>{termStats.attendance_pct}%</strong></div>
            <div>Rozdíl od průměru: <strong className={termStats.attendance_pct - avgOverall >= 0 ? 'text-success' : 'text-danger'}>
              {(termStats.attendance_pct - avgOverall).toFixed(1)}%
            </strong></div>
            {avgParty > 0 && (
              <div>Rozdíl od strany: <strong className={termStats.attendance_pct - avgParty >= 0 ? 'text-success' : 'text-danger'}>
                {(termStats.attendance_pct - avgParty).toFixed(1)}%
              </strong></div>
            )}
            <div>Loajalita: <strong>{termStats.party_loyalty != null ? (termStats.party_loyalty*100).toFixed(1)+'%' : 'N/A'}</strong></div>
          </div>
        </div>
      )}

      {monthlyData.length > 0 && (
        <div className="card">
          <h3>Vývoj účasti</h3>
          <div className="chart-container">
            <ResponsiveContainer>
              <BarChart data={monthlyData}>
                <XAxis dataKey="month" stroke="var(--text-secondary)" />
                <YAxis unit="%" domain={[0,100]} stroke="var(--text-secondary)" />
                <Tooltip formatter={v=>`${v}%`} />
                <Bar dataKey="attendance_pct" fill="var(--primary)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {pieData.length > 0 && (
        <div className="card">
          <h3>Rozložení hlasů</h3>
          <div className="chart-container">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {pieData.map((entry,i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}