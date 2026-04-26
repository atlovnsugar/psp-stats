import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTerm } from '../context/TermContext';
import { fetchJSON } from '../utils/dataCache';
import { useMpsMap } from '../context/DataContext';

export default function AttendanceLeaderboard() {
  const { selectedTerm } = useTerm();
  const [leaders, setLeaders] = useState([]);
  const [avgOverall, setAvgOverall] = useState(0);
  const [partyAvgs, setPartyAvgs] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const mpsMap = useMpsMap();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [mpStats, partyStats] = await Promise.all([
          fetchJSON(`/data/term_${selectedTerm}_mp_stats.json`),
          fetchJSON(`/data/term_${selectedTerm}_party_stats.json`).catch(() => [])
        ]);
        const overall = mpStats.length
          ? mpStats.reduce((s,m) => s + m.attendance_pct, 0) / mpStats.length
          : 0;
        setAvgOverall(overall.toFixed(1));
        const pAvgs = {};
        partyStats.forEach(p => { pAvgs[p.party_id] = p.avg_attendance; });
        setPartyAvgs(pAvgs);

        const combined = mpStats.map(stat => ({
          ...stat,
          name: mpsMap.get(stat.mp_id)?.name || `ID: ${stat.mp_id}`,
          party_name: stat.party_id?.toUpperCase(),
          diffOverall: (stat.attendance_pct - overall).toFixed(1),
          diffParty: (stat.attendance_pct - (pAvgs[stat.party_id] || 0)).toFixed(1)
        }));
        combined.sort((a,b) => b.attendance_pct - a.attendance_pct);
        setLeaders(combined);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (selectedTerm) load();
  }, [selectedTerm, mpsMap]);

  if (loading) return <div className="loader"></div>;

  return (
    <div>
      <h2 className="card" style={{textAlign:'center'}}>Účast poslanců ({selectedTerm})</h2>
      <div className="card" style={{marginBottom:'10px'}}>
        Průměrná účast celkem: <strong>{avgOverall}%</strong>
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th><th>Jméno</th><th>Strana</th><th>Účast</th><th>Rozdíl od průměru</th><th>Rozdíl od strany</th>
            </tr>
          </thead>
          <tbody>
            {leaders.map((mp, idx) => (
              <tr key={mp.mp_id} onClick={() => navigate(`/poslanci/${mp.mp_id}`)} style={{cursor:'pointer'}}>
                <td>{idx+1}</td>
                <td>{mp.name}</td>
                <td>{mp.party_name}</td>
                <td className="font-mono">{mp.attendance_pct}%</td>
                <td className={mp.diffOverall >= 0 ? 'text-success' : 'text-danger'}>
                  {mp.diffOverall > 0 ? '+' : ''}{mp.diffOverall}%
                </td>
                <td className={mp.diffParty >= 0 ? 'text-success' : 'text-danger'}>
                  {mp.diffParty > 0 ? '+' : ''}{mp.diffParty}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}