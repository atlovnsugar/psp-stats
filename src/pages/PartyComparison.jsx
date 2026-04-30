// PartyComparison.jsx
import { useEffect, useState } from 'react';
import { useTerm } from '../context/TermContext';
import { fetchJSON } from '../utils/dataCache';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
          const sortedData = [...data].sort((a, b) => b.mps_count - a.mps_count);
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
    <div className="flex justify-center items-center p-12">
      <div className="loader">Načítám data o stranách...</div>
    </div>
  );

  if (error) {
    return (
      <div className="card text-center border-red-200 bg-red-50 p-6" style={{ margin: '1rem' }}>
        <p className="text-red-600 font-bold">{error}</p>
        <p className="text-muted text-sm mt-2">Zkuste vybrat jiné volební období v navigaci.</p>
      </div>
    );
  }

  if (!stats || stats.length === 0) {
    return (
      <div className="card text-center text-muted p-12" style={{ margin: '1rem' }}>
        Pro období {selectedTerm} nebyly nalezeny žádné statistiky stran.
      </div>
    );
  }

  return (
    <div className="space-y-6" style={{ padding: '1rem' }}>
      <header className="card text-center mb-4">
        <h2 className="text-xl font-bold">Porovnání politických stran</h2>
        <p className="text-muted">Volební období: {selectedTerm}</p>
      </header>

      <div className="card mb-4" style={{ minHeight: '450px' }}>
        <h3 className="text-lg font-semibold mb-4 text-center">Průměrná účast v hlasování (%)</h3>
        
        {/* OPRAVA: Kontejner s pevnou výškou zajistí, že se ResponsiveContainer v Canvasu vykreslí */}
        <div style={{ width: '100%', height: '350px', position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={stats} 
              margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
            >
              <XAxis 
                dataKey="party_id" 
                stroke="#888888" 
                fontSize={12}
                tickFormatter={id => id.toUpperCase()}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                unit="%" 
                stroke="#888888" 
                fontSize={12}
                domain={[0, 100]} 
              />
              <Tooltip 
                cursor={{ fill: '#f3f4f6' }}
                contentStyle={{ 
                  borderRadius: '8px', 
                  border: 'none', 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
                }}
                formatter={(v) => [`${v}%`, 'Průměrná účast']} 
              />
              <Bar 
                dataKey="avg_attendance" 
                fill="#2563eb" 
                radius={[4, 4, 0, 0]}
                animationDuration={800}
              >
                {stats.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.avg_attendance > 85 ? '#1d4ed8' : '#3b82f6'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h3 className="text-lg font-semibold mb-4">Statistiky podle stran</h3>
        <table className="data-table w-full text-left">
          <thead>
            <tr className="border-b" style={{ background: '#f8fafc' }}>
              <th className="py-3 px-4 font-semibold uppercase text-xs text-gray-500">Strana</th>
              <th className="py-3 px-4 text-right font-semibold uppercase text-xs text-gray-500">Poslanců</th>
              <th className="py-3 px-4 text-right font-semibold uppercase text-xs text-gray-500">Účast</th>
              <th className="py-3 px-4 text-right font-semibold uppercase text-xs text-gray-500">Jednotnost</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {stats.map(s => (
              <tr key={s.party_id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4 font-bold text-gray-800">{s.party_id.toUpperCase()}</td>
                <td className="py-3 px-4 text-right text-gray-600">{s.mps_count}</td>
                <td className="py-3 px-4 text-right">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                    s.avg_attendance > 85 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {s.avg_attendance}%
                  </span>
                </td>
                <td className="py-3 px-4 text-right text-gray-600">
                  {s.unity_score != null ? (s.unity_score * 100).toFixed(1) + '%' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}