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
          ? mpStats.reduce((sum, mpStat) => sum + mpStat.attendance_pct, 0) / mpStats.length
          : 0;
        setAvgOverall(overall.toFixed(1));

        const pAvgs = {};
        partyStats.forEach(p => {
          pAvgs[p.party_id] = p.avg_attendance;
        });
        setPartyAvgs(pAvgs);

        const combined = mpStats.map(stat => ({
          ...stat,
          name: mpsMap.get(stat.mp_id)?.name || `ID: ${stat.mp_id}`,
          party_name: stat.party_id?.toUpperCase(),
          diffOverall: (stat.attendance_pct - overall).toFixed(1),
          diffParty: (stat.attendance_pct - (pAvgs[stat.party_id] || 0)).toFixed(1)
        }));

        combined.sort((a, b) => b.attendance_pct - a.attendance_pct);
        setLeaders(combined);
      } catch (e) {
        console.error("Chyba při načítání dat pro žebříček účasti:", e);
      } finally {
        setLoading(false);
      }
    }
    if (selectedTerm) load();
  }, [selectedTerm, mpsMap]);

  if (loading) return <div className="loader-container"><div className="loader">Načítání žebříčku…</div></div>;

  return (
    <div className="app-container">
      <div className="app-header">
        <div>
          <h1>Účast poslanců</h1>
          <p>Období: <span className="term-highlight">{selectedTerm}</span></p>
        </div>
      </div>

      <div className="card stats-summary-card">
        <div className="panel-header">
          <h2>Statistiky</h2>
        </div>
        <div className="stats-summary-content">
          <p>Průměrná účast celkem: <strong>{avgOverall}%</strong></p>
        </div>
      </div>

      <div className="card leaderboard-table-card">
        <div className="panel-header">
          <h2>Žebříček</h2>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Jméno</th>
                <th>Strana</th>
                <th>Účast</th>
                <th>Rozdíl od průměru</th>
                <th>Rozdíl od strany</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((mp, idx) => (
                <tr
                  key={mp.mp_id}
                  onClick={() => navigate(`/poslanci/${mp.mp_id}?term=${selectedTerm}`)} // Přidán parametr term
                  className="clickable-row" // Přidána třída pro efekt
                  style={{ cursor: 'pointer' }} // Inline styl pro kurzor zůstává
                >
                  <td className="rank-cell">{idx + 1}</td>
                  <td className="name-cell">{mp.name}</td>
                  <td className="party-cell">{mp.party_name}</td>
                  <td className="attendance-cell">
                    <span className="attendance-pct">{mp.attendance_pct}%</span>
                  </td>
                  <td className={`diff-cell ${mp.diffOverall >= 0 ? 'positive-diff' : 'negative-diff'}`}>
                    <span className="diff-sign">{mp.diffOverall > 0 ? '+' : ''}</span>
                    <span className="diff-value">{mp.diffOverall}%</span>
                  </td>
                  <td className={`diff-cell ${mp.diffParty >= 0 ? 'positive-diff' : 'negative-diff'}`}>
                    <span className="diff-sign">{mp.diffParty > 0 ? '+' : ''}</span>
                    <span className="diff-value">{mp.diffParty}%</span>
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