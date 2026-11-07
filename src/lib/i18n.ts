export type Lang = 'zh' | 'en';

const dict = {
  zh: {
    // brand (header brand mark stays bilingual)
    title: 'Things Atlas',
    tagline: '日常之物的发明、专利、量产与普及',

    // chrome
    year: '年份',
    close: '关闭',
    back: '返回',
    language: '语言',
    map: '地图',
    legend: '图例',
    search: '搜索物品',
    searchPlaceholder: '搜索物品名称…',
    searchEmpty: '没有找到这个物品',
    searchSuggestHint: '想添加它？只需提交物品名称，详细描述可选。',
    searchSuggest: '在 GitHub Issue 中建议添加 ↗',

    // drawer sections
    sources: '来源',
    locations: '地点',
    notes: '争议说明',
    milestones: '年表',
    entry: '条目',
    photoSource: '来源',
    primaryYear: '主年份',
    disputed: '有争议',

    // year stages
    invention: '发明',
    patent: '专利',
    mass_production: '量产',
    popularization: '普及',

    // location kinds (places on the map)
    kind_invention: '发明地',
    kind_patent: '专利地',
    kind_production: '量产地',
    kind_popularization: '普及地',
    kind_contested: '争议说法',

    // legend
    legendPlace: '地点',
    legendContested: '争议说法',
    legendArc: '同一条目的地点连线',

    // precision (shown only when not plain "year")
    precision_exact: '确切日期',
    precision_year: '年份',
    precision_decade: '约略到十年',
    precision_century: '约略到世纪',

    footer: '底图为现代国界，地点为近似定位 · 代码 MIT · 数据 CC BY 4.0',
  },
  en: {
    title: 'Things Atlas',
    tagline: 'Invention, patent, manufacture, and popularization',

    year: 'Year',
    close: 'Close',
    back: 'Back',
    language: 'Language',
    map: 'Map',
    legend: 'Legend',
    search: 'Search objects',
    searchPlaceholder: 'Search object names…',
    searchEmpty: 'No matching objects',
    searchSuggestHint: 'Want it added? Only the object name is required; details are optional.',
    searchSuggest: 'Suggest an object on GitHub ↗',

    sources: 'Sources',
    locations: 'Places',
    notes: 'Disputed note',
    milestones: 'Timeline',
    entry: 'Entry',
    photoSource: 'Source',
    primaryYear: 'Primary year',
    disputed: 'Disputed',

    invention: 'Invention',
    patent: 'Patent',
    mass_production: 'Mass production',
    popularization: 'Popularization',

    kind_invention: 'Invention',
    kind_patent: 'Patent',
    kind_production: 'Production',
    kind_popularization: 'Popularization',
    kind_contested: 'Contested',

    legendPlace: 'Place',
    legendContested: 'Contested claim',
    legendArc: 'Linked places of one entry',

    precision_exact: 'exact date',
    precision_year: 'year',
    precision_decade: 'approx. decade',
    precision_century: 'approx. century',

    footer: 'Modern borders; places are approximate · Code MIT · Data CC BY 4.0',
  },
} as const;

export type MessageKey = keyof (typeof dict)['zh'];

export function t(lang: Lang, key: MessageKey): string {
  return dict[lang][key];
}

/** Pick the field for the active UI language, with fallback. */
export function pick(
  lang: Lang,
  zh: string | null | undefined,
  en: string | null | undefined,
): string {
  if (lang === 'zh') return (zh && zh.trim()) || en || '';
  return (en && en.trim()) || zh || '';
}

/**
 * Format a (possibly BCE) year. Negative years are BCE:
 * zh → 「公元前 2800」/ short 「前2800」, en → "2800 BCE".
 */
export function formatYear(lang: Lang, y: number, short = false): string {
  if (y >= 0) return String(y);
  const n = String(-y);
  if (lang === 'zh') return short ? `前${n}` : `公元前 ${n}`;
  return `${n} BCE`;
}
