import { jsPDF } from 'jspdf';

export type TicketPdfContent = {
  headline: string;
  tierName: string;
  attendeeEmail: string;
  ticketId: string;
  issuedAtLabel: string;
  qrNonce: string;
  qrSignature: string;
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

export type TicketPdfAssets = {
  qrDataUrl: string;
  logoWhiteUrl: string | null;
  wordmarkUrl: string | null;
  logoWhiteFit: { w: number; h: number } | null;
  wordmarkFit: { w: number; h: number } | null;
};

export function fitToMaxBox(
  naturalW: number,
  naturalH: number,
  maxW: number,
  maxH: number,
): { w: number; h: number } {
  if (naturalW <= 0 || naturalH <= 0) return { w: maxW, h: maxH };
  const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
  return { w: naturalW * scale, h: naturalH * scale };
}

export function pngDimensionsFromDataUrl(
  dataUrl: string,
): { w: number; h: number } | null {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  if (!base64) return null;
  const buf = Buffer.from(base64, 'base64');
  if (buf.length < 24 || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function formatPassRef(ticketId: string): string {
  const clean = ticketId.replace(/-/g, '').toUpperCase();
  const core = clean.length >= 8 ? clean.slice(0, 8) : clean.padEnd(8, '0');
  return `${core.slice(0, 4)} ${core.slice(4, 8)}`;
}

function drawDashedVLine(
  doc: jsPDF,
  x: number,
  y1: number,
  y2: number,
  dash = 5,
  gap = 4,
): void {
  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.6);
  let y = y1;
  while (y < y2) {
    const yEnd = Math.min(y + dash, y2);
    doc.line(x, y, x, yEnd);
    y += dash + gap;
  }
}

function drawLabelValue(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  maxW: number,
): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...C.muted);
  doc.text(label.toUpperCase(), x, y, { charSpace: 0.6 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C.text);
  const lines = doc.splitTextToSize(value, maxW);
  doc.text(lines, x, y + 11);
  return y + 11 + lines.length * 12.5 + 14;
}

/** Renders a polished pass-style ticket; returns PDF bytes. */
export function renderTicketPdfBuffer(
  content: TicketPdfContent,
  assets: TicketPdfAssets,
): Buffer {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFillColor(241, 242, 245);
  doc.rect(0, 0, pageW, pageH, 'F');

  const cardW = pageW - 80;
  const cardH = 448;
  const cardX = (pageW - cardW) / 2;
  const cardY = (pageH - cardH) / 2;

  doc.setFillColor(210, 212, 220);
  doc.roundedRect(cardX + 3, cardY + 4, cardW, cardH, 14, 14, 'F');

  doc.setFillColor(...C.white);
  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.6);
  doc.roundedRect(cardX, cardY, cardW, cardH, 14, 14, 'FD');

  const pad = 32;
  const headerH = measureHeaderHeight(doc, cardW, pad, content);
  drawHeader(doc, cardX, cardY, cardW, headerH, content, assets);

  const bodyY = cardY + headerH;
  const bodyH = cardH - headerH - 52;
  const splitX = cardX + Math.round(cardW * 0.56);
  const leftX = cardX + pad;
  const leftW = splitX - leftX - 16;
  const rightX = splitX + 20;
  const rightW = cardX + cardW - pad - rightX;

  drawDashedVLine(doc, splitX, bodyY + 22, bodyY + bodyH - 16);

  let ly = bodyY + 26;
  if (content.whenLine) {
    ly = drawLabelValue(doc, 'When', content.whenLine, leftX, ly, leftW);
  }
  if (content.venueLine) {
    ly = drawLabelValue(doc, 'Where', content.venueLine, leftX, ly, leftW);
  }
  if (content.organizerName) {
    ly = drawLabelValue(doc, 'Host', content.organizerName, leftX, ly, leftW);
  }

  ly += 4;
  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.35);
  doc.line(leftX, ly, leftX + leftW, ly);
  ly += 16;

  ly = drawLabelValue(doc, 'Attendee', content.attendeeEmail, leftX, ly, leftW);

  const metaY = ly;
  const halfW = (leftW - 12) / 2;
  drawLabelValue(
    doc,
    'Pass ref',
    formatPassRef(content.ticketId),
    leftX,
    metaY,
    halfW,
  );
  drawLabelValue(
    doc,
    'Issued',
    content.issuedAtLabel,
    leftX + halfW + 12,
    metaY,
    halfW,
  );

  const qrSize = Math.min(152, rightW - 8);
  const qrBlockH = qrSize + 48;
  const qrBlockY = bodyY + (bodyH - qrBlockH) / 2;
  const qrBlockX = rightX + (rightW - qrSize - 24) / 2;

  doc.setFillColor(252, 252, 253);
  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.5);
  doc.roundedRect(qrBlockX, qrBlockY, qrSize + 24, qrBlockH, 10, 10, 'FD');

  doc.setDrawColor(...C.accent);
  doc.setLineWidth(1.5);
  doc.roundedRect(
    qrBlockX + 11,
    qrBlockY + 11,
    qrSize + 2,
    qrSize + 2,
    6,
    6,
    'S',
  );

  doc.addImage(
    assets.qrDataUrl,
    'PNG',
    qrBlockX + 12,
    qrBlockY + 12,
    qrSize,
    qrSize,
  );

  const qrCx = qrBlockX + (qrSize + 24) / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.text);
  doc.text('ENTRY CODE', qrCx, qrBlockY + qrSize + 30, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('Scan at the door', qrCx, qrBlockY + qrSize + 42, { align: 'center' });

  const footerH = 46;
  const footY = cardY + cardH - footerH;
  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.35);
  doc.line(cardX + pad, footY, cardX + cardW - pad, footY);

  // Text-only footer — raster wordmark overlapped legal copy in many clients
  drawWordmarkText(doc, cardX + cardW / 2, footY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.muted);
  doc.text(
    'Non-transferable unless permitted by the organizer  ·  allaxs.com',
    cardX + cardW / 2,
    footY + 32,
    { align: 'center' },
  );

  return Buffer.from(doc.output('arraybuffer'));
}

/** Reserved band for the header mark so the event title never overlaps the logo art. */
const HEADER_LOGO_SLOT_H = 34;

function measureHeaderHeight(
  doc: jsPDF,
  cardW: number,
  pad: number,
  content: TicketPdfContent,
): number {
  const titleW = cardW - pad * 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  const titleLines = doc.splitTextToSize(content.headline, titleW);
  const titleBlock = titleLines.length * 22;
  const tierBlock = 30;
  return Math.max(
    124,
    18 + HEADER_LOGO_SLOT_H + 18 + titleBlock + tierBlock + 14,
  );
}

function drawHeader(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  content: TicketPdfContent,
  assets: TicketPdfAssets,
): void {
  doc.setFillColor(...C.ink);
  doc.roundedRect(x, y, w, h, 14, 14, 'F');
  doc.rect(x, y + h - 14, w, 14, 'F');

  doc.setGState(doc.GState({ opacity: 0.14 }));
  doc.setFillColor(...C.accent);
  doc.rect(x, y, w, h * 0.55, 'F');
  doc.setGState(doc.GState({ opacity: 1 }));

  const stripeY = y + h - 3;
  const third = w / 3;
  doc.setFillColor(...C.accent);
  doc.rect(x, stripeY, third, 3, 'F');
  doc.setFillColor(...C.accentDark);
  doc.rect(x + third, stripeY, third, 3, 'F');
  doc.setFillColor(...C.purple);
  doc.rect(x + third * 2, stripeY, w - third * 2, 3, 'F');

  const pad = 32;
  const titleW = w - pad * 2;
  const logoRowY = y + 18;

  if (assets.logoWhiteUrl && assets.logoWhiteFit) {
    try {
      const drawH = Math.min(assets.logoWhiteFit.h, HEADER_LOGO_SLOT_H - 4);
      const drawW = Math.min(assets.logoWhiteFit.w, 80);
      const logoDrawY = logoRowY + (HEADER_LOGO_SLOT_H - drawH) / 2;
      doc.addImage(
        assets.logoWhiteUrl,
        'PNG',
        x + pad,
        logoDrawY,
        drawW,
        drawH,
      );
    } catch {
      drawHeaderBrandText(doc, x + pad, logoRowY + 14);
    }
  } else {
    drawHeaderBrandText(doc, x + pad, logoRowY + 14);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 202, 214);
  const meta = content.formatChip
    ? `Digital ticket  ·  ${content.formatChip}`
    : 'Digital ticket';
  doc.text(meta, x + w - pad, logoRowY + HEADER_LOGO_SLOT_H / 2 + 2, {
    align: 'right',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(content.headline, titleW);
  const titleY = logoRowY + HEADER_LOGO_SLOT_H + 18;
  doc.text(titleLines, x + pad, titleY);

  const tierY = titleY + titleLines.length * 22 + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const tierW = Math.min(doc.getTextWidth(content.tierName) + 20, titleW);
  doc.setGState(doc.GState({ opacity: 0.16 }));
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x + pad, tierY - 10, tierW, 22, 11, 11, 'F');
  doc.setGState(doc.GState({ opacity: 1 }));
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.roundedRect(x + pad, tierY - 10, tierW, 22, 11, 11, 'S');
  doc.setTextColor(255, 255, 255);
  doc.text(content.tierName, x + pad + 10, tierY + 4);
}

function drawHeaderBrandText(doc: jsPDF, x: number, y: number): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('ALL AXS', x, y);
}

function drawWordmarkText(doc: jsPDF, cx: number, y: number): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text('ALL AXS', cx, y, { align: 'center' });
}
