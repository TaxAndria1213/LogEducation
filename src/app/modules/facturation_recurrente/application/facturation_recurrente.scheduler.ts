import FacturationRecurrenteService from "./facturation_recurrente.service";

class FacturationRecurrenteScheduler {
  private service: FacturationRecurrenteService;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(service = new FacturationRecurrenteService()) {
    this.service = service;
  }

  public start() {
    const enabled = (process.env.AUTO_RECURRING_BILLING_ENABLED ?? "true").toLowerCase() !== "false";
    if (!enabled) {
      console.log("[Facturation recurrente] generation automatique desactivee.");
      return;
    }

    const intervalMinutes = Math.max(
      5,
      Number(process.env.AUTO_RECURRING_BILLING_INTERVAL_MINUTES ?? "60") || 60,
    );

    void this.runCycle("startup");
    this.timer = setInterval(() => {
      void this.runCycle("interval");
    }, intervalMinutes * 60 * 1000);

    console.log(
      `[Facturation recurrente] generation automatique activee (verification toutes les ${intervalMinutes} min).`,
    );
  }

  private async runCycle(source: "startup" | "interval") {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.service.autoGenerateRecurringForAllTenants(new Date());
      const createdCount = result.results.reduce((sum, item) => sum + item.created_count, 0);
      const errored = result.results.filter((item) => item.error);
      console.log(
        `[Facturation recurrente] cycle ${source} termine: ${createdCount} facture(s) recurrente(s) creee(s), ${errored.length} erreur(s).`,
      );
      if (errored.length > 0) {
        for (const item of errored) {
          console.error(
            `[Facturation recurrente] Echec etablissement ${item.tenantId}: ${item.error}`,
          );
        }
      }
    } catch (error) {
      console.error("[Facturation recurrente] Erreur globale du scheduler:", error);
    } finally {
      this.running = false;
    }
  }
}

export default FacturationRecurrenteScheduler;
