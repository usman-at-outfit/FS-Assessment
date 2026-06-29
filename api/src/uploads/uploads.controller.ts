import {
  Controller, Post, UploadedFiles, UseGuards, UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname as pathExtname, join } from 'path';
import { randomBytes } from 'crypto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** Derive extension from the mime type (not from originalname — attacker-controlled). */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/gif':  '.gif',
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB per file

const storage = diskStorage({
  destination: join(process.cwd(), 'uploads'),
  filename: (_req, file, cb) => {
    const rand = randomBytes(16).toString('hex');
    // Extension derived from mime type, never from originalname (prevents extension spoofing)
    const ext  = MIME_TO_EXT[file.mimetype] ?? '.jpg';
    cb(null, `${rand}${ext}`);
  },
});

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UploadsController {
  /**
   * POST /uploads
   * Accepts up to 10 image files (jpeg/png/webp/gif, max 5 MB each).
   * Returns [{ url }] where url is the absolute public path to the file.
   *
   * fileFilter uses cb(null, true/false) — no error thrown from the filter —
   * so multer never wraps our errors in a MulterError. Rejection is handled in
   * the handler body after multer has finished, giving us proper HTTP 400 responses.
   */
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage,
      limits: { fileSize: MAX_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        // cb(null, false) silently rejects the file without writing it to disk
        cb(null, ALLOWED_MIMES.has(file.mimetype));
      },
    }),
  )
  upload(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException(
        'No valid image files found. Accepted formats: JPEG, PNG, WebP, GIF. Max 5 MB each.',
      );
    }
    const base = (process.env.API_PUBLIC_URL ?? 'http://localhost:3001').replace(/\/$/, '');
    return files.map(f => ({ url: `${base}/uploads/${f.filename}` }));
  }
}
