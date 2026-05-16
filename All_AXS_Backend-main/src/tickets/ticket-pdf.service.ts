import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import { buildTicketQrUrl } from './ticket-qr.util';
import {
  fitToMaxBox,
  pngDimensionsFromDataUrl,
  renderTicketPdfBuffer,
  type TicketPdfContent,
} from './ticket-pdf.layout';

export type { TicketPdfContent };

/** Source of truth: All_AXS_Web-main/public/brand/ — sync via `npm run sync:brand-assets`. */
const BUNDLED_LOGO_REL = path.join('brand', 'logo-mark-white.png');

@Injectable()
export class TicketPdfService {
  private readonly logger = new Logger(TicketPdfService.name);
  private readonly frontendUrl: string;
  private bundledLogoDataUrl: string | null | undefined;

  constructor(private readonly configService: ConfigService) {
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL')?.replace(/\/$/, '') ||
      'http://localhost:3000';
  }

  async buildTicketPdfBuffer(content: TicketPdfContent): Promise<Buffer> {
    const qrPayload = buildTicketQrUrl(this.frontendUrl, {
      id: content.ticketId,
      qrNonce: content.qrNonce,
      qrSignature: content.qrSignature,
    });

    const [qrDataUrl, logoWhiteUrl] = await Promise.all([
      QRCode.toDataURL(qrPayload, {
        width: 720,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: { dark: '#080a14', light: '#ffffff' },
      }),
      Promise.resolve(this.loadBundledLogoDataUrl()),
    ]);

    const logoDims = logoWhiteUrl
      ? pngDimensionsFromDataUrl(logoWhiteUrl)
      : null;
    /** Compact mark in the header row — avoids overlapping the event title. */
    const logoWhiteFit = logoDims
      ? fitToMaxBox(logoDims.w, logoDims.h, 88, 22)
      : null;

    return renderTicketPdfBuffer(content, {
      qrDataUrl,
      logoWhiteUrl,
      wordmarkUrl: null,
      logoWhiteFit,
      wordmarkFit: null,
    });
  }

  private resolveBundledAssetPath(relativePath: string): string | null {
    const candidates = [
      path.join(__dirname, '..', 'assets', relativePath),
      path.join(__dirname, '..', '..', 'assets', relativePath),
      path.join(process.cwd(), 'src', 'assets', relativePath),
      path.join(process.cwd(), 'dist', 'assets', relativePath),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  private loadBundledLogoDataUrl(): string | null {
    if (this.bundledLogoDataUrl !== undefined) {
      return this.bundledLogoDataUrl;
    }

    const filePath = this.resolveBundledAssetPath(BUNDLED_LOGO_REL);
    if (!filePath) {
      this.logger.warn(
        `Bundled ticket PDF logo missing (src/assets/${BUNDLED_LOGO_REL}). Run: npm run sync:brand-assets`,
      );
      this.bundledLogoDataUrl = null;
      return null;
    }

    try {
      const buf = fs.readFileSync(filePath);
      this.bundledLogoDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
      return this.bundledLogoDataUrl;
    } catch (err) {
      this.logger.debug(`Bundled logo read failed for ${filePath}: ${err}`);
      this.bundledLogoDataUrl = null;
      return null;
    }
  }
}
