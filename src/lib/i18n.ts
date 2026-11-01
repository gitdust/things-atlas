export type Lang = 'zh' | 'en';

const dict = {
  zh: {
    // brand (subtitle used only if needed; header brand mark stays bilingual)
    title: 'Things Atlas',
    subtitle: '日常之物图志',
    tagline: '日常之物的发明、专利、量产与普及',

    // chrome
    year: '年份',
    categories: '分类',
    allCategories: '全部',
    showDisputed: '显示争议条目',
    close: '关闭',
    language: '语言',
    map: '地图',
    legend: '图例',
    play: '播放',
    pause: '暂停',
    playHint: '播放（空格键）',
    pauseHint: '暂停（空格键）',
    upTo: '截至',
    countShown: '{n} / {total} 件可见',

    // drawer sections
    sources: '来源',
    locations: '地点',
    years: '年份',
    notes: '编者注',
    milestones: '年表',
    entry: '条目',
    photoCredit: '图注',
    photoSource: '来源',
    primaryYear: '主年份',
    updated: '更新于 {date}',
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

    footer:
      '底图为现代国界，地点为近似定位 · 代码 MIT · 数据 CC BY 4.0 · 底图 © OpenFreeMap / OpenStreetMap',
  },
  en: {
    title: 'Things Atlas',
    subtitle: 'Atlas of everyday things',
    tagline: 'Invention, patent, manufacture, and popularization',

    year: 'Year',
    categories: 'Categories',
    allCategories: 'All',
    showDisputed: 'Show disputed',
    close: 'Close',
    language: 'Language',
    map: 'Map',
    legend: 'Legend',
    play: 'Play',
    pause: 'Pause',
    playHint: 'Play (Space)',
    pauseHint: 'Pause (Space)',
    upTo: 'Up to',
    countShown: '{n} of {total} shown',

    sources: 'Sources',
    locations: 'Places',
    years: 'Years',
    notes: 'Notes',
    milestones: 'Timeline',
    entry: 'Entry',
    photoCredit: 'Photo',
    photoSource: 'Source',
    primaryYear: 'Primary year',
    updated: 'Updated {date}',
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

    footer:
      'Modern borders; places are approximate · Code MIT · Data CC BY 4.0 · Basemap © OpenFreeMap / OpenStreetMap',
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

/** Fill `{n}` / `{total}` / `{date}` style templates. */
export function tf(
  lang: Lang,
  key: MessageKey,
  vars: Record<string, string | number>,
): string {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, String(v)),
    t(lang, key),
  );
}
