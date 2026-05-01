// src/pages/AttendanceLeaderboard.jsx
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
        console.error("Chyba při načítání statistik účasti:", e);
      } finally {
        setLoading(false);
      }
    }
    if (selectedTerm) load();
  }, [selectedTerm, mpsMap]);

  if (loading) return <div className="loader-container"><div className="loader">Načítání...</div></div>;

  return (
    <div className="app-container">
      <h2 className="leaderboard-title">Účast poslanců ({selectedTerm})</h2>
      <div className="card avg-overall-card">
        <p className="avg-overall-text">Průměrná účast celkem: <strong className="avg-overall-value">{avgOverall}%</strong></p>
      </div>
      <div className="card leaderboard-table-card">
        <div className="table-wrapper">
          <table className="data-table leaderboard-table">
            <thead>
              <tr>
                <th className="rank-header">#</th>
                <th className="name-header">Jméno</th>
                <th className="party-header">Strana</th>
                <th className="attendance-header">Účast</th>
                <th className="diff-overall-header">Rozdíl od průměru</th>
                <th className="diff-party-header">Rozdíl od strany</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((mp, idx) => (
                <tr key={mp.mp_id} onClick={() => navigate(`/poslanci/${mp.mp_id}`)} className="leaderboard-row">
                  <td className="rank-cell">{idx+1}</td>
                  <td className="name-cell">{mp.name}</td>
                  <td className="party-cell">{mp.party_name}</td>
                  <td className="attendance-cell">
                    <span className="attendance-pct">{mp.attendance_pct}%</span>
                  </td>
                  <td className={`diff-cell ${mp.diffOverall >= 0 ? 'positive-diff' : 'negative-diff'}`}>
                    {mp.diffOverall > 0 ? '+' : ''}{mp.diffOverall}%
                  </td>
                  <td className={`diff-cell ${mp.diffParty >= 0 ? 'positive-diff' : 'negative-diff'}`}>
                    {mp.diffParty > 0 ? '+' : ''}{mp.diffParty}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}