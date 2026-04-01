import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

type ArchiveDocumentArgs = {
  tenantId: string;
  ownerUserId?: string | null;
  entityType: string;
  entityId: string;
  tag: string;
  documentPath?: string | null;
  documentReference?: string | null;
};

function normalizeText(value?: string | null) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function resolveStoredPath(documentPath?: string | null, documentReference?: string | null) {
  const normalizedPath = normalizeText(documentPath);
  if (normalizedPath) return normalizedPath;

  const normalizedReference = normalizeText(documentReference);
  if (normalizedReference) return `reference:${normalizedReference}`;

  return null;
}

function detectStorageProvider(path: string) {
  if (/^https?:\/\//i.test(path)) return "URL_EXTERNE";
  if (/^[a-z]:\\/i.test(path) || path.startsWith("/") || path.startsWith("\\")) {
    return "CHEMIN_DOCUMENTAIRE";
  }
  if (path.startsWith("reference:")) return "REFERENCE_DOCUMENTAIRE";
  return "DOCUMENT_ARCHIVE";
}

function detectMimeType(path: string) {
  const cleanPath = path.split("?")[0]?.toLowerCase() ?? "";
  if (cleanPath.endsWith(".pdf")) return "application/pdf";
  if (cleanPath.endsWith(".png")) return "image/png";
  if (cleanPath.endsWith(".jpg") || cleanPath.endsWith(".jpeg")) return "image/jpeg";
  if (cleanPath.endsWith(".webp")) return "image/webp";
  if (cleanPath.endsWith(".doc")) return "application/msword";
  if (cleanPath.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (cleanPath.endsWith(".xls")) return "application/vnd.ms-excel";
  if (cleanPath.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  return null;
}

export async function archiveLinkedDocument(db: DbClient, args: ArchiveDocumentArgs) {
  const storedPath = resolveStoredPath(args.documentPath, args.documentReference);
  if (!storedPath) return null;

  const fournisseurStockage = detectStorageProvider(storedPath);
  const typeMime = detectMimeType(storedPath);

  const existingLink = await db.lienFichier.findFirst({
    where: {
      type_entite: args.entityType,
      id_entite: args.entityId,
      tag: args.tag,
    },
    include: {
      fichier: true,
    },
  });

  if (existingLink?.fichier) {
    const fichier = await db.fichier.update({
      where: { id: existingLink.fichier.id },
      data: {
        etablissement_id: args.tenantId,
        proprietaire_utilisateur_id: args.ownerUserId ?? existingLink.fichier.proprietaire_utilisateur_id,
        fournisseur_stockage: fournisseurStockage,
        chemin: storedPath,
        type_mime: typeMime,
      },
    });

    return {
      id: fichier.id,
      chemin: fichier.chemin,
      fournisseur_stockage: fichier.fournisseur_stockage,
      tag: args.tag,
    };
  }

  const fichier = await db.fichier.create({
    data: {
      etablissement_id: args.tenantId,
      proprietaire_utilisateur_id: args.ownerUserId ?? null,
      fournisseur_stockage: fournisseurStockage,
      chemin: storedPath,
      type_mime: typeMime,
    },
  });

  await db.lienFichier.create({
    data: {
      fichier_id: fichier.id,
      type_entite: args.entityType,
      id_entite: args.entityId,
      tag: args.tag,
    },
  });

  return {
    id: fichier.id,
    chemin: fichier.chemin,
    fournisseur_stockage: fichier.fournisseur_stockage,
    tag: args.tag,
  };
}
