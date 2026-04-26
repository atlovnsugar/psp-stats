import { useEffect, useState } from 'react';
import { fetchJSON } from '../utils/dataCache';
import { useMpsMap } from '../context/DataContext';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const VOTE_COLORS = { yes: '#22c55e', no: '#ef4444', abstain: '#eab308', absent: '#6b7280', not_logged: '#9ca3af' };
const VOTE_NAMES = { yes: 'Ano', no: 'Ne', abstain: 'Zdržel se', absent: 'Omluven', not_logged: 'Nepřihlášen' };

export default function MpModal({ mpId, termId, onClose }) {
  const [stats, setStats] = useState(null);
  const [votesData, setVotesData] = useState(null);
  const mpsMap = useMpsMap();
  const mpName = mpsMap.get(mpId)?.name || `ID: ${mpId}`;

  useEffect(() => {
    async function load() {
      try {
        const [allStats, votes] = await Promise.all([
          fetchJSON(`/data/term_${termId}_mp_stats.json`),
          fetchJSON(`/data/mps/mp_${mpId}_votes.json`)
        ]);
        const mpStat = allStats.find(s => s.mp_id === mpId);
        setStats(mpStat);
        setVotesData(votes);
      } catch (e) {
        console.error(e);
      }
    }
    load();
  }, [mpId, termId]);

  let pieData = null;
  if (votesData && votesData.terms[termId]) {
    const termVotes = votesData.terms[termId];
    const counts = { yes: 0, no: 0, abstain: 0, absent: 0, not_logged: 0 };
    termVotes.forEach(([_, code]) => {
      const vote = ['yes', 'no', 'abstain', 'absent', 'not_logged'][code];
      counts[vote]++;
    });
    pieData = Object.entries(counts).map(([key, val]) => ({ name: VOTE_NAMES[key], value: val, color: VOTE_COLORS[key] }));
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-fade-in" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        <h2 className="text-xl font-bold mb-4">{mpName}</h2>

        {stats ? (
          <div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div><span className="text-gray-500">Účast:</span> <strong>{stats.attendance_pct}%</strong></div>
              <div><span className="text-gray-500">Oprávněno:</span> <strong>{stats.eligible_votes}</strong></div>
              <div><span className="text-gray-500">Zúčastněno:</span> <strong>{stats.attended}</strong></div>
              <div><span className="text-gray-500">Loajalita:</span> <strong>{stats.party_loyalty != null ? (stats.party_loyalty * 100).toFixed(1) + '%' : 'N/A'}</strong></div>
              <div>✅ Ano: <strong>{stats.voted_yes}</strong></div>
              <div>❌ Ne: <strong>{stats.voted_no}</strong></div>
              <div>⚠️ Zdržel se: <strong>{stats.abstained}</strong></div>
              <div><span className="text-gray-500">Strana:</span> <strong>{stats.party_id?.toUpperCase()}</strong></div>
            </div>

            {pieData && (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">Načítám data…</p>
        )}
      </div>
    </div>
  );
}