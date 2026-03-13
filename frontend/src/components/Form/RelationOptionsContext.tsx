import { createContext, useContext } from "react";
import type { ProviderValue } from "./RelationOptionsProvider";

export const Ctx = createContext<ProviderValue | null>(null);

export function useRelationOptions() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRelationOptions must be used within RelationOptionsProvider");
  return ctx;
}