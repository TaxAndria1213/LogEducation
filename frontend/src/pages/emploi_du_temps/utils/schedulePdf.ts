import autoTable from "jspdf-autotable";
import type { Classe, Cours, CreneauHoraire, Salle } from "../../../types/models";
import { createPdfDocument, savePdf } from "../../../utils/pdf";
import {
  getPlannerCellKey,
  type PlannerCellDraft,
} from "../types";

type DayOption = {
  value: number;
  label: string;
  helper?: string | null;
};

type PdfBodyCell = {
  content: string;
  rowSpan?: number;
  styles?: Record<string, unknown>;
  meta?: {
    title?: string;
    subtitle?: string;
    interval?: string;
    isEmpty?: boolean;
  };
};

type CourseLike = Cours & {
  matiere?: { nom?: string | null } | null;
  enseignant?: {
    personnel?: {
      code_personnel?: string | null;
      poste?: string | null;
      utilisateur?: {
        profil?: {
          prenom?: string | null;
          nom?: string | null;
        } | null;
      } | null;
    } | null;
  } | null;
};

type RoomLike = Salle & {
  site?: { nom?: string | null } | null;
};

type SchedulePdfInput = {
  classe?: Classe | null;
  currentYear?: {
    nom?: string | null;
    date_debut?: Date | string | null;
    date_fin?: Date | string | null;
  } | null;
  days: DayOption[];
  creneaux: CreneauHoraire[];
  planner: Record<string, PlannerCellDraft>;
  courseByCell: Record<string, CourseLike | null>;
  roomById: Record<string, RoomLike | undefined>;
  activeWindow?: {
    start?: Date | string | null;
    end?: Date | string | null;
  } | null;
};

function truncateLabel(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function formatTimeForPdf(value?: string | null) {
  if (!value) return "";
  const [rawHours, rawMinutes] = value.split(":");
  const hours = Number.parseInt(rawHours ?? "", 10);
  const minutes = Number.parseInt(rawMinutes ?? "", 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${`${minutes}`.padStart(2, "0")}`;
}

function buildCellLabel(course: CourseLike | null, room?: RoomLike) {
  if (!course) return "";

  const parts = [course.matiere?.nom ?? "Cours"];

  if (room?.nom) {
    parts.push(room.nom);
  }

  return truncateLabel(parts.filter(Boolean).join(" - "), 28);
}

function getCellSignature(cell?: PlannerCellDraft | null) {
  if (!cell?.cours_id && !cell?.isPause) return null;
  if (cell?.isPause) return "pause";
  return `course:${cell.cours_id ?? ""}:${cell.salle_id ?? ""}`;
}

export function downloadSchedulePdf(input: SchedulePdfInput) {
  const doc = createPdfDocument("landscape");
  const classeName = input.classe?.nom ?? "Classe";
  const yearName = input.currentYear?.nom ?? "-";
  const filename = `emploi-du-temps-${classeName.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "classe"}.pdf`;
  const creneauxToPrint = input.creneaux;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 6;
  const marginY = 6;
  const titleY = 8;
  const infoY = 13;
  const tableStartY = 17;

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Emploi du temps", marginX, titleY);

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Classe : ${classeName}    |    Annee scolaire : ${yearName}`,
    marginX,
    infoY,
  );

  const rowSpanByKey = new Map<string, number>();
  const hiddenKeys = new Set<string>();

  input.days.forEach((day) => {
    for (let rowIndex = 0; rowIndex < creneauxToPrint.length; rowIndex += 1) {
      const currentCreneau = creneauxToPrint[rowIndex];
      const currentKey = getPlannerCellKey(day.value, currentCreneau.id);
      const currentSignature = getCellSignature(input.planner[currentKey]);

      let rowSpan = 1;
      if (currentSignature) {
        while (rowIndex + rowSpan < creneauxToPrint.length) {
          const nextCreneau = creneauxToPrint[rowIndex + rowSpan];
          const nextKey = getPlannerCellKey(day.value, nextCreneau.id);
          if (getCellSignature(input.planner[nextKey]) !== currentSignature) break;
          hiddenKeys.add(nextKey);
          rowSpan += 1;
        }
      }

      rowSpanByKey.set(currentKey, rowSpan);
      rowIndex += rowSpan - 1;
    }
  });

  if (creneauxToPrint.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Aucun cours planifie sur la periode selectionnee.", marginX, tableStartY + 6);
    savePdf(doc, filename);
    return;
  }

  const availableHeight = pageHeight - tableStartY - marginY;
  const estimatedRows = creneauxToPrint.length + 1;
  const targetRowHeight = Math.max(4.5, Math.min(7.8, availableHeight / estimatedRows));
  const fontSize = Math.max(5.2, Math.min(6.8, targetRowHeight * 0.58));
  const cellPadding = Math.max(0.35, Math.min(0.95, (targetRowHeight - fontSize * 0.78) / 2));
  const timeColumnWidth = 26;
  const dayColumnWidth = (pageWidth - marginX * 2 - timeColumnWidth) / Math.max(1, input.days.length);
  const dayHeaderFontSize = Math.min(9.2, fontSize + 2);

  autoTable(doc, {
    startY: tableStartY,
    theme: "grid",
    margin: { left: marginX, right: marginX, top: marginY, bottom: marginY },
    pageBreak: "avoid",
    rowPageBreak: "avoid",
    tableLineColor: [203, 213, 225],
    tableLineWidth: 0.15,
    styles: {
      fontSize,
      cellPadding,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      valign: "middle",
      textColor: [30, 41, 59],
      overflow: "hidden",
    },
    head: [[
      {
        content: "Horaire",
        styles: {
          fillColor: [15, 23, 42],
          textColor: 255,
          halign: "center",
          fontStyle: "bold",
          cellWidth: timeColumnWidth,
          fontSize: dayHeaderFontSize,
        },
      },
      ...input.days.map((day) => ({
        content: day.label,
        styles: {
          fillColor: [15, 23, 42],
          textColor: 255,
          halign: "center",
          fontStyle: "bold",
          cellWidth: dayColumnWidth,
          fontSize: dayHeaderFontSize,
        },
      })),
    ]],
    body: creneauxToPrint.map((creneau) => {
      const row: Array<string | PdfBodyCell> = [
        {
          content: `${creneau.heure_debut} - ${creneau.heure_fin}`,
          styles: {
            fillColor: [248, 250, 252],
            fontStyle: "bold",
            halign: "center",
            cellWidth: timeColumnWidth,
          },
        },
      ];

      input.days.forEach((day) => {
        const key = getPlannerCellKey(day.value, creneau.id);

        if (hiddenKeys.has(key)) {
          return;
        }

        const cell = input.planner[key];
        const room = cell?.salle_id ? input.roomById[cell.salle_id] : undefined;
        const rowSpan = rowSpanByKey.get(key) ?? 1;
        const endCreneau = creneauxToPrint[
          Math.min(
            creneauxToPrint.length - 1,
            creneauxToPrint.indexOf(creneau) + rowSpan - 1,
          )
        ];
        const mergedInterval = `${formatTimeForPdf(creneau.heure_debut)} - ${formatTimeForPdf(
          endCreneau?.heure_fin ?? creneau.heure_fin,
        )}`;
        const label = cell?.isPause ? "Pause" : buildCellLabel(input.courseByCell[key] ?? null, room);

        row.push({
          content: "",
          rowSpan,
          meta: {
            title: cell?.isPause ? "Pause" : label,
            subtitle: cell?.isPause ? "" : room?.nom ?? "",
            interval: cell?.isPause || label ? mergedInterval : "",
            isEmpty: !cell?.isPause && !cell?.cours_id,
          },
          styles: {
            fillColor: cell?.isPause
              ? [254, 243, 199]
              : cell?.cours_id
                ? [240, 253, 244]
                : [255, 255, 255],
            textColor: cell?.isPause ? [146, 64, 14] : [15, 23, 42],
            halign: "center",
            valign: "middle",
            fontStyle: cell?.cours_id || cell?.isPause ? "bold" : "normal",
            minCellHeight: targetRowHeight,
            cellWidth: dayColumnWidth,
          },
        });
      });

      return row;
    }),
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index > 0) {
        const raw = data.cell.raw as PdfBodyCell | undefined;
        if (raw?.meta?.isEmpty) {
          data.cell.styles.fillColor = [255, 255, 255];
          data.cell.styles.minCellHeight = targetRowHeight;
        }
        data.cell.text = [];
      }
    },
    didDrawCell: (data) => {
      if (data.section !== "body" || data.column.index === 0) return;

      const raw = data.cell.raw as PdfBodyCell | undefined;
      const meta = raw?.meta;
      if (!meta || meta.isEmpty) return;

      const x = data.cell.x;
      const y = data.cell.y;
      const width = data.cell.width;
      const height = data.cell.height;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const title = truncateLabel(meta.title ?? "", height > targetRowHeight * 1.8 ? 30 : 24);
      const subtitle = truncateLabel(meta.subtitle ?? "", 24);
      const interval = meta.interval ?? "";
      const lines = [title, subtitle, interval].filter(Boolean);

      if (lines.length === 0) return;

      const titleSize = Math.min(8.2, fontSize + 1.4);
      const subSize = Math.max(4.8, fontSize - 0.2);
      const intervalSize = Math.max(4.6, fontSize - 0.5);
      const lineHeights = [
        title ? titleSize * 0.34 : 0,
        subtitle ? subSize * 0.34 : 0,
        interval ? intervalSize * 0.34 : 0,
      ].filter((value) => value > 0);
      const totalTextHeight =
        lineHeights.reduce((sum, value) => sum + value, 0) +
        Math.max(0, lineHeights.length - 1) * 1.05;
      let cursorY = centerY - totalTextHeight / 2 + 1.2;

      doc.setTextColor(meta.title === "Pause" ? 146 : 15, meta.title === "Pause" ? 64 : 23, meta.title === "Pause" ? 14 : 42);
      if (title) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(titleSize);
        doc.text(title, centerX, cursorY, { align: "center", baseline: "middle" });
        cursorY += titleSize * 0.34 + 1.05;
      }

      if (subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(subSize);
        doc.setTextColor(71, 85, 105);
        doc.text(subtitle, centerX, cursorY, { align: "center", baseline: "middle" });
        cursorY += subSize * 0.34 + 1.05;
      }

      if (interval) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(intervalSize);
        doc.setTextColor(51, 65, 85);
        doc.text(interval, centerX, cursorY, { align: "center", baseline: "middle" });
      }
    },
  });

  savePdf(doc, filename);
}

