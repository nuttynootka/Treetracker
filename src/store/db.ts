import { openDB } from 'idb';
import { seedRecords } from '../core/seed';
import type { AnyRecord } from '../core/types';

export interface Repo {
  all(): Promise<AnyRecord[]>;
  put(recs: AnyRecord[]): Promise<void>;
}

export async function openRepo(name = 'treetracker'): Promise<Repo> {
  const db = await openDB(name, 1, {
    upgrade(d) {
      d.createObjectStore('records', { keyPath: 'id' });
    },
  });
  const repo: Repo = {
    all: () => db.getAll('records') as Promise<AnyRecord[]>,
    async put(recs) {
      const tx = db.transaction('records', 'readwrite');
      await Promise.all([...recs.map((r) => tx.store.put(r)), tx.done]);
    },
  };
  if ((await db.count('records')) === 0) await repo.put(seedRecords());
  return repo;
}
