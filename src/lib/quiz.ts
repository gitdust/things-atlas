import type { AtlasItem, EarliestUse } from './types';

export type QuizItem = Pick<AtlasItem, 'id' | 'name_zh' | 'name_en' | 'name_ja' | 'image' | 'sources'> & {
  earliest_use: EarliestUse;
};
export type QuizPair = [string, string];
export type ExcludedPair = { ids: QuizPair; reason: string };
export type QuizDataset = { datasetVersion: string; items: QuizItem[]; pairs: QuizPair[] };
export type Question = { id: string; leftId: string; rightId: string; earlierId: string };
export function validateEarliestUse(item: {
  earliest_use?: EarliestUse;
  sources: { url: string }[];
}): string[] {
  const use = item.earliest_use;
  if (!use) return [];
  const errors: string[] = [];
  const years = [use.year, use.range?.start, use.range?.end];
  if (years.some((year) => !Number.isSafeInteger(year) || year === 0))
    errors.push('earliest_use years must be nonzero safe integers');
  if (!(use.range?.start <= use.year && use.year <= use.range?.end))
    errors.push('earliest_use range must contain year');
  if (use.precision === 'year' && (use.range?.start !== use.year || use.range?.end !== use.year))
    errors.push('earliest_use year precision requires an exact range');
  if (!['year', 'decade', 'century'].includes(use.precision))
    errors.push('invalid earliest_use precision');
  if (!['documented_use', 'archaeological_evidence'].includes(use.evidence))
    errors.push('invalid earliest_use evidence');
  if (
    !use.explanation_zh?.trim() ||
    use.explanation_zh.length > 80 ||
    !use.explanation_en?.trim() ||
    use.explanation_en.length > 220
  )
    errors.push(
      'earliest_use explanations require editorial review (ZH 1–80, EN 1–220 characters)',
    );
  if (
    !use.source_urls?.length ||
    new Set(use.source_urls).size !== use.source_urls.length ||
    use.source_urls.some((url) => !item.sources.some((source) => source.url === url))
  )
    errors.push('earliest_use source_urls must be unique references to item sources');
  return errors;
}

export function earlierItem(a: QuizItem, b: QuizItem): string | null {
  if (a.earliest_use.range.end < b.earliest_use.range.start) return a.id;
  if (b.earliest_use.range.end < a.earliest_use.range.start) return b.id;
  return null;
}

export function buildPairs(items: QuizItem[], exclusions: ExcludedPair[] = []): QuizPair[] {
  const excluded = new Set(exclusions.map(({ ids }) => [...ids].sort().join('|')));
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const pairs: QuizPair[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (const b of sorted.slice(i + 1)) {
      const a = sorted[i];
      if (!excluded.has([a.id, b.id].join('|')) && earlierItem(a, b)) pairs.push([a.id, b.id]);
    }
  }
  return pairs;
}

export function eligibleQuizItems(items: AtlasItem[]): QuizItem[] {
  return items
    .flatMap((item) => {
      if (!item.earliest_use || item.disputed || item.confidence === 'disputed') return [];
      const errors = validateEarliestUse(item);
      if (errors.length) throw new Error(`${item.id}: ${errors.join(', ')}`);
      return [
        {
          id: item.id,
          name_zh: item.name_zh,
          name_en: item.name_en,
          name_ja: item.name_ja,
          image: item.image,
          sources: item.sources,
          earliest_use: item.earliest_use,
        },
      ];
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function validateExcludedPairs(exclusions: ExcludedPair[], itemIds: Set<string>): void {
  const seen = new Set<string>();
  for (const { ids, reason } of exclusions) {
    if (
      !Array.isArray(ids) ||
      ids.length !== 2 ||
      ids[0] === ids[1] ||
      ids.some((id) => !itemIds.has(id)) ||
      !reason?.trim()
    )
      throw new Error(
        'Invalid quiz excluded pair: two existing distinct IDs and a reason are required',
      );
    const key = [...ids].sort().join('|');
    if (seen.has(key)) throw new Error(`Duplicate quiz excluded pair: ${key}`);
    seen.add(key);
  }
}

export function drawQuestion(dataset: QuizDataset, rng: () => number = Math.random): Question {
  const pair = dataset.pairs[Math.floor(rng() * dataset.pairs.length)];
  if (!pair) throw new Error('Quiz dataset has no legal pair');
  const a = dataset.items.find((item) => item.id === pair[0]);
  const b = dataset.items.find((item) => item.id === pair[1]);
  if (!a || !b) throw new Error('Quiz pair references missing items');
  const earlierId = earlierItem(a, b);
  if (!earlierId) throw new Error('Quiz pair has no reliable ordering');
  const [leftId, rightId] = rng() < 0.5 ? pair : [pair[1], pair[0]];
  return { id: `${dataset.datasetVersion}:${pair.join(':')}`, leftId, rightId, earlierId };
}
