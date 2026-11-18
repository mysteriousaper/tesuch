// Server-only (Node runtime): renders the PDF documents to Buffers.
import { renderToBuffer } from "@react-pdf/renderer";
import {
  dismissalNotice, fixedTermEndNotice, probationOrder, readinessChecklist,
  type ChecklistData, type DismissalNoticeData, type FixedTermEndNoticeData, type ProbationOrderData,
} from "./documents";
import { registerFonts } from "./fonts";

export function renderProbationOrder(data: ProbationOrderData): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(probationOrder(data));
}

export function renderFixedTermEndNotice(data: FixedTermEndNoticeData): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(fixedTermEndNotice(data));
}

export function renderDismissalNotice(data: DismissalNoticeData): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(dismissalNotice(data));
}

export function renderChecklist(data: ChecklistData): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(readinessChecklist(data));
}
