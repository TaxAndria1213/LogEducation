// relationOptions.ts
export type Option<T extends string | number = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type RelationConfig<TItem, TValue extends string | number = string> = {
  /**
   * Clé unique de cache (souvent: nom de la ressource)
   * ex: "companies", "users"
   */
  key: string;

  /** Service qui sait lister les items (API) */
  list: () => Promise<TItem[]>;

  /** Mapper l'item en option */
  map: (item: TItem) => Option<TValue>;

  /** (optionnel) tri */
  sort?: (a: Option<TValue>, b: Option<TValue>) => number;

  /** (optionnel) multi-select */
  multiple?: boolean;

  /**
   * (optionnel) TTL du cache
   * ex: 5 min => 5 * 60_000
   */
  ttlMs?: number;
};
