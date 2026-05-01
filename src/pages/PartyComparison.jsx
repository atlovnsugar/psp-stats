// src/pages/PartyComparison.jsx
import { useEffect, useState } from 'react';
import { useTerm } from '../context/TermContext';
import { fetchJSON } from '../utils/dataCache';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Mapping pro názvy stran - podle skutečných politických stran v ČR
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

// Barevné schéma pro strany - používáme barvy z původního design systému
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
const DEFAULT_PARTY_COLOR = 'var(--surface-3)'; // Použijeme barvu z globálního systému

export default function PartyComparison() {
  const { selectedTerm } = useTerm();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!selectedTerm) return;

      setLoading(true);
      setError(null);

      try {
        const url = `/data/term_${selectedTerm}_party_stats.json`;
        const data = await fetchJSON(url);

        if (!Array.isArray(data)) {
          throw new Error('Data pro vybrané období nejsou ve správném formátu.');
        }

        if (isMounted) {
          // OPRAVA: Kopie pole před řazením, aby nedocházelo k chybám u read-only dat (immutable cache)
          // Zároveň přidáme zobrazený název a barvu
          const processedData = data.map(item => ({
            ...item,
            displayName: PARTY_NAME_MAP[item.party_id.toLowerCase()] || item.party_id.toUpperCase(),
            color: PARTY_COLORS[item.party_id.toUpperCase()] || DEFAULT_PARTY_COLOR
          }));
          const sortedData = processedData.sort((a, b) => b.mps_count - a.mps_count);
          setStats(sortedData);
        }
      } catch (e) {
        console.error('PartyComparison error:', e);
        if (isMounted) {
          setError(`Data pro toto období nejsou k dispozici.`);
          setStats([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [selectedTerm]);

  if (loading) return (
    <div className="loader-container">
      <div className="loader">Načítám data o stranách...</div>
    </div>
  );

  if (error) {
    return (
      <div className="error-state">
        <h3>Chyba</h3>
        <p>{error}</p>
        <p className="text-muted">Zkuste vybrat jiné volební období v navigaci.</p>
      </div>
    );
  }

  if (!stats || stats.length === 0) {
    return (
      <div className="error-state">
        <h3>Žádná data</h3>
        <p>Pro období {selectedTerm} nebyly nalezeny žádné statistiky stran.</p>
      </div>
    );
  }

  // Vlastní tooltip pro Recharts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{data.displayName}</p>
          <p className="tooltip-item" style={{ color: data.color }}>
            Průměrná účast: {data.avg_attendance.toFixed(2)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="app-container">
      <header className="card party-comparison-header">
        <h2>Porovnání politických stran</h2>
        <p className="text-muted">Volební období: {selectedTerm}</p>
      </header>

      <div className="card chart-card">
        <div className="panel-header">
          <h3>Průměrná účast v hlasování (%)</h3>
        </div>
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={stats}
              margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
            >
              <XAxis
                dataKey="displayName" // Použijeme displayName místo party_id
                stroke="var(--text-secondary)" // Použijeme barvu z globálního systému
                fontSize={12}
                tickFormatter={id => id} // DisplayName je už formátovaný
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                unit="%"
                stroke="var(--text-secondary)" // Použijeme barvu z globálního systému
                fontSize={12}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="avg_attendance"
                radius={[4, 4, 0, 0]}
                animationDuration={800}
              >
                {stats.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color} // Použijeme specifickou barvu pro stranu
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card table-card">
        <div className="panel-header">
          <h3>Statistiky podle stran</h3>
        </div>
        <div className="table-wrapper">
          <table className="data-table party-stats-table">
            <thead>
              <tr>
                <th>Strana</th>
                <th>Poslanců</th>
                <th>Účast</th>
                <th>Jednotnost</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={s.party_id}>
                  <td className="party-name-cell">
                    <span className="party-color-dot" style={{ backgroundColor: s.color }}></span>
                    {s.displayName}
                  </td>
                  <td className="text-right">{s.mps_count}</td>
                  <td className="text-right">
                    <span className={`attendance-badge ${s.avg_attendance > 85 ? 'high-attendance' : 'medium-attendance'}`}>
                      {s.avg_attendance.toFixed(2)}%
                    </span>
                  </td>
                  <td className="text-right">
                    {s.unity_score != null ? (s.unity_score * 100).toFixed(1) + '%' : '—'}
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