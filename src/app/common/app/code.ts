class Code {
  private cigle: string;
  private width: number;
  private lastCode: string;
  private year: number;

  /**
   * @param cigle Préfixe (ex: "E")
   * @param width Nombre de chiffres pour le compteur (ex: 4 => 0001)
   * @param lastCode Dernier code généré (ex: "E20260001") ou "" / null-like si aucun
   * @param year Année à utiliser (par défaut: année courante)
   */
  constructor(cigle: string, width: number, lastCode: string, year: number = new Date().getFullYear()) {
    if (!cigle || cigle.trim().length === 0) {
      throw new Error("cigle ne peut pas être vide");
    }
    if (!Number.isInteger(width) || width <= 0) {
      throw new Error("width doit être un entier > 0");
    }

    this.cigle = cigle.trim();
    this.width = width;
    this.lastCode = lastCode ?? "";
    this.year = year;
  }

  /**
   * Renvoie le prochain code au format: {cigle}{year}{counterPad}
   * Exemple: E + 2026 + 0001 => "E20260001"
   */
  public next(): string {
    const nextNumber = this.makeLastNumber(this.lastCode);
    return `${this.cigle}${this.year}${nextNumber}`;
  }

  // lastCode = "E20260001" (exemple)
  // => renvoie "0002"
  // si lastCode invalide / année différente / cigle différent => renvoie "0001"
  private makeLastNumber(lastCode: string): string {
    const counterDefault = 1;

    // Format attendu: {cigle}{year}{digits}
    // ex: E20260001 -> cigle=E, year=2026, digits=0001
    const escapedCigle = this.escapeRegExp(this.cigle);
    const re = new RegExp(`^${escapedCigle}(\\d{4})(\\d+)$`);
    const m = (lastCode ?? "").trim().match(re);

    if (!m) {
      return String(counterDefault).padStart(this.width, "0");
    }

    const lastYear = Number(m[1]);
    const lastDigits = m[2];

    // Si ce n'est pas la même année, on repart à 0001
    if (lastYear !== this.year) {
      return String(counterDefault).padStart(this.width, "0");
    }

    // On prend les width derniers chiffres du compteur (au cas où ça varie)
    const tail = lastDigits.slice(-this.width);
    const n = Number(tail);

    if (!Number.isFinite(n) || n < 0) {
      return String(counterDefault).padStart(this.width, "0");
    }

    const next = n + 1;

    // Si on dépasse la largeur, on laisse grandir (optionnel).
    // Exemple width=4 et next=10000 => "10000" (pas tronqué).
    // Si tu veux tronquer, dis-moi.
    return String(next).padStart(this.width, "0");
  }

  private escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

export default Code;
