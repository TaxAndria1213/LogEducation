import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type PdfMetadataItem = {
  label: string;
  value: string;
};

type PdfHeaderOptions = {
  title: string;
  subtitle?: string;
  metadata?: PdfMetadataItem[];
  startY?: number;
};

type PdfTableOptions = {
  head: string[];
  body: Array<Array<string | number | boolean | null | undefined>>;
  startY: number;
  title?: string;
};

export function createPdfDocument(orientation: "portrait" | "landscape" = "portrait") {
  return new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
  });
}

export function addPdfHeader(doc: jsPDF, options: PdfHeaderOptions) {
  const startY = options.startY ?? 18;

  doc.setFontSize(16);
  doc.text(options.title, 14, startY);

  let cursorY = startY + 8;

  if (options.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(90, 102, 118);
    doc.text(options.subtitle, 14, cursorY);
    cursorY += 8;
  }

  if (options.metadata?.length) {
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);

    options.metadata.forEach((item, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = column === 0 ? 14 : 108;
      const y = cursorY + row * 6;
      doc.text(`${item.label} : ${item.value || "-"}`, x, y);
    });

    cursorY += Math.ceil(options.metadata.length / 2) * 6 + 4;
  }

  doc.setTextColor(0, 0, 0);
  return cursorY;
}

export function addPdfTable(doc: jsPDF, options: PdfTableOptions) {
  let startY = options.startY;

  if (options.title) {
    doc.setFontSize(11);
    doc.text(options.title, 14, startY);
    startY += 6;
  }

  autoTable(doc, {
    startY,
    head: [options.head],
    body: options.body,
    styles: { fontSize: 9, cellPadding: 2.8, valign: "middle" },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 14, right: 14 },
  });

  return getPdfCursorY(doc);
}

export function getPdfCursorY(doc: jsPDF, fallback = 20) {
  return (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
    ?.finalY ?? fallback;
}

export function savePdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}
