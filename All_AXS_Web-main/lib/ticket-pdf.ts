import QRCode from "qrcode";

export type TicketPdfContent = {
  headline: string;
  tierName: string;
  attendeeEmail: string;
  ticketId: string;
  issuedAtLabel: string;
  qrPayload: string;
  whenLine: string | null;
  venueLine: string | null;
  organizerName: string | null;
  formatChip: string | null;
};

const C = {
  ink: [8, 10, 20] as [number, number, number],
  accent: [240, 114, 65] as [number, number, number],
  accentDark: [192, 41, 66] as [number, number, number],
  purple: [96, 24, 72] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  muted: [108, 112, 122] as [number, number, number],
  text: [28, 30, 38] as [number, number, number],
  line: [234, 236, 242] as [number, number, number],
};

async function fetchImageDataUrl(path: string, origin: string): Promise<string | null> {
  const url = path.startsWith("http") ? path : `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function measureImage(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("decode failed"));
    img.src = dataUrl;
  });
}

function fitToMaxBox(nw: number, nh: number, maxW: number, maxH: number) {
  if (nw <= 0 || nh <= 0) return { w: maxW, h: maxH };
  const s = Math.min(maxW / nw, maxH / nh, 1);
  return { w: nw * s, h: nh * s };
}

function formatPassRef(ticketId: string): string {
  const clean = ticketId.replace(/-/g, "").toUpperCase();
  const core = clean.length >= 8 ? clean.slice(0, 8) : clean.padEnd(8, "0");
  return `${core.slice(0, 4)} ${core.slice(4, 8)}`;
}

type JsPdf = import("jspdf").jsPDF;

function drawDashedVLine(doc: JsPdf, x: number, y1: number, y2: number) {
  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.6);
  let y = y1;
  while (y < y2) {
    const end = Math.min(y + 5, y2);
    doc.line(x, y, x, end);
    y += 9;
  }
}

function drawLabelValue(
  doc: JsPdf,
  label: string,
  value: string,
  x: number,
  y: number,
  maxW: number
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...C.muted);
  doc.text(label.toUpperCase(), x, y, { charSpace: 0.6 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...C.text);
  const lines = doc.splitTextToSize(value, maxW);
  doc.text(lines, x, y + 11);
  return y + 11 + lines.length * 12.5 + 14;
}

/** Branded ticket PDF — layout matches email attachment. */
export async function downloadTicketPdf(
  content: TicketPdfContent,
  options: { origin: string; fileBaseName?: string }
): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const [qrDataUrl, logoWhiteUrl] = await Promise.all([
    QRCode.toDataURL(content.qrPayload, {
      width: 720,
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#080a14", light: "#ffffff" },
    }),
    fetchImageDataUrl("/brand/logo-mark-white.png", options.origin),
  ]);

  let logoFit: { w: number; h: number } | null = null;
  if (logoWhiteUrl) {
    try {
      const { w, h } = await measureImage(logoWhiteUrl);
      logoFit = fitToMaxBox(w, h, 88, 22);
    } catch {
      logoFit = null;
    }
  }

  const HEADER_LOGO_SLOT_H = 34;

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFillColor(241, 242, 245);
  doc.rect(0, 0, pageW, pageH, "F");

  const cardW = pageW - 80;
  const cardH = 448;
  const cardX = (pageW - cardW) / 2;
  const cardY = (pageH - cardH) / 2;

  doc.setFillColor(210, 212, 220);
  doc.roundedRect(cardX + 3, cardY + 4, cardW, cardH, 14, 14, "F");
  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.6);
  doc.roundedRect(cardX, cardY, cardW, cardH, 14, 14, "FD");

  const pad = 32;
  const titleW = cardW - pad * 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  const titleLines = doc.splitTextToSize(content.headline, titleW);
  const headerH = Math.max(
    124,
    18 + HEADER_LOGO_SLOT_H + 18 + titleLines.length * 22 + 30 + 14
  );
  const hx = cardX;
  const hy = cardY;

  doc.setFillColor(...C.ink);
  doc.roundedRect(hx, hy, cardW, headerH, 14, 14, "F");
  doc.rect(hx, hy + headerH - 14, cardW, 14, "F");
  doc.setGState(doc.GState({ opacity: 0.14 }));
  doc.setFillColor(...C.accent);
  doc.rect(hx, hy, cardW, headerH * 0.55, "F");
  doc.setGState(doc.GState({ opacity: 1 }));
  const stripeY = hy + headerH - 3;
  const third = cardW / 3;
  doc.setFillColor(...C.accent);
  doc.rect(hx, stripeY, third, 3, "F");
  doc.setFillColor(...C.accentDark);
  doc.rect(hx + third, stripeY, third, 3, "F");
  doc.setFillColor(...C.purple);
  doc.rect(hx + third * 2, stripeY, cardW - third * 2, 3, "F");

  const logoRowY = hy + 18;
  if (logoWhiteUrl && logoFit) {
    try {
      const drawH = Math.min(logoFit.h, HEADER_LOGO_SLOT_H - 4);
      const drawW = Math.min(logoFit.w, 80);
      const logoDrawY = logoRowY + (HEADER_LOGO_SLOT_H - drawH) / 2;
      doc.addImage(logoWhiteUrl, "PNG", hx + pad, logoDrawY, drawW, drawH);
    } catch {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text("ALL AXS", hx + pad, logoRowY + 14);
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("ALL AXS", hx + pad, logoRowY + 14);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(200, 202, 214);
  const meta = content.formatChip
    ? `Digital ticket  ·  ${content.formatChip}`
    : "Digital ticket";
  doc.text(meta, hx + cardW - pad, logoRowY + HEADER_LOGO_SLOT_H / 2 + 2, {
    align: "right",
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(255, 255, 255);
  const titleY = logoRowY + HEADER_LOGO_SLOT_H + 18;
  doc.text(titleLines, hx + pad, titleY);
  const tierY = titleY + titleLines.length * 22 + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  const tierW = Math.min(doc.getTextWidth(content.tierName) + 20, titleW);
  doc.setGState(doc.GState({ opacity: 0.16 }));
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(hx + pad, tierY - 10, tierW, 22, 11, 11, "F");
  doc.setGState(doc.GState({ opacity: 1 }));
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.roundedRect(hx + pad, tierY - 10, tierW, 22, 11, 11, "S");
  doc.setTextColor(255, 255, 255);
  doc.text(content.tierName, hx + pad + 10, tierY + 4);

  const bodyY = cardY + headerH;
  const bodyH = cardH - headerH - 52;
  const splitX = cardX + Math.round(cardW * 0.56);
  const leftX = cardX + pad;
  const leftW = splitX - leftX - 16;
  const rightX = splitX + 20;
  const rightW = cardX + cardW - pad - rightX;

  drawDashedVLine(doc, splitX, bodyY + 22, bodyY + bodyH - 16);

  let ly = bodyY + 26;
  if (content.whenLine) ly = drawLabelValue(doc, "When", content.whenLine, leftX, ly, leftW);
  if (content.venueLine) ly = drawLabelValue(doc, "Where", content.venueLine, leftX, ly, leftW);
  if (content.organizerName) ly = drawLabelValue(doc, "Host", content.organizerName, leftX, ly, leftW);
  ly += 4;
  doc.setDrawColor(...C.line);
  doc.line(leftX, ly, leftX + leftW, ly);
  ly += 16;
  ly = drawLabelValue(doc, "Attendee", content.attendeeEmail, leftX, ly, leftW);
  const metaY = ly;
  const halfW = (leftW - 12) / 2;
  drawLabelValue(doc, "Pass ref", formatPassRef(content.ticketId), leftX, metaY, halfW);
  drawLabelValue(doc, "Issued", content.issuedAtLabel, leftX + halfW + 12, metaY, halfW);

  const qrSize = Math.min(152, rightW - 8);
  const qrBlockH = qrSize + 48;
  const qrBlockY = bodyY + (bodyH - qrBlockH) / 2;
  const qrBlockX = rightX + (rightW - qrSize - 24) / 2;

  doc.setFillColor(252, 252, 253);
  doc.setDrawColor(...C.line);
  doc.roundedRect(qrBlockX, qrBlockY, qrSize + 24, qrBlockH, 10, 10, "FD");
  doc.setDrawColor(...C.accent);
  doc.setLineWidth(1.5);
  doc.roundedRect(qrBlockX + 11, qrBlockY + 11, qrSize + 2, qrSize + 2, 6, 6, "S");
  doc.addImage(qrDataUrl, "PNG", qrBlockX + 12, qrBlockY + 12, qrSize, qrSize);
  const qrCx = qrBlockX + (qrSize + 24) / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.text);
  doc.text("ENTRY CODE", qrCx, qrBlockY + qrSize + 30, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text("Scan at the door", qrCx, qrBlockY + qrSize + 42, { align: "center" });

  const footerH = 46;
  const footY = cardY + cardH - footerH;
  doc.setDrawColor(...C.line);
  doc.line(cardX + pad, footY, cardX + cardW - pad, footY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text("ALL AXS", cardX + cardW / 2, footY + 16, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(
    "Non-transferable unless permitted by the organizer  ·  allaxs.com",
    cardX + cardW / 2,
    footY + 32,
    { align: "center" }
  );

  const base = options.fileBaseName ?? `ticket-${content.ticketId}`;
  doc.save(`${base.replace(/[^a-zA-Z0-9-_]+/g, "-")}.pdf`);
}
