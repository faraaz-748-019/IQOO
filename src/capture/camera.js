/**
 * KhataLens — Camera Capture Module
 * Provides camera viewfinder, photo capture, and gallery fallback.
 */

let stream = null;
let videoEl = null;

/**
 * Start the camera stream
 * @param {HTMLVideoElement} video - Video element to display stream
 * @param {string} facing - 'environment' (rear) or 'user' (front)
 * @returns {Promise<MediaStream>}
 */
export async function startCamera(video, facing = 'environment') {
  try {
    // Stop any existing stream
    stopCamera();

    const constraints = {
      video: {
        facingMode: facing,
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    videoEl = video;

    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve(stream);
      };
    });
  } catch (err) {
    console.error('Camera error:', err);
    throw new Error(getCameraErrorMessage(err));
  }
}

/**
 * Capture a photo from the video stream
 * @returns {HTMLCanvasElement} - Captured image as canvas
 */
export function capturePhoto() {
  if (!videoEl || !stream) {
    throw new Error('Camera not started');
  }

  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0);

  return canvas;
}

/**
 * Stop the camera stream
 */
export function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (videoEl) {
    videoEl.srcObject = null;
    videoEl = null;
  }
}

/**
 * Pick image from gallery/file input
 * @returns {Promise<HTMLCanvasElement>}
 */
export function pickFromGallery() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = ''; // Allow gallery access too

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    };

    input.click();
  });
}

/**
 * Check if camera is available
 */
export async function isCameraAvailable() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some(d => d.kind === 'videoinput');
  } catch {
    return false;
  }
}

/**
 * Get user-friendly error message for camera errors
 */
function getCameraErrorMessage(err) {
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
    return 'Camera permission denied. Please allow camera access in your browser settings.';
  }
  if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
    return 'No camera found on this device.';
  }
  if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
    return 'Camera is being used by another app. Please close other camera apps and try again.';
  }
  if (err.name === 'OverconstrainedError') {
    return 'Camera does not support the requested settings.';
  }
  return 'Could not access the camera. Please try again.';
}
