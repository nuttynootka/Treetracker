// Device-only values that never sync: this phone's id and name, and when it last exported or imported.
const KEY = 'treetracker.local';

interface Local {
  deviceId?: string;
  deviceName?: string;
  lastExport?: number;
  lastImport?: number;
  lastImportSummary?: string;
}

let memory: Local = {};

function load(): Local {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? (JSON.parse(raw) as Local) : memory;
  } catch {
    return memory;
  }
}

function save(v: Local) {
  memory = v;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(v));
  } catch {
    // storage unavailable; keep the in-memory copy
  }
}

export function getDevice(): { id: string; name: string } {
  const v = load();
  if (!v.deviceId) save({ ...v, deviceId: crypto.randomUUID() });
  const now = load();
  return { id: now.deviceId!, name: now.deviceName ?? 'This phone' };
}

export function setDeviceName(name: string) {
  save({ ...load(), deviceName: name });
}

export function getSyncTimes() {
  const { lastExport, lastImport, lastImportSummary } = load();
  return { lastExport, lastImport, lastImportSummary };
}

export function setSyncTimes(p: { lastExport?: number; lastImport?: number; lastImportSummary?: string }) {
  save({ ...load(), ...p });
}
