declare module "jspdf-autotable" {
  import type jsPDF from "jspdf";
  export interface HookData {
    section?: string;
    column: { index: number };
    cell: {
      raw?: unknown;
      styles: Record<string, unknown>;
      text: string[];
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }
  export interface AutoTableOptions {
    startY?: number;
    head?: (string | string[] | Record<string, unknown>)[][];
    body?: unknown[][];
    styles?: Record<string, unknown>;
    headStyles?: Record<string, unknown>;
    alternateRowStyles?: Record<string, unknown>;
    margin?: Record<string, unknown>;
    theme?: string;
    pageBreak?: string;
    rowPageBreak?: string;
    tableLineColor?: number[];
    tableLineWidth?: number;
    didParseCell?: (data: HookData) => void;
    didDrawCell?: (data: HookData) => void;
  }
  export default function autoTable(doc: jsPDF, options: AutoTableOptions): jsPDF;
}
