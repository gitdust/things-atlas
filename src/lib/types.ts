export type YearPrecision = 'exact' | 'year' | 'decade' | 'century';

export type YearMark = {
  year: number;
  precision: YearPrecision;
  ref?: string;
} | null;

export type CategoryId =
  | 'stationery'
  | 'apparel_accessory'
  | 'hand_tool'
  | 'home'
  | 'personal_care'
  | 'digital'
  | 'kitchen';

export type LocationKind =
  | 'invention'
  | 'patent'
  | 'production'
  | 'popularization'
  | 'contested';

export type PlaceConfidence =
  | 'exact'
  | 'city'
  | 'region'
  | 'country'
  | 'approximate';

export type ItemConfidence =
  | 'exact'
  | 'year'
  | 'decade'
  | 'century'
  | 'disputed';

export type SourceType =
  | 'patent'
  | 'museum'
  | 'wiki'
  | 'book'
  | 'news'
  | 'brand'
  | 'other';

export type ItemLocation = {
  lat: number;
  lng: number;
  place_label_zh: string;
  place_label_en: string;
  kind: LocationKind;
  confidence: PlaceConfidence;
  year_override?: number;
};

export type ItemSource = {
  title: string;
  url: string;
  type: SourceType;
  accessed: string;
};

export type AtlasItem = {
  id: string;
  name_zh: string;
  name_en: string;
  category: CategoryId;
  years: {
    invention: YearMark;
    patent: YearMark;
    mass_production: YearMark;
    popularization: YearMark;
  };
  locations: ItemLocation[];
  confidence: ItemConfidence;
  sources: ItemSource[];
  disputed: boolean;
  notes?: string;
  summary_zh: string;
  summary_en: string;
  tags?: string[];
  updated: string;
  /** Derived at build time — not stored in source JSON */
  primary_year: number;
};

export type YearMode = 'cumulative' | 'snapshot';

export type ItemsIndex = {
  generated_at: string;
  count: number;
  year_range: {
    min: number;
    max: number;
    data_min: number;
    data_max: number;
  };
  primary_year_priority: string[];
  items: AtlasItem[];
};

export type CategoryMeta = {
  id: CategoryId;
  name_zh: string;
  name_en: string;
  color: string;
};
