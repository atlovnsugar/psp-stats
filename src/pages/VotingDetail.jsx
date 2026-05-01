// src/pages/VotingDetail.jsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchJSON } from '../utils/dataCache';
import { useMpsMap } from '../context/DataContext';
import { useTerm } from '../context/TermContext';

// Použijeme globální proměnné pro barvy, pokud existují, jinak fallback
const VOTE_LABELS = { yes: 'Ano', no: 'Ne', abstain: 'Zdržel se', absent: 'Omluven', not_logged: 'Nepřihlášen' };
const VOTE_COLORS = { 
  yes: 'var(--vote-yes, #22c55e)', 
  no: 'var(--vote-no, #ef4444)', 
  abstain: 'var(--vote-abstain, #eab308)', 
  absent: 'var(--vote-absent, #6b7280)', 
  not_logged: 'var(--text-muted, #9ca3af)' 
};

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
        console.error("Chyba při načítání detailu hlasování:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [votingId]);

  if (loading) return <div className="loader-container"><div className="loader">Načítám detail…</div></div>;
  if (!voting) return <div className="error-state"><h2>Hlasování nenalezeno.</h2><p>ID: {votingId}</p></div>;

  const pieData = Object.entries(voting.vote_summary).map(([key, value]) => ({ name: VOTE_LABELS[key], value, color: VOTE_COLORS[key] }));

  const barData = Object.entries(voting.party_breakdown).map(([party, counts]) => ({
    party: party.toUpperCase(),
    ...counts
  }));

  // Vlastní Tooltip pro Recharts - používá globální styly
  const CustomizedTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={`${entry.dataKey}-${index}`} className="tooltip-item" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="app-container">
      <Link to={`/hlasovani?term=${selectedTerm}`} className="back-link">&larr; zpět na seznam</Link>
      
      <h1>{voting.title}</h1> {/* H1 je v globálním stylu */}
      <p className="voting-meta-info">
        {voting.date} · Výsledek: <strong className={`voting-result-badge ${voting.result === 'prijato' ? 'vote-yes' : 'vote-no'}`}>
          {voting.result === 'prijato' ? 'Přijato' : 'Zamítnuto'}
        </strong>
      </p>

      <div className="stats-grid detail-stats"> {/* Použijeme existující grid styl, případně upravíme */}
        <div className="card chart-card">
          <div className="panel-header">
            <h2>Celkový výsledek</h2>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <CustomizedTooltip />
                {/* Legendu lze přizpůsobit, nebo použít vlastní komponentu */}
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card chart-card">
          <div className="panel-header">
            <h2>Hlasování podle stran</h2>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <XAxis dataKey="party" tick={{ fill: 'var(--text-secondary)' }} />
                <YAxis tick={{ fill: 'var(--text-secondary)' }} />
                <CustomizedTooltip />
                <Legend content={<CustomizedLegend />} />
                <Bar dataKey="yes" fill={VOTE_COLORS.yes} name="Ano" />
                <Bar dataKey="no" fill={VOTE_COLORS.no} name="Ne" />
                <Bar dataKey="abstain" fill={VOTE_COLORS.abstain} name="Zdržel se" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card voters-table-card">
        <div className="panel-header">
          <h2>Poslanci</h2>
        </div>
        <div className="table-wrapper">
          <table className="data-table voters-table"> {/* Přidáme konkrétní třídu pro tento typ tabulky */}
            <thead>
              <tr>
                <th>Poslanec</th>
                <th>Hlas</th>
              </tr>
            </thead>
            <tbody>
              {voting.mps.map(mp => {
                const mpInfo = mpsMap.get(mp.mp_id) || { name: `ID: ${mp.mp_id}` };
                return (
                  <tr key={mp.mp_id}>
                    <td className="voter-name-cell">
                      <Link to={`/poslanci/${mp.mp_id}?term=${selectedTerm}`} className="voter-link">
                        {mpInfo.name}
                      </Link>
                    </td>
                    <td className="voter-vote-cell">
                      <span className={`timeline-badge vote-${mp.vote}`}>
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

// Vlastní legenda pro Recharts - používá globální styly a barvy
const CustomizedLegend = (props) => {
  const { payload } = props;
  return (
    <ul className="custom-legend">
      {payload.map((entry, index) => (
        <li key={`item-${index}`} className="legend-item">
          <span className="legend-color" style={{ backgroundColor: entry.color }}></span>
          <span className="legend-label">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
};