import React from "react";

export type ERPPageBackButtonConfig = {
  to?: string;
  onClick?: () => void;
  label?: string;
};

type ERPPageBackButtonContextValue = {
  setBackButtonOverride: (ownerId: string, value: ERPPageBackButtonConfig | null) => void;
};

export const ERPPageBackButtonContext =
  React.createContext<ERPPageBackButtonContextValue | null>(null);

export function useERPPageBackButton() {
  return React.useContext(ERPPageBackButtonContext);
}
