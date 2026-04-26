import { useEffect, useState } from 'react';
import { useTerm } from '../context/TermContext';
import { fetchJSON } from '../utils/dataCache';
import { useMpsMap, useVotingsIndex } from '../context/DataContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import MpModal from '../components/MpModal';

export default function Dashboard() {
  const { selectedTerm } = useTerm();
  const [mpStats, setMpStats] = useState([]);
  const [partyStats, setPartyStats] = useState([]);
  const [votingsCount, setVotingsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedMpId, setSelectedMpId] = useState(null);
  const mpsMap = useMpsMap();
  const votingsIndex = useVotingsIndex();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [stats, party, vIndex] = await Promise.all([
          fetchJSON(`/data/term_${selectedTerm}_mp_stats.json`),
          fetchJSON(`/data/term_${selectedTerm}_party_stats.json`).catch(() => []),
          fetchJSON('/data/votings_index.json')
        ]);
        setMpStats(stats);
        setPartyStats(party);
        setVotingsCount(vIndex.filter(v => v.term_id === selectedTerm).length);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (selectedTerm) load();
  }, [selectedTerm]);

  if (loading) return <div className="loader"></div>;

  const avgOverallAttendance = mpStats.length
    ? (mpStats.reduce((s,m) => s + m.attendance_pct, 0) / mpStats.length).toFixed(1)
    : 0;

  // Party attendance chart data
  const partyChartData = partyStats.length > 0
    ? partyStats.map(p => ({
        name: p.party_id.toUpperCase(),
        prumernaUcast: p.avg_attendance,
        celkovaUcast: p.total_eligible_votes ? ((p.total_attended / p.total_eligible_votes) * 100).toFixed(1) : 0
      })).sort((a, b) => b.prumernaUcast - a.prumernaUcast)
    : [];
  // Top MPs with comparisons
  const topMps = [...mpStats]
    .sort((a,b) => b.attendance_pct - a.attendance_pct)
    .slice(0, 10)
    .map(stat => {
      const mpInfo = mpsMap.get(stat.mp_id) || {};
      const partyAvg = partyStats.find(p => p.party_id === stat.party_id)?.avg_attendance || 0;
      return {
        ...stat,
        name: mpInfo.name || `ID: ${stat.mp_id}`,
        party_name: stat.party_id?.toUpperCase(),
        diffFromAvg: (stat.attendance_pct - avgOverallAttendance).toFixed(1),
        diffFromParty: (stat.attendance_pct - partyAvg).toFixed(1)
      };
    });

  return (
    <div>
      <h2 className="card" style={{textAlign:'center', fontSize:'1.5rem'}}>Přehled období {selectedTerm}</h2>

      {/* Party comparison as first section */}
<div className="card">
        <h2>Účast podle stran</h2>
        {partyChartData.length > 0 ? (
          <div className="chart-container">
            <ResponsiveContainer>
              <BarChart data={partyChartData}>
                <XAxis dataKey="name" stroke="var(--text-secondary)" />
                <YAxis unit="%" stroke="var(--text-secondary)" domain={[0, 100]} />
                <Tooltip formatter={value => `${value}%`} />
                <Bar dataKey="prumernaUcast" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Průměrná účast poslanců" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-muted text-center">Žádná data o stranách pro toto období.</p>
        )}
      </div>

      {/* Summary cards */}
      <div className="card flex-wrap" style={{ justifyContent: 'space-around' }}>
        <div>
          <div className="text-muted">Hlasování</div>
          <div className="font-bold" style={{fontSize:'2rem'}}>{votingsCount}</div>
        </div>
        <div>
          <div className="text-muted">Poslanců</div>
          <div className="font-bold" style={{fontSize:'2rem'}}>{mpStats.length}</div>
        </div>
        <div>
          <div className="text-muted">Průměrná účast</div>
          <div className="font-bold" style={{fontSize:'2rem'}}>{avgOverallAttendance}%</div>
        </div>
      </div>

      {/* Top MPs table with comparisons */}
      <div className="card">
        <h2>Nejaktivnější poslanci (TOP 10)</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th><th>Jméno</th><th>Strana</th><th>Účast</th><th>Rozdíl od průměru</th><th>Rozdíl od strany</th>
            </tr>
          </thead>
          <tbody>
            {topMps.map((mp, idx) => (
              <tr key={mp.mp_id} onClick={() => setSelectedMpId(mp.mp_id)} style={{cursor:'pointer'}}>
                <td>{idx+1}</td>
                <td>{mp.name}</td>
                <td>{mp.party_name}</td>
                <td className="font-mono">{mp.attendance_pct}%</td>
                <td className={mp.diffFromAvg >= 0 ? 'text-success' : 'text-danger'}>{mp.diffFromAvg > 0 ? '+' : ''}{mp.diffFromAvg}%</td>
                <td className={mp.diffFromParty >= 0 ? 'text-success' : 'text-danger'}>{mp.diffFromParty > 0 ? '+' : ''}{mp.diffFromParty}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedMpId && (
        <div className="modal-overlay" onClick={() => setSelectedMpId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedMpId(null)}>&times;</button>
            {/* Reuse MpModal component but adapted */}
            <MpModal mpId={selectedMpId} termId={selectedTerm} onClose={() => setSelectedMpId(null)} />
          </div>
        </div>
      )}
    </div>
  );
}