import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

type ChangeRecord = {
  id: string;
  afterVersion: string;
  zh: string;
  en: string;
};

export type ReleaseManifest = {
  version: string;
  changes: { id: string; zh: string; en: string }[];
};

function versionParts(version: unknown): number[] {
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error(`Invalid release version: ${String(version)} (expected major.minor.patch)`);
  }
  const parts = version.split('.').map(Number);
  if (!parts.every(Number.isSafeInteger))
    throw new Error(`Version component too large: ${version}`);
  return parts;
}

export function compareVersions(a: string, b: string): number {
  const left = versionParts(a);
  const right = versionParts(b);
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }
  return 0;
}

/** Records made after the running version stay pending until the version advances. */
export function createReleaseManifest(
  version: string,
  input: unknown,
  previousVersion: string | null,
): ReleaseManifest {
  versionParts(version);
  if (!Array.isArray(input)) throw new Error('data/changes.json must contain an array');
  const ids = new Set<string>();
  const records: ChangeRecord[] = input.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('Each change must be an object');
    const record = entry as Record<string, unknown>;
    for (const field of ['id', 'afterVersion', 'zh', 'en'] as const) {
      if (typeof record[field] !== 'string' || !record[field].trim()) {
        throw new Error(`Change field ${field} must be a non-empty string`);
      }
    }
    const change = record as ChangeRecord;
    if (ids.has(change.id)) throw new Error(`Duplicate change id: ${change.id}`);
    ids.add(change.id);
    if (compareVersions(change.afterVersion, version) > 0) {
      throw new Error(`Change ${change.id} refers to a future version: ${change.afterVersion}`);
    }
    return change;
  });
  if (previousVersion !== null && compareVersions(previousVersion, version) >= 0) {
    throw new Error('Previous release version must be lower than the current version');
  }
  return {
    version,
    changes: records
      .filter((entry) => entry.afterVersion === previousVersion)
      .map(({ id, zh, en }) => ({ id, zh, en })),
  };
}

/** Finds the last distinct, lower package version, even before a bump is committed. */
export function findPreviousVersion(version: string, history: Iterable<string>): string | null {
  versionParts(version);
  for (const historicalVersion of history) {
    if (compareVersions(historicalVersion, version) < 0) return historicalVersion;
  }
  return null;
}

function readPreviousVersion(root: string, version: string): string | null {
  const git = (args: string[]) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  try {
    if (git(['rev-parse', '--is-shallow-repository']) === 'true') {
      throw new Error('Shallow Git checkout: fetch full history (fetch-depth: 0)');
    }
    const commits = git(['log', '--format=%H', '--', 'package.json']).split('\n').filter(Boolean);
    function* versions() {
      for (const commit of commits) {
        yield JSON.parse(git(['show', `${commit}:package.json`])).version as string;
      }
    }
    return findPreviousVersion(version, versions());
  } catch (error) {
    throw new Error(
      'Cannot read release history; build from a Git checkout with complete history',
      {
        cause: error,
      },
    );
  }
}

export function readReleaseManifest(root: string): ReleaseManifest {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const changes: unknown = JSON.parse(
    fs.readFileSync(path.join(root, 'data/changes.json'), 'utf8'),
  );
  return createReleaseManifest(pkg.version, changes, readPreviousVersion(root, pkg.version));
}
