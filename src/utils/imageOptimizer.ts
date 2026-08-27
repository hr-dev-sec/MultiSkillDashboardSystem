/**
 * HD Image Optimizer & High-DPI Enhancer Utility
 * PT Ajinomoto Indonesia - Multi-Skill Monitoring System
 * 
 * Provides crisp, high-fidelity rendering, adaptive sharpening,
 * and high-resolution preservation for user avatars and factory emblems.
 */

export interface OptimizeImageOptions {
  maxDimension?: number; // default: 1200px for crystal-clear HD retina rendering
  quality?: number; // 0.95 for maximum clarity
  sharpen?: boolean; // apply subtle unsharp mask filter for crisp borders/logos
  forceSquare?: boolean;
}

export interface OptimizedImageResult {
  dataUrl: string;
  width: number;
  height: number;
  originalSize: number;
  processedSize: number;
  mimeType: string;
}

/**
 * Apply subtle unsharp mask convolution kernel to sharpen logos, text, and faces
 */
function applySharpenFilter(ctx: CanvasRenderingContext2D, width: number, height: number, strength: number = 0.25) {
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const output = ctx.createImageData(width, height);
    const outData = output.data;

    // Fast 3x3 Sharpen Kernel:
    // [  0, -k,  0 ]
    // [ -k, 1+4k, -k ]
    // [  0, -k,  0 ]
    const k = strength;
    const center = 1 + 4 * k;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;

        for (let c = 0; c < 3; c++) {
          const top = ((y - 1) * width + x) * 4 + c;
          const bottom = ((y + 1) * width + x) * 4 + c;
          const left = (y * width + (x - 1)) * 4 + c;
          const right = (y * width + (x + 1)) * 4 + c;
          const current = idx + c;

          const val =
            data[current] * center -
            k * (data[top] + data[bottom] + data[left] + data[right]);

          outData[idx + c] = Math.min(255, Math.max(0, val));
        }
        // Preserve original alpha
        outData[idx + 3] = data[idx + 3];
      }
    }

    // Copy edge pixels safely
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 4; c++) {
        outData[x * 4 + c] = data[x * 4 + c];
        const bottomIdx = ((height - 1) * width + x) * 4 + c;
        outData[bottomIdx] = data[bottomIdx];
      }
    }
    for (let y = 0; y < height; y++) {
      for (let c = 0; c < 4; c++) {
        outData[(y * width) * 4 + c] = data[(y * width) * 4 + c];
        const rightIdx = (y * width + (width - 1)) * 4 + c;
        outData[rightIdx] = data[rightIdx];
      }
    }

    ctx.putImageData(output, 0, 0);
  } catch (e) {
    console.warn('Sharpen filter skipped due to canvas security or size constraint:', e);
  }
}

/**
 * Optimizes an uploaded image file into crisp High-Definition (HD) data URL
 */
export async function optimizeImageToHd(
  file: File,
  options: OptimizeImageOptions = {}
): Promise<OptimizedImageResult> {
  const {
    maxDimension = 1200,
    quality = 0.95,
    sharpen = true,
    forceSquare = false
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format file gambar tidak valid atau rusak.'));
      img.onload = () => {
        let originalWidth = img.naturalWidth || img.width;
        let originalHeight = img.naturalHeight || img.height;

        let targetWidth = originalWidth;
        let targetHeight = originalHeight;

        // Calculate HD dimensions
        if (targetWidth > maxDimension || targetHeight > maxDimension) {
          if (targetWidth > targetHeight) {
            targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
            targetWidth = maxDimension;
          } else {
            targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
            targetHeight = maxDimension;
          }
        }

        // If square mode requested, crop center
        let sx = 0;
        let sy = 0;
        let sWidth = originalWidth;
        let sHeight = originalHeight;

        if (forceSquare) {
          const minSide = Math.min(originalWidth, originalHeight);
          sx = Math.round((originalWidth - minSide) / 2);
          sy = Math.round((originalHeight - minSide) / 2);
          sWidth = minSide;
          sHeight = minSide;
          targetWidth = Math.min(minSide, maxDimension);
          targetHeight = targetWidth;
        }

        // Create high-fidelity Canvas
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d', {
          alpha: true,
          willReadFrequently: sharpen
        });

        if (!ctx) {
          // Fallback to original raw string if canvas 2D fails
          resolve({
            dataUrl: reader.result as string,
            width: originalWidth,
            height: originalHeight,
            originalSize: file.size,
            processedSize: file.size,
            mimeType: file.type
          });
          return;
        }

        // Enable high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

        // Apply sharpness filter if enabled
        if (sharpen && targetWidth >= 120 && targetHeight >= 120) {
          applySharpenFilter(ctx, targetWidth, targetHeight, 0.22);
        }

        // Determine best output format (Preserve PNG for transparency/logos, otherwise WebP or JPEG)
        const isPng = file.type === 'image/png';
        const mimeType = isPng ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);

        // Estimate size
        const head = `data:${mimeType};base64,`;
        const base64Length = dataUrl.length - head.length;
        const processedBytes = Math.round((base64Length * 3) / 4);

        resolve({
          dataUrl,
          width: targetWidth,
          height: targetHeight,
          originalSize: file.size,
          processedSize: processedBytes,
          mimeType
        });
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
