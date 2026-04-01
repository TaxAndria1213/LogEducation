import { Prisma, PrismaClient } from "@prisma/client";
import { roundMoney, toMoney } from "./echeance_paiement";

type DbClient = PrismaClient | Prisma.TransactionClient;

function normalizeJsonObject(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function normalizeRelanceDays(value: Prisma.JsonValue | null | undefined) {
  const direct = Array.isArray(value) ? value : normalizeJsonObject(value)?.days;
  const days = Array.isArray(direct)
    ? direct
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item >= 0)
        .map((item) => Math.trunc(item))
    : [];
  return Array.from(new Set(days)).sort((left, right) => left - right);
}

export async function getApprovedRecoveryPolicy(prisma: DbClient, tenantId: string) {
  return prisma.regleRecouvrementFinance.findFirst({
    where: {
      etablissement_id: tenantId,
      statut_validation: "APPROUVEE",
    },
  });
}

export function calculateRecoveryPenalty(args: {
  policy: {
    penalite_active?: boolean | null;
    penalite_mode?: string | null;
    penalite_valeur?: Prisma.Decimal | number | null;
    jours_grace?: number | null;
  } | null;
  overdueAmount: number;
  dueDate: Date;
  paymentDate: Date;
}) {
  const policy = args.policy;
  if (!policy?.penalite_active) return 0;

  const paymentDate = new Date(args.paymentDate);
  paymentDate.setHours(0, 0, 0, 0);
  const dueDate = new Date(args.dueDate);
  dueDate.setHours(0, 0, 0, 0);

  const elapsedDays = Math.floor((paymentDate.getTime() - dueDate.getTime()) / 86400000);
  const graceDays = Math.max(0, Number(policy.jours_grace ?? 0) || 0);
  if (elapsedDays <= graceDays) return 0;

  const overdueAmount = roundMoney(Math.max(0, toMoney(args.overdueAmount)));
  const rawValue = roundMoney(Math.max(0, toMoney(policy.penalite_valeur ?? 0)));
  if (rawValue <= 0 || overdueAmount <= 0) return 0;

  const mode = String(policy.penalite_mode ?? "FIXED").trim().toUpperCase();
  if (mode === "PERCENT") {
    return roundMoney(overdueAmount * (rawValue / 100));
  }

  return rawValue;
}
