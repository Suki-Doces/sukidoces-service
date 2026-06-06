import cloudinary from '../lib/cloudinary.js';

const PRODUCT_IMAGE_FOLDER = 'ecommerce/produtos';

export const uploadProductImage = async (buffer) => {
  if (!buffer) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: PRODUCT_IMAGE_FOLDER,
        resource_type: 'image',
        allowed_formats: [
          'jpg',
          'jpeg',
          'png',
          'webp',
          'gif',
          'avif',
          'svg',
          'heic',
          'tiff',
          'bmp',
          'ico'
        ]
      },
      (error, result) => {
        if (error) {
          console.error('Erro Cloudinary:', error);
          return reject(error);
        }

        if (!result || !result.secure_url) {
          return reject(
            new Error('Cloudinary não retornou uma URL válida.')
          );
        }

        resolve(result.secure_url);
      }
    );

    uploadStream.end(buffer);
  });
};
