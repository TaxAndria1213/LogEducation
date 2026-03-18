declare module "jspdf-autotable" {
  import type jsPDF from "jspdf";
  export interface AutoTableOptions {
    startY?: number;
    head?: (string | string[] | Record<string, unknown>)[][];
    body?: (string | number | boolean | null | undefined)[][];
    styles?: Record<string, unknown>;
    headStyles?: Record<string, unknown>;
    alternateRowStyles?: Record<string, unknown>;
    margin?: Record<string, unknown>;
  }
  export default function autoTable(doc: jsPDF, options: AutoTableOptions): jsPDF;
}
