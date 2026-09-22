/**
 * KhataLens — Camera Capture Screen
 * Photograph chits/bills with live viewfinder and OCR processing.
 */
import { startCamera, capturePhoto, stopCamera, pickFromGallery } from '../capture/camera.js';
import { initOCR, recognizeText, preprocessImage } from '../capture/ocr-engine.js';
import { extractEntities } from '../ai/entity-extractor.js';

let ocrReady = false;

export function renderCamera(app) {
  return `
    <div class="screen active" id="screen-camera">
      <!-- Header -->
      <div class="screen-header">
        <button class="back-btn" onclick="window.app.navigate('home'); window.cameraScreen.cleanup();">←</button>
        <h2 class="screen-title">📷 Scan Chit / Bill</h2>
      </div>

      <!-- Instructions -->
      <p class="body-text" style="text-align: center; margin-bottom: var(--space-lg);">
        Point at a handwritten chit or printed bill
      </p>

      <!-- Viewfinder -->
      <div class="viewfinder" id="camera-viewfinder">
        <video id="camera-video" autoplay playsinline muted></video>
        <div class="viewfinder-corners">
          <div class="viewfinder-corner tl"></div>
          <div class="viewfinder-corner tr"></div>
          <div class="viewfinder-corner bl"></div>
          <div class="viewfinder-corner br"></div>
        </div>
      </div>

      <!-- Camera Controls -->
      <div style="display: flex; align-items: center; justify-content: center; gap: var(--space-2xl); margin-top: var(--space-xl);">
        <!-- Gallery button -->
        <button class="btn btn-icon btn-secondary" id="btn-gallery" onclick="window.cameraScreen.pickGallery()" title="Pick from gallery">
          🖼️
        </button>

        <!-- Capture button -->
        <button class="capture-btn" id="btn-capture" onclick="window.cameraScreen.capture()"></button>

        <!-- Placeholder for symmetry -->
        <div style="width: 48px; height: 48px;"></div>
      </div>

      <!-- OCR Loading Status -->
      <div id="ocr-status" style="text-align: center; margin-top: var(--space-lg);">
        <span class="caption" id="ocr-status-text">Initializing OCR engine...</span>
        <div class="progress-bar" style="margin-top: var(--space-sm); max-width: 200px; margin-left: auto; margin-right: auto;">
          <div class="progress-fill" id="ocr-progress" style="width: 0%;"></div>
        </div>
      </div>

      <!-- Processing Overlay -->
      <div id="camera-processing" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 200; display: none; align-items: center; justify-content: center;">
        <div style="text-align: center; padding: var(--space-2xl);">
          <div class="spinner spinner-lg" style="margin: 0 auto var(--space-lg);"></div>
          <h3 class="heading-3" style="margin-bottom: var(--space-sm);">Reading your chit...</h3>
          <p class="body-text" id="ocr-process-status">Analyzing text...</p>
          <div class="progress-bar" style="margin-top: var(--space-md); max-width: 250px; margin: var(--space-md) auto 0;">
            <div class="progress-fill" id="ocr-process-progress" style="width: 0%;"></div>
          </div>
        </div>
      </div>

      <!-- Error Display -->
      <div id="camera-error" class="card" style="display: none; border-left: 3px solid var(--color-danger); margin-top: var(--space-lg);">
        <p id="camera-error-text" style="color: var(--color-danger); font-size: var(--text-sm);"></p>
        <button class="btn btn-sm btn-secondary" style="margin-top: var(--space-sm);" onclick="window.cameraScreen.retryCamera()">
          Try Again
        </button>
      </div>
    </div>
  `;
}

export async function initCamera() {
  window.cameraScreen = {
    async capture() {
      try {
        const canvas = capturePhoto();
        const captureBtn = document.getElementById('btn-capture');
        if (captureBtn) captureBtn.classList.add('capturing');
        setTimeout(() => captureBtn?.classList.remove('capturing'), 200);

        await processImage(canvas);
      } catch (err) {
        showCameraError(err.message || 'Failed to capture photo.');
      }
    },

    async pickGallery() {
      try {
        const canvas = await pickFromGallery();
        await processImage(canvas);
      } catch (err) {
        if (err.message !== 'No file selected') {
          showCameraError(err.message || 'Failed to load image.');
        }
      }
    },

    cleanup() {
      stopCamera();
    },

    retryCamera() {
      document.getElementById('camera-error').style.display = 'none';
      startCameraFeed();
    }
  };

  // Start camera feed
  await startCameraFeed();

  // Pre-initialize OCR in background
  initOCRBackground();
}

async function startCameraFeed() {
  try {
    const video = document.getElementById('camera-video');
    if (video) {
      await startCamera(video, 'environment');
    }
  } catch (err) {
    showCameraError(err.message || 'Could not access camera.');
  }
}

async function initOCRBackground() {
  const statusText = document.getElementById('ocr-status-text');
  const progressBar = document.getElementById('ocr-progress');
  const statusDiv = document.getElementById('ocr-status');

  try {
    await initOCR((progress) => {
      if (progressBar) progressBar.style.width = `${progress}%`;
      if (statusText) statusText.textContent = `Loading OCR... ${progress}%`;
    });

    ocrReady = true;
    if (statusText) statusText.textContent = '✅ OCR ready — processed on device';
    if (progressBar) progressBar.style.width = '100%';

    // Hide after a moment
    setTimeout(() => {
      if (statusDiv) statusDiv.style.display = 'none';
    }, 2000);
  } catch (err) {
    if (statusText) statusText.textContent = '⚠️ OCR failed to load. You can still use gallery upload.';
    console.error('OCR init failed:', err);
  }
}

async function processImage(canvas) {
  const processingDiv = document.getElementById('camera-processing');
  const processStatus = document.getElementById('ocr-process-status');
  const processProgress = document.getElementById('ocr-process-progress');

  // Show processing overlay
  if (processingDiv) processingDiv.style.display = 'flex';

  try {
    // Wait for OCR if not ready
    if (!ocrReady) {
      if (processStatus) processStatus.textContent = 'Initializing OCR engine...';
      await initOCR((p) => {
        if (processProgress) processProgress.style.width = `${p}%`;
      });
      ocrReady = true;
    }

    // Preprocess image
    if (processStatus) processStatus.textContent = 'Enhancing image...';
    const preprocessed = preprocessImage(canvas);

    // Run OCR
    if (processStatus) processStatus.textContent = 'Reading text...';
    const ocrResult = await recognizeText(preprocessed, (p) => {
      if (processProgress) processProgress.style.width = `${p}%`;
      if (processStatus) processStatus.textContent = `Reading text... ${p}%`;
    });

    if (processingDiv) processingDiv.style.display = 'none';

    if (!ocrResult.text || ocrResult.text.length < 2) {
      showCameraError("I couldn't read this clearly — try moving closer or improving the lighting.");
      return;
    }

    if (ocrResult.confidence < 30) {
      showCameraError("The text is hard to read — try a clearer image or better lighting.");
      return;
    }

    // Extract entities
    const extraction = extractEntities(ocrResult.text);
    extraction.source = 'camera';
    extraction.ocrConfidence = ocrResult.confidence;
    extraction.ocrLatency = ocrResult.latency;

    // Cleanup camera and navigate
    stopCamera();
    window.app.showConfirmation(extraction);

  } catch (err) {
    if (processingDiv) processingDiv.style.display = 'none';
    showCameraError(err.message || 'Failed to process image. Please try again.');
    console.error('OCR process error:', err);
  }
}

function showCameraError(message) {
  const errorDiv = document.getElementById('camera-error');
  const errorText = document.getElementById('camera-error-text');
  if (errorDiv) errorDiv.style.display = 'block';
  if (errorText) errorText.textContent = message;
}
