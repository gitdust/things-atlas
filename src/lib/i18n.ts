export type Lang = 'zh' | 'en';

const dict = {
  zh: {
    title: 'Things Atlas',
    subtitle: '日常之物图志',
    cumulative: '累积',
    snapshot: '快照',
    year: '年份',
    categories: '分类',
    allCategories: '全部分类',
    showDisputed: '显示争议条目',
    close: '关闭',
    sources: '来源',
    locations: '地点',
    years: '年份口径',
    invention: '发明',
    patent: '专利',
    mass_production: '量产',
    popularization: '普及',
    disputed: '存在争议',
    notes: '编者注',
    footer:
      '底图为现代疆界，地点为近似。代码 MIT · 条目数据 CC BY 4.0 · things-atlas.com',
    empty: '当前筛选无条目',
  },
  en: {
    title: 'Things Atlas',
    subtitle: 'Everyday objects on a map of time',
    cumulative: 'Cumulative',
    snapshot: 'Snapshot',
    year: 'Year',
    categories: 'Categories',
    allCategories: 'All categories',
    showDisputed: 'Show disputed',
    close: 'Close',
    sources: 'Sources',
    locations: 'Places',
    years: 'Year marks',
    invention: 'Invention',
    patent: 'Patent',
    mass_production: 'Mass production',
    popularization: 'Popularization',
    disputed: 'Disputed',
    notes: 'Notes',
    footer:
      'Basemap shows modern borders; places are approximate. Code MIT · Data CC BY 4.0 · things-atlas.com',
    empty: 'No items for this filter',
  },
} as const;

export type MessageKey = keyof (typeof dict)['zh'];

export function t(lang: Lang, key: MessageKey): string {
  return dict[lang][key];
}
