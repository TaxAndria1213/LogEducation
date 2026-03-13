/* eslint-disable @typescript-eslint/no-explicit-any */
// useAutoRelationMeta.ts
import { useEffect, useMemo } from "react";
import type { RelationConfig } from "./relationOptions";
import { useRelationOptions } from "./RelationOptionsContext";

type MetaByField = Record<
  string,
  {
    relation?: { multiple?: boolean; options?: Array<{ value: string | number; label: string }> };
  }
>;

export function useAutoRelationMeta(
  fieldToRelation: Record<string, RelationConfig<any, any>>
): {
  metaByField: MetaByField;
  loadingKeys: string[];
  errorByKey: Record<string, unknown>;
} {
  const { ensureLoaded, getOptions, getState } = useRelationOptions();

  // load everything (simple)
  useEffect(() => {
    const entries = Object.values(fieldToRelation);
    for (const rel of entries) {
      ensureLoaded(
        rel.key,
        async () => {
          const items = await rel.list();
          let opts = items.map(rel.map);
          if (rel.sort) opts = opts.slice().sort(rel.sort);
          return opts;
        },
        rel.ttlMs
      );
    }
  }, [ensureLoaded, fieldToRelation]);

  const metaByField = useMemo(() => {
    const out: MetaByField = {};
    for (const [fieldName, rel] of Object.entries(fieldToRelation)) {
      const options = getOptions(rel.key) ?? [];
      out[fieldName] = {
        relation: {
          multiple: rel.multiple,
          options,
        },
      };
    }
    return out;
  }, [fieldToRelation, getOptions]);

  const { loadingKeys, errorByKey } = useMemo(() => {
    const loading: string[] = [];
    const errors: Record<string, unknown> = {};
    for (const rel of Object.values(fieldToRelation)) {
      const st = getState(rel.key);
      if (st?.loading) loading.push(rel.key);
      if (st?.error) errors[rel.key] = st.error;
    }
    return { loadingKeys: loading, errorByKey: errors };
  }, [fieldToRelation, getState]);

  return { metaByField, loadingKeys, errorByKey };
}
