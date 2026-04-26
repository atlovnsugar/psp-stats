// PartyComparison.jsx
import { useEffect, useState } from 'react';
import { useTerm } from '../context/TermContext';
import { fetchJSON } from '../utils/dataCache';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function PartyComparison() {
  const { selectedTerm } = useTerm();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const url = `/data/term_${selectedTerm}_party_stats.json`;
        const data = await fetchJSON(url);
        if (!Array.isArray(data)) throw new Error('Data nejsou pole');
        setStats(data.sort((a, b) => b.mps_count - a.mps_count));
      } catch (e) {
        console.error('PartyComparison error:', e);
        // Zkusíme zobrazit informaci o chybějícím souboru
        setError(`Data pro toto období nejsou k dispozici (${e.message})`);
        setStats([]); // prázdné pole, aby se komponenta vykreslila bez chyby
      } finally {
        setLoading(false);
      }
    }
    if (selectedTerm) load();
  }, [selectedTerm]);

  if (loading) return <div className="loader"></div>;

  if (error) {
    return (
      <div className="card text-center text-danger">
        <p>{error}</p>
        <p className="text-muted">Zkuste vybrat jiné volební období.</p>
      </div>
    );
  }

  if (!stats.length) {
    return <div className="card text-center text-muted">Žádná data pro vybrané období.</div>;
  }

  return (
    <div>
      <h2 className="card text-center">Porovnání stran ({selectedTerm})</h2>
      <div className="card">
        <h3>Průměrná účast</h3>
        <div className="chart-container">
          <ResponsiveContainer>
            <BarChart data={stats}>
              <XAxis dataKey="party_id" stroke="var(--text-secondary)" tickFormatter={id => id.toUpperCase()} />
              <YAxis unit="%" stroke="var(--text-secondary)" domain={[0, 100]} />
              <Tooltip formatter={v => `${v}%`} />
              <Bar dataKey="avg_attendance" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Průměrná účast" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Strana</th>
              <th>Poslanců</th>
              <th>Průměrná účast</th>
              <th>Jednotnost</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(s => (
              <tr key={s.party_id}>
                <td>{s.party_id.toUpperCase()}</td>
                <td>{s.mps_count}</td>
                <td>{s.avg_attendance}%</td>
                <td>{s.unity_score != null ? (s.unity_score * 100).toFixed(1) + '%' : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}