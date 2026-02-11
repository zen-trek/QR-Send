import jsQR from 'jsqr';
import QRCode from 'qrcode';
// @ts-ignore
import heic2any from 'heic2any';

export const preprocessImage = async (file: File): Promise<Blob | File> => {
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  // HEIC/HEIF Handling
  // Check both MIME type and extension to be robust across different browsers/devices
  if (fileType === 'image/heic' || 
      fileType === 'image/heif' || 
      fileName.endsWith('.heic') || 
      fileName.endsWith('.heif')) {
    try {
      // Convert to JPEG for better performance/compression compared to PNG
      const result = await heic2any({ 
        blob: file, 
        toType: 'image/jpeg',
        quality: 0.8 
      });
      
      // heic2any can return an array if the HEIC has multiple images (e.g. live photo)
      // We only take the first one
      if (Array.isArray(result)) {
        return result[0];
      }
      return result;
    } catch (e) {
      console.error('HEIC conversion failed', e);
      throw new Error('Unable to process HEIC image.');
    }
  }
  
  return file;
};

export const readQRFromImage = (fileOrUrl: File | string | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Allow loading images from other domains if CORS allows, useful for blobs/data urls
    img.crossOrigin = 'Anonymous'; 
    
    let currentObjectUrl: string | null = null;

    const cleanup = () => {
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
      }
    };

    img.onload = () => {
      cleanup();
      
      // Scale down large images for better performance and detection
      const maxDimension = 1200;
      let width = img.width;
      let height = img.height;
      
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width *= ratio;
        height *= ratio;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas context not available'));
        return;
      }

      // Draw image to canvas (handles JPG, PNG, WEBP, BMP, GIF natively)
      context.drawImage(img, 0, 0, width, height);
      
      try {
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        // Attempt both normal and inverted (light on dark)
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth"
        });

        if (code) {
          resolve(code.data);
        } else {
          reject(new Error('No QR code found in image'));
        }
      } catch (e) {
        reject(new Error('Failed to process image data'));
      }
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('Failed to load image. File may be corrupted.'));
    };
    
    // Handle File objects, Blobs, and string URLs
    try {
      if (typeof fileOrUrl === 'string') {
          img.src = fileOrUrl;
      } else {
          currentObjectUrl = URL.createObjectURL(fileOrUrl);
          img.src = currentObjectUrl;
      }
    } catch (e) {
      cleanup();
      reject(new Error('Failed to create image source'));
    }
  });
};

export const generateQRCodeDataURL = async (text: string): Promise<string> => {
  try {
    // Generate a high quality QR
    return await QRCode.toDataURL(text, {
      width: 800,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff00' // Transparent background for the QR itself
      },
      errorCorrectionLevel: 'H'
    });
  } catch (err) {
    console.error(err);
    return '';
  }
};

export const getCroppedImg = (
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('No 2d context'));
        return;
      }

      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas is empty'));
      }, 'image/jpeg', 0.95);
    };
    image.onerror = reject;
  });
};