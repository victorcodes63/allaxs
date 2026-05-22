import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as jwt from 'jsonwebtoken';
import * as path from 'path';
import { PKPass } from 'passkit-generator';
import { Repository } from 'typeorm';
import { Ticket } from '../domain/ticket.entity';
import { buildTicketQrUrl } from './ticket-qr.util';
import {
  eventToEmailContext,
  ticketToPdfContent,
  ticketsFromEntities,
} from './ticket-email.util';

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
};

type AppleCertificates = {
  wwdr: Buffer;
  signerCert: Buffer;
  signerKey: Buffer;
  signerKeyPassphrase?: string;
};

@Injectable()
export class WalletPassService {
  private readonly logger = new Logger(WalletPassService.name);
  private readonly frontendUrl: string;
  private bundledIconBuffer: Buffer | null | undefined;
  private appleCertificates: AppleCertificates | null | undefined;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) {
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL')?.replace(/\/$/, '') ||
      'http://localhost:3000';
  }

  isGoogleWalletConfigured(): boolean {
    return this.loadGoogleServiceAccount() !== null;
  }

  isAppleWalletConfigured(): boolean {
    return this.loadAppleCertificates() !== null;
  }

  async buildGoogleSaveUrl(
    userId: string,
    ticketId: string,
    userEmail?: string,
  ): Promise<{ saveUrl: string }> {
    const account = this.loadGoogleServiceAccount();
    if (!account) {
      throw new ServiceUnavailableException(
        'Google Wallet is not configured. Set GOOGLE_WALLET_ISSUER_ID and service account credentials — see docs/WALLET_PASSES.md.',
      );
    }

    const issuerId = this.configService.get<string>('GOOGLE_WALLET_ISSUER_ID')?.trim();
    if (!issuerId) {
      throw new ServiceUnavailableException(
        'GOOGLE_WALLET_ISSUER_ID is required for Google Wallet passes.',
      );
    }

    const ticket = await this.loadTicketForOwner(userId, ticketId, userEmail);
    const event = ticket.order?.event;
    const organizerName = event?.organizer?.orgName ?? null;
    const eventCtx = eventToEmailContext(event, organizerName);
    const pdfContent = ticketToPdfContent(
      ticketsFromEntities([ticket], (t) => t.ticketType?.name ?? 'Ticket')[0],
      eventCtx,
      ticket.attendeeEmail ?? '',
    );
    const qrUrl = buildTicketQrUrl(this.frontendUrl, {
      id: ticket.id,
      qrNonce: ticket.qrNonce,
      qrSignature: ticket.qrSignature,
    });

    const classSuffix = event?.slug?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'default';
    const classId = `${issuerId}.allaxs_event_${classSuffix}`;
    const objectId = `${issuerId}.ticket_${ticket.id.replace(/-/g, '')}`;

    const localized = (value: string) => ({
      defaultValue: { language: 'en-US', value },
    });

    const venueName = [event?.venue, event?.city].filter(Boolean).join(', ') || 'Venue TBA';
    const passRef = this.formatPassRef(ticket.id);

    const payload = {
      eventTicketClasses: [
        {
          id: classId,
          issuerName: 'All AXS',
          reviewStatus: 'UNDER_REVIEW',
          eventName: localized(pdfContent.headline),
          venue: {
            name: localized(venueName),
          },
          ...(event?.startAt
            ? {
                dateTime: {
                  start: event.startAt.toISOString(),
                  ...(event.endAt ? { end: event.endAt.toISOString() } : {}),
                },
              }
            : {}),
        },
      ],
      eventTicketObjects: [
        {
          id: objectId,
          classId,
          state: 'ACTIVE',
          ticketHolderName: ticket.attendeeEmail ?? 'Guest',
          ticketNumber: passRef,
          eventName: localized(pdfContent.headline),
          venue: {
            name: localized(venueName),
          },
          ...(event?.startAt
            ? {
                dateTime: {
                  start: event.startAt.toISOString(),
                  ...(event.endAt ? { end: event.endAt.toISOString() } : {}),
                },
              }
            : {}),
          barcode: {
            type: 'QR_CODE',
            value: qrUrl,
            alternateText: passRef,
          },
          textModulesData: [
            {
              header: 'Tier',
              body: pdfContent.tierName,
              id: 'tier',
            },
            ...(pdfContent.whenLine
              ? [{ header: 'When', body: pdfContent.whenLine, id: 'when' }]
              : []),
          ],
        },
      ],
    };

    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
      {
        iss: account.client_email,
        aud: 'google',
        typ: 'savetowallet',
        iat: now,
        origins: [this.frontendUrl],
        payload,
      },
      account.private_key,
      { algorithm: 'RS256' },
    );

    return { saveUrl: `https://pay.google.com/gp/v/save/${token}` };
  }

  async buildApplePassBuffer(
    userId: string,
    ticketId: string,
    userEmail?: string,
  ): Promise<Buffer> {
    const certs = this.loadAppleCertificates();
    if (!certs) {
      throw new ServiceUnavailableException(
        'Apple Wallet is not configured. Set Apple pass signing certificates — see docs/WALLET_PASSES.md.',
      );
    }

    const passTypeId =
      this.configService.get<string>('APPLE_WALLET_PASS_TYPE_IDENTIFIER')?.trim() ||
      'pass.com.allaxs.ticket';
    const teamId =
      this.configService.get<string>('APPLE_WALLET_TEAM_IDENTIFIER')?.trim() || '';
    if (!teamId) {
      throw new ServiceUnavailableException(
        'APPLE_WALLET_TEAM_IDENTIFIER is required for Apple Wallet passes.',
      );
    }

    const orgName =
      this.configService.get<string>('APPLE_WALLET_ORGANIZATION_NAME')?.trim() ||
      'All AXS';

    const ticket = await this.loadTicketForOwner(userId, ticketId, userEmail);
    const event = ticket.order?.event;
    const organizerName = event?.organizer?.orgName ?? null;
    const eventCtx = eventToEmailContext(event, organizerName);
    const pdfContent = ticketToPdfContent(
      ticketsFromEntities([ticket], (t) => t.ticketType?.name ?? 'Ticket')[0],
      eventCtx,
      ticket.attendeeEmail ?? '',
    );
    const qrUrl = buildTicketQrUrl(this.frontendUrl, {
      id: ticket.id,
      qrNonce: ticket.qrNonce,
      qrSignature: ticket.qrSignature,
    });

    const icon = this.loadBundledIconBuffer();
    const buffers: Record<string, Buffer> = {};
    if (icon) {
      buffers['icon.png'] = icon;
      buffers['icon@2x.png'] = icon;
      buffers['logo.png'] = icon;
    }

    const pass = new PKPass(
      buffers,
      {
        wwdr: certs.wwdr,
        signerCert: certs.signerCert,
        signerKey: certs.signerKey,
        signerKeyPassphrase: certs.signerKeyPassphrase,
      },
      {
        serialNumber: ticket.id,
        description: pdfContent.headline,
        organizationName: orgName,
        passTypeIdentifier: passTypeId,
        teamIdentifier: teamId,
        foregroundColor: 'rgb(255,255,255)',
        backgroundColor: 'rgb(8,10,20)',
        labelColor: 'rgb(240,114,65)',
      },
    );

    pass.type = 'eventTicket';
    pass.setBarcodes({
      message: qrUrl,
      format: 'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
      altText: this.formatPassRef(ticket.id),
    });

    if (event?.startAt) {
      pass.setRelevantDate(event.startAt);
      if (event.endAt) {
        pass.setRelevantDates([
          { startDate: event.startAt, endDate: event.endAt },
        ]);
      }
    }
    if (event?.endAt) {
      pass.setExpirationDate(event.endAt);
    }

    pass.headerFields.push({
      key: 'tier',
      label: 'TIER',
      value: pdfContent.tierName,
    });
    pass.primaryFields.push({
      key: 'event',
      label: 'EVENT',
      value: pdfContent.headline,
    });
    if (pdfContent.whenLine) {
      pass.secondaryFields.push({
        key: 'when',
        label: 'WHEN',
        value: pdfContent.whenLine,
      });
    }
    if (pdfContent.venueLine) {
      pass.auxiliaryFields.push({
        key: 'where',
        label: 'WHERE',
        value: pdfContent.venueLine,
      });
    }
    pass.backFields.push(
      {
        key: 'attendee',
        label: 'Attendee',
        value: pdfContent.attendeeEmail,
      },
      {
        key: 'passId',
        label: 'Pass ID',
        value: ticket.id,
      },
      {
        key: 'issued',
        label: 'Issued',
        value: pdfContent.issuedAtLabel,
      },
    );

    if (organizerName) {
      pass.backFields.push({
        key: 'host',
        label: 'Host',
        value: organizerName,
      });
    }

    return pass.getAsBuffer();
  }

  private async loadTicketForOwner(
    userId: string,
    ticketId: string,
    userEmail?: string,
  ): Promise<Ticket> {
    if (userEmail) {
      await this.ticketRepository
        .createQueryBuilder()
        .update(Ticket)
        .set({ ownerUserId: userId })
        .where('id = :ticketId', { ticketId })
        .andWhere('ownerUserId IS NULL')
        .andWhere('attendeeEmail IS NOT NULL')
        .andWhere('LOWER(attendeeEmail) = LOWER(:email)', { email: userEmail })
        .execute();
    }

    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId, ownerUserId: userId },
      relations: ['order', 'order.event', 'order.event.organizer', 'ticketType'],
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  private formatPassRef(ticketId: string): string {
    return ticketId.startsWith('tk_')
      ? ticketId.slice(3, 11).toUpperCase()
      : ticketId.slice(0, 8).toUpperCase();
  }

  private loadGoogleServiceAccount(): GoogleServiceAccount | null {
    const jsonRaw = this.configService.get<string>('GOOGLE_WALLET_SERVICE_ACCOUNT_JSON');
    if (jsonRaw?.trim()) {
      try {
        const parsed = JSON.parse(jsonRaw) as GoogleServiceAccount;
        if (parsed.client_email && parsed.private_key) {
          return {
            client_email: parsed.client_email,
            private_key: parsed.private_key.replace(/\\n/g, '\n'),
          };
        }
      } catch (err) {
        this.logger.warn(`Invalid GOOGLE_WALLET_SERVICE_ACCOUNT_JSON: ${err}`);
      }
    }

    const email = this.configService.get<string>('GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL')?.trim();
    const key = this.configService
      .get<string>('GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n')
      .trim();
    if (email && key) {
      return { client_email: email, private_key: key };
    }

    return null;
  }

  private loadAppleCertificates(): AppleCertificates | null {
    if (this.appleCertificates !== undefined) {
      return this.appleCertificates;
    }

    const wwdr = this.readCertMaterial('APPLE_WALLET_WWDR_CERT_PEM', 'APPLE_WALLET_WWDR_CERT_PATH');
    const signerCert = this.readCertMaterial(
      'APPLE_WALLET_SIGNER_CERT_PEM',
      'APPLE_WALLET_SIGNER_CERT_PATH',
    );
    const signerKey = this.readCertMaterial(
      'APPLE_WALLET_SIGNER_KEY_PEM',
      'APPLE_WALLET_SIGNER_KEY_PATH',
    );

    if (!wwdr || !signerCert || !signerKey) {
      this.appleCertificates = null;
      return null;
    }

    this.appleCertificates = {
      wwdr,
      signerCert,
      signerKey,
      signerKeyPassphrase:
        this.configService.get<string>('APPLE_WALLET_SIGNER_KEY_PASSPHRASE')?.trim() ||
        undefined,
    };
    return this.appleCertificates;
  }

  private readCertMaterial(pemEnv: string, pathEnv: string): Buffer | null {
    const inline = this.configService.get<string>(pemEnv)?.trim();
    if (inline) {
      return Buffer.from(inline.replace(/\\n/g, '\n'), 'utf8');
    }

    const filePath = this.configService.get<string>(pathEnv)?.trim();
    if (filePath && fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }

    return null;
  }

  private loadBundledIconBuffer(): Buffer | null {
    if (this.bundledIconBuffer !== undefined) {
      return this.bundledIconBuffer;
    }

    const candidates = [
      path.join(__dirname, '..', 'assets', 'brand', 'logo-mark-white.png'),
      path.join(__dirname, '..', '..', 'assets', 'brand', 'logo-mark-white.png'),
      path.join(process.cwd(), 'src', 'assets', 'brand', 'logo-mark-white.png'),
      path.join(process.cwd(), 'dist', 'assets', 'brand', 'logo-mark-white.png'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        this.bundledIconBuffer = fs.readFileSync(candidate);
        return this.bundledIconBuffer;
      }
    }

    this.logger.warn(
      'Wallet pass icon missing (src/assets/brand/logo-mark-white.png). Run: npm run sync:brand-assets',
    );
    this.bundledIconBuffer = null;
    return null;
  }
}
