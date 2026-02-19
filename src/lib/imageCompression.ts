export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
}

function getOptimalQuality(width: number, height: number): number {
  const pixels = width * height;
  
  // Automatically determine quality based on image size
  if (pixels > 1000000) return 0.75; // Large images (>1MP)
  if (pixels > 500000) return 0.80;  // Medium-large (>0.5MP)
  if (pixels > 250000) return 0.85;  // Medium (>0.25MP)
  return 0.90; // Small images
}

export async function compressImage(
  file: Blob,
  options: CompressionOptions = {}
): Promise<Blob> {
  const {
    maxWidth = 1024,
    maxHeight = 1024,
    mimeType = 'image/jpeg',
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image with smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Use optimal quality based on final dimensions
      const quality = options.quality ?? getOptimalQuality(width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
