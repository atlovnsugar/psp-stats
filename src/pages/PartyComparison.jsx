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
    let isMounted = true; // Pojistka proti závodům (race conditions) při rychlém přepínání

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
          // OPRAVA: Nejdříve vytvoříme kopii pole [...data], abychom nemutovali původní (možná zmražená) data z cache
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
      <div className="card text-center border-red-200 bg-red-50 p-6">
        <p className="text-red-600 font-bold">{error}</p>
        <p className="text-muted text-sm mt-2">Zkuste vybrat jiné volební období v navigaci.</p>
      </div>
    );
  }

  if (!stats || stats.length === 0) {
    return (
      <div className="card text-center text-muted p-12">
        Pro období {selectedTerm} nebyly nalezeny žádné statistiky stran.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="card text-center">
        <h2 className="text-xl font-bold">Porovnání stran</h2>
        <p className="text-muted">Volební období: {selectedTerm}</p>
      </header>

      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Průměrná účast v hlasování</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats}>
              <XAxis 
                dataKey="party_id" 
                stroke="#888888" 
                fontSize={12}
                tickFormatter={id => id.toUpperCase()} 
              />
              <YAxis 
                unit="%" 
                stroke="#888888" 
                fontSize={12}
                domain={[0, 100]} 
              />
              <Tooltip 
                cursor={{fill: '#f3f4f6'}}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(v) => [`${v}%`, 'Průměrná účast']} 
              />
              <Bar 
                dataKey="avg_attendance" 
                fill="#2563eb" 
                radius={[4, 4, 0, 0]} 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="pb-3 px-2">Strana</th>
              <th className="pb-3 px-2 text-right">Poslanců</th>
              <th className="pb-3 px-2 text-right">Účast</th>
              <th className="pb-3 px-2 text-right">Jednotnost</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {stats.map(s => (
              <tr key={s.party_id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 px-2 font-medium">{s.party_id.toUpperCase()}</td>
                <td className="py-3 px-2 text-right">{s.mps_count}</td>
                <td className="py-3 px-2 text-right font-semibold">{s.avg_attendance}%</td>
                <td className="py-3 px-2 text-right">
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