import multer from 'multer';
import { AppError } from './errorHandler.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/heic',
  'image/heif',
  'image/avif'
];

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }

  return cb(
    new AppError(
      'Formato de imagem inválido. Use JPG, JPEG, PNG, WEBP, GIF, BMP, TIFF, SVG, ICO, HEIC, HEIF ou AVIF.',
      400
    )
  );
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});
