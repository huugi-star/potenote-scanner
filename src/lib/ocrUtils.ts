/**
 * クライアントサイドOCR (Tesseract.js)
 */

import Tesseract from 'tesseract.js';

export async function performOCR(
  processedImageBase64: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const result = await Tesseract.recognize(
    processedImageBase64,
    'jpn',
    {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      }
    }
  );

  return result.data.text.trim();
}
