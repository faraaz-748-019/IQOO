/**
 * KhataLens — OCR Engine (Tesseract.js)
 * On-device text recognition for handwritten/printed chits and bills.
 * Runs entirely in-browser via WASM — no cloud dependency.
 */
import Tesseract from 'tesseract.js';

let worker = null;
let isInitialized = false;
let initPromise = null;

/**
 * Initialize the Tesseract worker with Hindi + English support.
 * Downloads and caches WASM + language data on first run.
 * @param {function} onProgress - Progress callback (0-100)
 */
export async function initOCR(onProgress) {
  if (isInitialized && worker) return worker;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      worker = await Tesseract.createWorker('eng+hin', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text' && onProgress) {
            onProgress(Math.round(m.progress * 100));
          }
        }
      });

      isInitialized = true;
      return worker;
    } catch (err) {
      console.error('OCR init error:', err);
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Process an image and extract text.
 * @param {string|HTMLCanvasElement|Blob|File} image - Image to process
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<{text: string, confidence: number, words: Array}>}
 */
export async function recognizeText(image, onProgress) {
  if (!worker || !isInitialized) {
    await initOCR(onProgress);
  }

  const startTime = performance.now();

  const result = await worker.recognize(image);

  const latency = Math.round(performance.now() - startTime);

  return {
    text: result.data.text.trim(),
    confidence: result.data.confidence,
    words: result.data.words || [],
    latency,
    paragraphs: result.data.paragraphs || []
  };
}

/**
 * Preprocess an image for better OCR results.
 * Increases contrast and converts to grayscale.
 * @param {HTMLCanvasElement|HTMLImageElement} source - Image source
 * @returns {HTMLCanvasElement} - Preprocessed canvas
 */
export function preprocessImage(source) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = source.width || source.videoWidth || 640;
  canvas.height = source.height || source.videoHeight || 480;

  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  // Apply grayscale + contrast enhancement
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

    // Increase contrast
    const contrast = 1.5;
    const adjusted = ((gray / 255 - 0.5) * contrast + 0.5) * 255;
    const clamped = Math.max(0, Math.min(255, adjusted));

    data[i] = clamped;
    data[i + 1] = clamped;
    data[i + 2] = clamped;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Clean up the OCR worker
 */
export async function terminateOCR() {
  if (worker) {
    await worker.terminate();
    worker = null;
    isInitialized = false;
    initPromise = null;
  }
}

/**
 * Check if OCR is ready
 */
export function isOCRReady() {
  return isInitialized && worker !== null;
}
