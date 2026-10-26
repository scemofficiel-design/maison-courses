import { MaisonDB, useDatabase } from '../../src/db/db';
import { setClock } from '../../src/db/util';

let n = 0;
/** Base IndexedDB neuve et isolée pour chaque test. */
export function freshDb(name = `test-${Date.now()}-${n++}`): MaisonDB {
  const instance = new MaisonDB(name);
  useDatabase(instance);
  return instance;
}

export function fixClock(iso = '2026-11-02T10:00:00.000Z') {
  setClock(() => new Date(iso));
}
