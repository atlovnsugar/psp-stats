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

  if (loading) return (
    <div className="app-layout relative">
      <div className="bg-animation">
        <div className="orb"></div>
        <div className="orb"></div>
        <div className="orb"></div>
      </div>
      <div className="loader-container relative z-10"><div className="loader">Načítání...</div></div>
    </div>
  );

  return (
    <div className="app-layout relative">
      {/* PŘIDÁNO: Animované pozadí */}
      <div className="bg-animation">
        <div className="orb"></div>
        <div className="orb"></div>
        <div className="orb"></div>
      </div>

      {/* PŘIDÁNO: Z-index a relative positioning pro obsah nad pozadím */}
      <div className="relative z-10">
        <h2 className="leaderboard-title">Účast poslanců ({selectedTerm})</h2>
        <div className="card avg-overall-card">
          <p className="avg-overall-text">Průměrná účast celkem: <strong className="avg-overall-value">{avgOverall}%</strong></p>
        </div>
        <div className="card leaderboard-table-card">
          <div className="table-wrapper">
            <table className="data-table leaderboard-table">
              <thead>
                <tr>
                  <th className="rank-header text-center">#</th>
                  <th className="name-header">Jméno</th>
                  <th className="party-header">Strana</th>
                  <th className="attendance-header text-center">Účast</th>
                  <th className="diff-overall-header text-center">Rozdíl od průměru</th>
                  <th className="diff-party-header text-center">Rozdíl od strany</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((mp, idx) => (
                  <tr key={mp.mp_id} onClick={() => navigate(`/poslanci/${mp.mp_id}`)} className="leaderboard-row cursor-pointer">
                    <td className="rank-cell font-bold text-center">{idx+1}</td>
                    <td className="name-cell font-bold">{mp.name}</td>
                    <td className="party-cell">{mp.party_name}</td>
                    <td className="attendance-cell font-mono">
                      <span className="attendance-pct">{mp.attendance_pct}%</span>
                    </td>
                    <td className={`diff-cell text-center ${mp.diffOverall >= 0 ? 'text-success' : 'text-danger'}`}>
                      {mp.diffOverall > 0 ? '+' : ''}{mp.diffOverall}%
                    </td>
                    <td className={`diff-cell text-center ${mp.diffParty >= 0 ? 'text-success' : 'text-danger'}`}>
                      {mp.diffParty > 0 ? '+' : ''}{mp.diffParty}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}