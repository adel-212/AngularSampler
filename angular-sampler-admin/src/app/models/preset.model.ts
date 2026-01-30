export interface Preset {
  category: string;
  name: string;
  count: number;
}

export interface Sound {
  id: string;
  name: string;
  url: string;
}

export interface PresetDetail {
  name: string;
  category: string;
  sounds: Sound[];
}
