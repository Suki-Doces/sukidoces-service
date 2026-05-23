import cloudinary from '../lib/cloudinary.js';

const PRODUCT_IMAGE_FOLDER = 'ecommerce/produtos';

export const uploadProductImage = (buffer) => {
  if (!buffer) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: PRODUCT_IMAGE_FOLDER,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg', 'heic', 'tiff' , 'bmp', 'ico']
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        if (!result?.secure_url) {
          return reject(new Error('Cloudinary did not return a secure_url.'));
        }

        return resolve(result.secure_url);
      }
    );

    uploadStream.end(buffer);
  });
};
