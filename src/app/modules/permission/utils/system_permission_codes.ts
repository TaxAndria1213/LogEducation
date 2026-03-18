import fs from "fs";
import path from "path";

let cachedCodes: Set<string> | null = null;

function loadSystemPermissionCodes(): Set<string> {
    if (cachedCodes) {
        return cachedCodes;
    }

    const typesPath = path.join(process.cwd(), "frontend", "src", "types", "types.ts");

    try {
        const source = fs.readFileSync(typesPath, "utf8");
        const codes = [...source.matchAll(/'([A-Z0-9_.]+)'/g)].map((match) => match[1]);
        cachedCodes = new Set(codes);
    } catch (error) {
        console.warn("Impossible de charger les permissions systeme depuis les CI.", error);
        cachedCodes = new Set();
    }

    return cachedCodes;
}

export function getSystemPermissionCodes(): string[] {
    return [...loadSystemPermissionCodes()];
}

export function isSystemPermissionCode(code?: string | null): boolean {
    if (!code) {
        return false;
    }

    return loadSystemPermissionCodes().has(code.trim());
}
