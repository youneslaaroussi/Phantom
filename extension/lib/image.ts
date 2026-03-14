const VISION_MAX_DIMENSION = 768;
const VISION_JPEG_QUALITY = 0.3;

export function compressScreenshot(
  dataUrl: string,
  maxDim = VISION_MAX_DIMENSION,
  quality = VISION_JPEG_QUALITY
): Promise<{ base64: string; mimeType: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;

      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas context"));

      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL("image/jpeg", quality);
      const base64 = compressed.replace(/^data:image\/jpeg;base64,/, "");
      resolve({ base64, mimeType: "image/jpeg", width: w, height: h });
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

const CU_JPEG_QUALITY = 0.85;

export function screenshotForComputerUse(
  dataUrl: string
): Promise<{ base64: string; mimeType: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas context"));

      ctx.drawImage(img, 0, 0, w, h);
      const out = canvas.toDataURL("image/jpeg", CU_JPEG_QUALITY);
      const base64 = out.replace(/^data:image\/jpeg;base64,/, "");
      resolve({ base64, mimeType: "image/jpeg", width: w, height: h });
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}
