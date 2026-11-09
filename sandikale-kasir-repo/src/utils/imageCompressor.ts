/**
 * Image Compression & Optimization Utility for NEXUS / SANDIKALE POS
 *
 * Mengompres gambar secara cerdas di sisi client (browser):
 * - Mencegah sistem lag / macet akibat file raw raksasa (5MB-15MB) yang membuat memori & localStorage penuh
 * - Menjaga ketajaman dan resolusi tinggi (High-DPI 300 DPI print-ready, hingga 1920px) agar hasil cetak
 *   struk thermal & SPK sablon DTF tetap jernih dan tidak pecah
 * - Otomatis mendeteksi transparansi alpha (PNG) untuk logo / mockup sablon
 */

export interface CompressedImageResult {
  dataUrl: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionPercent: number;
  originalDimensions: { width: number; height: number };
  compressedDimensions: { width: number; height: number };
  format: string;
  formattedOriginalSize: string;
  formattedCompressedSize: string;
}

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 - 1.0 (default 0.88 for pristine print quality)
  preserveTransparency?: boolean;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Memeriksa apakah gambar memiliki pixel transparan (alpha < 250)
 */
function hasAlphaTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    // Ambil sampel data pixel (downsample jika besar agar cepat)
    const step = Math.max(1, Math.floor(Math.min(width, height) / 40));
    const imgData = ctx.getImageData(0, 0, width, height).data;
    for (let i = 3; i < imgData.length; i += 4 * step) {
      if (imgData[i] < 250) {
        return true;
      }
    }
  } catch {
    // Fallback aman
  }
  return false;
}

/**
 * Mengompres file gambar dari input pengguna secara asinkron
 */
export async function compressUploadedImage(
  file: File,
  options: CompressOptions = {}
): Promise<CompressedImageResult> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.88,
    preserveTransparency = true,
  } = options;

  const originalSizeBytes = file.size;

  return new Promise((resolve, reject) => {
    // Validasi tipe file
    if (!file.type.startsWith('image/')) {
      reject(new Error('File yang dipilih bukan merupakan format gambar yang valid.'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const originalWidth = img.naturalWidth || img.width;
      const originalHeight = img.naturalHeight || img.height;

      // Hitung dimensi baru dengan mempertahankan rasio aspek secara presisi
      let targetWidth = originalWidth;
      let targetHeight = originalHeight;

      if (targetWidth > maxWidth || targetHeight > maxHeight) {
        const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
        targetWidth = Math.round(targetWidth * ratio);
        targetHeight = Math.round(targetHeight * ratio);
      }

      // Pastikan minimal 1px
      targetWidth = Math.max(1, targetWidth);
      targetHeight = Math.max(1, targetHeight);

      // Siapkan Canvas HTML5
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d', { alpha: true });

      if (!ctx) {
        reject(new Error('Gagal menginisialisasi canvas grafis peramban.'));
        return;
      }

      // Aktifkan interpolasi bicubic berkualitas tinggi agar tidak pecah/blur saat dicetak
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Deteksi apakah format input adalah PNG
      const isPng = file.type === 'image/png';

      // Gambar ke canvas
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      let outputFormat = 'image/jpeg';
      let needsPng = false;

      if (preserveTransparency && isPng) {
        // Cek apakah benar-benar ada pixel transparan
        if (hasAlphaTransparency(ctx, targetWidth, targetHeight)) {
          needsPng = true;
          outputFormat = 'image/png';
        }
      }

      // Jika JPEG, isi latar belakang putih jika ada transparansi kosong
      if (!needsPng) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = targetWidth;
        tempCanvas.height = targetHeight;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.fillStyle = '#ffffff';
          tempCtx.fillRect(0, 0, targetWidth, targetHeight);
          tempCtx.drawImage(canvas, 0, 0);
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          ctx.drawImage(tempCanvas, 0, 0);
        }
        outputFormat = 'image/jpeg';
      }

      // Konversi ke Data URL dengan kompresi terukur
      const compressedDataUrl = needsPng
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL(outputFormat, quality);

      // Estimasi ukuran byte hasil kompresi dari base64
      const base64Length = compressedDataUrl.length - (compressedDataUrl.indexOf(',') + 1);
      const compressedSizeBytes = Math.round((base64Length * 3) / 4);

      const savedBytes = Math.max(0, originalSizeBytes - compressedSizeBytes);
      const compressionPercent = originalSizeBytes > 0
        ? Math.round((savedBytes / originalSizeBytes) * 100)
        : 0;

      resolve({
        dataUrl: compressedDataUrl,
        originalSizeBytes,
        compressedSizeBytes,
        compressionPercent,
        originalDimensions: { width: originalWidth, height: originalHeight },
        compressedDimensions: { width: targetWidth, height: targetHeight },
        format: needsPng ? 'PNG (Transparan)' : 'JPEG HD (Optimal)',
        formattedOriginalSize: formatBytes(originalSizeBytes),
        formattedCompressedSize: formatBytes(compressedSizeBytes),
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Gagal membaca data file gambar. Pastikan gambar tidak rusak.'));
    };

    img.src = objectUrl;
  });
}
