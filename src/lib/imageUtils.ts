/**
 * Potenote Scanner v2 - Image Utilities
 */

import imageCompression from 'browser-image-compression';
import { ERROR_MESSAGES } from '@/lib/constants';

export interface CompressionResult {
  file: File;
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

/**
 * OCR用に画像を補正（コントラスト・シャープネス強化）
 * Google Vision APIの認識精度を向上させる
 */
export async function preprocessImageForOCR(imageFile: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(imageFile);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Canvas context error"));
        return;
      }

      // 1. サイズ調整（長辺2048pxに - Vision APIに最適）
      const maxDim = 2048;
      let width = img.width;
      let height = img.height;
      if (width > height && width > maxDim) {
        height *= maxDim / width;
        width = maxDim;
      } else if (height > maxDim) {
        width *= maxDim / height;
        height = maxDim;
      }

      canvas.width = width;
      canvas.height = height;

      // 画像を描画
      ctx.drawImage(img, 0, 0, width, height);

      // 2. コントラスト・明るさ補正（カラー維持）
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // コントラスト係数（1.0 = 変化なし、1.3 = 30%強調）
      const contrast = 1.3;
      // 明るさ補正（薄い文字を読みやすく）
      const brightness = 10;

      for (let i = 0; i < data.length; i += 4) {
        // R, G, B それぞれにコントラスト・明るさ補正
        for (let j = 0; j < 3; j++) {
          let val = data[i + j];
          // コントラスト補正: (val - 128) * contrast + 128
          val = (val - 128) * contrast + 128 + brightness;
          // 0-255にクランプ
          data[i + j] = Math.max(0, Math.min(255, val));
        }
      }

      ctx.putImageData(imageData, 0, 0);
      
      // 3. シャープネス強化（アンシャープマスク風）
      // 簡易的にコントラストで代用（Canvas APIにはシャープネスがないため）
      
      URL.revokeObjectURL(img.src);
      
      // 高品質JPEGで出力
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Image load error"));
    };
  });
}

/**
 * AI用に画像を圧縮（カラーのまま）
 */
export async function compressForAI(file: File): Promise<CompressionResult> {
  const originalSize = file.size;

  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: "image/jpeg" as const,
    initialQuality: 0.7,
  };

  try {
    const compressedFile = await imageCompression(file, options);
    const dataUrl = await imageCompression.getDataUrlFromFile(compressedFile);
    
    const compressedSize = compressedFile.size;
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

    return {
      dataUrl,
      file: compressedFile,
      originalSize,
      compressedSize,
      compressionRatio: Math.round(compressionRatio * 100) / 100,
    };
  } catch (error) {
    console.error("Image compression failed:", error);
    throw error;
  }
}

/**
 * ファイルをDataURLに変換
 */
export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * 画像ファイルのバリデーション
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: ERROR_MESSAGES.INVALID_IMAGE };
  }
  
  const maxSizeBytes = 10 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { valid: false, error: ERROR_MESSAGES.IMAGE_TOO_LARGE };
  }
  
  return { valid: true };
};

/**
 * ファイルサイズを人間が読みやすい形式に変換
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
};
