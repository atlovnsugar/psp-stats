// src/App.jsx
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AttendanceLeaderboard from './pages/AttendanceLeaderboard';
import MpDetail from './pages/MpDetail';
import VotingList from './pages/VotingList';
import VotingDetail from './pages/VotingDetail';
import PartyComparison from './pages/PartyComparison';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="poslanci" element={<AttendanceLeaderboard />} />
        <Route path="poslanci/:mpId" element={<MpDetail />} />
        <Route path="hlasovani" element={<VotingList />} />
        <Route path="hlasovani/:votingId" element={<VotingDetail />} />
        <Route path="strany" element={<PartyComparison />} />
      </Route>
    </Routes>
  );
}