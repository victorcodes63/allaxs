/**
 * DigitalOcean Spaces (S3-compatible) storage driver
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  IStorage,
  InitUploadParams,
  InitUploadResult,
} from '../interfaces/storage.interface';

@Injectable()
export class SpacesStorage implements IStorage {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly cdnBaseUrl?: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('SPACES_ENDPOINT');
    const region = this.configService.get<string>('SPACES_REGION', 'nyc3');
    const accessKeyId = this.configService.get<string>('SPACES_ACCESS_KEY');
    const secretAccessKey = this.configService.get<string>('SPACES_SECRET_KEY');
    this.bucket = this.configService.get<string>('SPACES_BUCKET') || '';
    this.cdnBaseUrl = this.configService.get<string>('CDN_BASE_URL');
    this.region = region;

    if (!endpoint || !accessKeyId || !secretAccessKey || !this.bucket) {
      throw new Error(
        'Spaces storage requires SPACES_ENDPOINT, SPACES_ACCESS_KEY, SPACES_SECRET_KEY, and SPACES_BUCKET',
      );
    }

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: false, // Use virtual-hosted style URLs
    });
  }

  async initUpload(params: InitUploadParams): Promise<InitUploadResult> {
    const { key, contentType, contentLength } = params;

    // Note: Size validation is done in the controller, not here
    // This driver just generates the presigned URL

    // Create presigned URL for PUT operation (5 minute expiry)
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 300, // 5 minutes
    });

    const finalUrl = this.finalizeUrl(key);

    return {
      mode: 'presigned',
      uploadUrl,
      headers: {
        'Content-Type': contentType,
        'Content-Length': contentLength.toString(),
      },
      finalUrl,
    };
  }

  finalizeUrl(key: string): string {
    // Use CDN base URL if configured, otherwise use virtual-hosted bucket URL
    if (this.cdnBaseUrl) {
      return `${this.cdnBaseUrl.replace(/\/$/, '')}/${key}`;
    }

    // Virtual-hosted style: https://bucket.region.digitaloceanspaces.com/key
    const endpoint = this.configService.get<string>('SPACES_ENDPOINT');
    if (endpoint) {
      try {
        // Extract domain from endpoint (e.g., nyc3.digitaloceanspaces.com)
        const url = new URL(endpoint);
        return `https://${this.bucket}.${url.hostname}/${key}`;
      } catch {
        // If endpoint is not a valid URL, construct from region
        return `https://${this.bucket}.${this.region}.digitaloceanspaces.com/${key}`;
      }
    }

    // Fallback: construct from region (should not happen if endpoint is set)
    return `https://${this.bucket}.${this.region}.digitaloceanspaces.com/${key}`;
  }
}
