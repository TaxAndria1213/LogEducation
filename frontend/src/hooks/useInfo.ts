import { createContext, useContext } from "react";

export type InfoType = "success" | "error" | "warning" | "info";

export type Ctx = {
    info: (message: string, type?: InfoType) => void;
};

export const InfoContext = createContext<Ctx | null>(null);



export function useInfo() {
    const ctx = useContext(InfoContext);
    if (!ctx) throw new Error("useInfo must be used inside <InfoProvider />");
    return ctx; // { info }
}