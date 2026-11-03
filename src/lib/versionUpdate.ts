export type ReleaseChange = { id: string; zh: string; en: string };
export type ReleaseManifest = { version: string; changes: ReleaseChange[] };

export const PENDING_UPDATE_KEY = 'things-atlas.pending-update';

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function isNewerVersion(candidate: string, current: string): boolean {
  if (!VERSION.test(candidate) || !VERSION.test(current)) return false;
  const next = candidate.split('.').map(BigInt);
  const previous = current.split('.').map(BigInt);
  for (let i = 0; i < 3; i++) {
    if (next[i] !== previous[i]) return next[i] > previous[i];
  }
  return false;
}

export function parseReleaseManifest(value: unknown): ReleaseManifest | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (typeof data.version !== 'string' || !VERSION.test(data.version)) return null;
  if (!Array.isArray(data.changes)) return null;
  const ids = new Set<string>();
  const changes: ReleaseChange[] = [];
  for (const entry of data.changes) {
    if (!entry || typeof entry !== 'object') return null;
    const change = entry as Record<string, unknown>;
    if (
      typeof change.id !== 'string' ||
      !change.id.trim() ||
      ids.has(change.id) ||
      typeof change.zh !== 'string' ||
      !change.zh.trim() ||
      typeof change.en !== 'string' ||
      !change.en.trim()
    )
      return null;
    ids.add(change.id);
    changes.push({ id: change.id, zh: change.zh, en: change.en });
  }
  return { version: data.version, changes };
}

export function pendingReleaseForVersion(
  raw: string | null,
  version: string,
): ReleaseManifest | null {
  if (!raw) return null;
  try {
    const release = parseReleaseManifest(JSON.parse(raw));
    return release?.version === version ? release : null;
  } catch {
    return null;
  }
}
