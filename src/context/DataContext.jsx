import { createContext, useContext, useEffect, useState } from 'react';
import { fetchJSON } from '../utils/dataCache';

const MpsContext = createContext();
const VotingsIndexContext = createContext();

export function DataProvider({ children }) {
  const [mpsMap, setMpsMap] = useState(new Map());       // mp_id → {name, party_id?}
  const [votingsIndexMap, setVotingsIndexMap] = useState(new Map()); // voting_id → {date, term_id}
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [mpsList, votingsIndex] = await Promise.all([
          fetchJSON('/data/mps.json'),
          fetchJSON('/data/votings_index.json')
        ]);

        // Mapa poslanců
        const mpMap = new Map();
        for (const mp of mpsList) {
          mpMap.set(mp.id, {
            name: mp.name,
            // poslední známá strana (pro zjednodušení vezmu první z party_timeline, nebo poslední)
            lastParty: mp.party_timeline?.length ? mp.party_timeline[mp.party_timeline.length - 1].party_id : null
          });
        }
        setMpsMap(mpMap);

        // Mapa hlasování
        const idxMap = new Map();
        for (const v of votingsIndex) {
          idxMap.set(v.id, { date: v.date, term_id: v.term_id });
        }
        setVotingsIndexMap(idxMap);
      } catch (e) {
        console.error('Chyba načítání sdílených dat', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="text-center py-10">Načítám data aplikace…</div>;

  return (
    <MpsContext.Provider value={mpsMap}>
      <VotingsIndexContext.Provider value={votingsIndexMap}>
        {children}
      </VotingsIndexContext.Provider>
    </MpsContext.Provider>
  );
}

export function useMpsMap() { return useContext(MpsContext); }
export function useVotingsIndex() { return useContext(VotingsIndexContext); }