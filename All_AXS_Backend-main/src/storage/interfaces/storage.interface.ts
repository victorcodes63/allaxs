/**
 * Storage interface for pluggable file storage drivers
 */

export type InitUploadParams = {
  key: string;
  contentType: string;
  contentLength: number;
};

export type InitUploadResult =
  | {
      mode: 'presigned';
      uploadUrl: string;
      headers: Record<string, string>;
      finalUrl: string;
    }
  | {
      mode: 'direct';
      directUpload: true;
      finalPathHint: string;
    };

export interface IStorage {
  /**
   * Initialize an upload and return either a presigned URL or direct upload info
   */
  initUpload(params: InitUploadParams): Promise<InitUploadResult>;

  /**
   * Build the final public URL from a storage key
   */
  finalizeUrl(key: string): string;

  /**
   * Save a file directly (for local storage only)
   * @param opts - File upload options
   * @returns The final URL of the saved file
   */
  saveDirect?(opts: {
    key: string;
    file: Express.Multer.File;
  }): Promise<string>;
}
