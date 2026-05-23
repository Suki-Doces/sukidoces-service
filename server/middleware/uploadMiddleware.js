import multer from 'multer';
import { AppError } from './errorHandler.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }

  return cb(new AppError('Formato de imagem invalido. Use JPG, JPEG, PNG ou WEBP.', 400));
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});
