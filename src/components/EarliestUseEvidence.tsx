import { formatYear, pick, type Lang } from '@/lib/i18n';
import type { EarliestUse, ItemSource } from '@/lib/types';

function formatEarliestUse(lang: Lang, use: EarliestUse): string {
  const prefix = use.precision === 'year' ? '' : lang === 'zh' ? '约 ' : 'c. ';
  return prefix + formatYear(lang, use.year);
}

export function EarliestUseEvidence({
  earliestUse,
  sources,
  lang,
}: {
  earliestUse: EarliestUse;
  sources: readonly ItemSource[];
  lang: Lang;
}) {
  return (
    <div className="earliest-use-evidence">
      <strong className="num">{formatEarliestUse(lang, earliestUse)}</strong>
      <p>{pick(lang, earliestUse.explanation_zh, earliestUse.explanation_en)}</p>
      <ul>
        {earliestUse.source_urls.map((url) => (
          <li key={url}>
            <a href={url} target="_blank" rel="noreferrer">
              {sources.find((source) => source.url === url)?.title ?? url} ↗
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
