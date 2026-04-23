import { Application } from "express";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../../../service/prisma";
import FinanceRelanceApp from "./finance_relance.app";

class FinanceRelanceScheduler {
  private prisma: PrismaClient;
  private relanceApp: FinanceRelanceApp;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor() {
    this.prisma = prisma;
    this.relanceApp = new FinanceRelanceApp({} as Application);
  }

  public start() {
    const enabled = (process.env.AUTO_FINANCE_RELANCE_ENABLED ?? "true").toLowerCase() !== "false";
    if (!enabled) {
      console.log("[Relance finance] calendrier automatique desactive.");
      return;
    }

    const intervalMinutes = Math.max(
      15,
      Number(process.env.AUTO_FINANCE_RELANCE_INTERVAL_MINUTES ?? "1440") || 1440,
    );

    void this.runCycle("startup");
    this.timer = setInterval(() => {
      void this.runCycle("interval");
    }, intervalMinutes * 60 * 1000);

    console.log(
      `[Relance finance] calendrier automatique active (verification toutes les ${intervalMinutes} min).`,
    );
  }

  private async resolveSenderId(tenantId: string) {
    const directionUser = await this.prisma.utilisateur.findFirst({
      where: {
        etablissement_id: tenantId,
        statut: "ACTIF",
        roles: {
          some: {
            role: {
              nom: "DIRECTION",
            },
          },
        },
      },
      select: { id: true },
      orderBy: { created_at: "asc" },
    });
    if (directionUser?.id) return directionUser.id;

    const fallback = await this.prisma.utilisateur.findFirst({
      where: {
        etablissement_id: tenantId,
        statut: "ACTIF",
      },
      select: { id: true },
      orderBy: { created_at: "asc" },
    });

    return fallback?.id ?? null;
  }

  private async runCycle(source: "startup" | "interval") {
    if (this.running) return;
    this.running = true;
    try {
      const policies = await this.prisma.regleRecouvrementFinance.findMany({
        where: {
          statut_validation: "APPROUVEE",
        },
        select: {
          etablissement_id: true,
        },
      });

      const tenantIds = Array.from(new Set(policies.map((item) => item.etablissement_id).filter(Boolean)));
      let sentCount = 0;
      let errorCount = 0;

      for (const tenantId of tenantIds) {
        try {
          const senderId = await this.resolveSenderId(tenantId);
          if (!senderId) {
            console.warn(`[Relance finance] Aucun expediteur actif pour l'etablissement ${tenantId}.`);
            continue;
          }

          const result = await this.relanceApp.runCalendarForTenant(tenantId, senderId, new Date());
          sentCount += Array.isArray(result.sent) ? result.sent.length : 0;
        } catch (error) {
          errorCount += 1;
          console.error(`[Relance finance] Echec etablissement ${tenantId}:`, error);
        }
      }

      console.log(
        `[Relance finance] cycle ${source} termine: ${sentCount} relance(s) envoyee(s), ${errorCount} erreur(s).`,
      );
    } catch (error) {
      console.error("[Relance finance] Erreur globale du scheduler:", error);
    } finally {
      this.running = false;
    }
  }
}

export default FinanceRelanceScheduler;
