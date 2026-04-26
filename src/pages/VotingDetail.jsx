import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchJSON } from '../utils/dataCache';
import { useMpsMap } from '../context/DataContext';
import { useTerm } from '../context/TermContext';

const VOTE_LABELS = { yes: 'Ano', no: 'Ne', abstain: 'Zdržel se', absent: 'Omluven', not_logged: 'Nepřihlášen' };
const VOTE_COLORS = { yes: '#22c55e', no: '#ef4444', abstain: '#eab308', absent: '#6b7280', not_logged: '#9ca3af' };

export default function VotingDetail() {
  const { votingId } = useParams();
  const { selectedTerm } = useTerm();
  const [voting, setVoting] = useState(null);
  const [loading, setLoading] = useState(true);
  const mpsMap = useMpsMap();

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchJSON(`/data/votings/voting_${votingId}.json`);
        data.mps = data.mps.map(([mp_id, code]) => ({
          mp_id,
          vote: ['yes','no','abstain','absent','not_logged'][code]
        }));
        setVoting(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [votingId]);

  if (loading) return <p className="text-center py-10">Načítám detail…</p>;
  if (!voting) return <p className="text-center py-10">Hlasování nenalezeno.</p>;

  const pieData = Object.entries(voting.vote_summary).map(([key, value]) => ({ name: VOTE_LABELS[key], value, color: VOTE_COLORS[key] }));

  const barData = Object.entries(voting.party_breakdown).map(([party, counts]) => ({
    party: party.toUpperCase(),
    ...counts
  }));

  return (
    <div>
      <Link to={`/hlasovani?term=${selectedTerm}`} className="text-indigo-600 hover:underline text-sm">&larr; zpět na seznam</Link>
      <h1 className="text-2xl font-bold mt-2 text-gray-800">{voting.title}</h1>
      <p className="text-sm text-gray-500">{voting.date} · Výsledek: <strong>{voting.result === 'prijato' ? 'Přijato' : 'Zamítnuto'}</strong></p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-2">Celkový výsledek</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-2">Hlasování podle stran</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <XAxis dataKey="party" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="yes" fill="#22c55e" name="Ano" />
              <Bar dataKey="no" fill="#ef4444" name="Ne" />
              <Bar dataKey="abstain" fill="#eab308" name="Zdržel se" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <h2 className="font-semibold p-4 pb-2">Poslanci</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Poslanec</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Hlas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {voting.mps.map(mp => {
                const mpInfo = mpsMap.get(mp.mp_id) || { name: `ID: ${mp.mp_id}` };
                return (
                  <tr key={mp.mp_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm">
                      <Link to={`/poslanci/${mp.mp_id}?term=${selectedTerm}`} className="text-indigo-600 hover:underline">
                        {mpInfo.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-sm text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: VOTE_COLORS[mp.vote] + '30', color: VOTE_COLORS[mp.vote], border: `1px solid ${VOTE_COLORS[mp.vote]}` }}>
                        {VOTE_LABELS[mp.vote]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}