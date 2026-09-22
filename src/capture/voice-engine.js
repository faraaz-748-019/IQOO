/**
 * KhataLens — Voice Engine (Web Speech API)
 * On-device speech recognition with Hindi, Telugu, and English support.
 */

let recognition = null;
let isListening = false;

const LANGUAGES = {
  hindi: { code: 'hi-IN', label: 'हिंदी', short: 'HI' },
  english: { code: 'en-IN', label: 'English', short: 'EN' },
  telugu: { code: 'te-IN', label: 'తెలుగు', short: 'TE' }
};

/**
 * Check if speech recognition is available
 */
export function isSpeechAvailable() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Start listening for speech
 * @param {Object} options
 * @param {string} options.lang - Language key: 'hindi', 'english', 'telugu'
 * @param {function} options.onResult - Called with final transcript
 * @param {function} options.onInterim - Called with interim transcript
 * @param {function} options.onError - Called on error
 * @param {function} options.onEnd - Called when recognition ends
 * @param {function} options.onStart - Called when recognition starts
 */
export function startListening(options = {}) {
  const {
    lang = 'hindi',
    onResult,
    onInterim,
    onError,
    onEnd,
    onStart
  } = options;

  if (!isSpeechAvailable()) {
    onError?.('Speech recognition is not supported in this browser.');
    return;
  }

  // Stop any existing session
  stopListening();

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();

  const langConfig = LANGUAGES[lang] || LANGUAGES.hindi;
  recognition.lang = langConfig.code;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  recognition.onstart = () => {
    isListening = true;
    onStart?.();
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    if (interimTranscript) {
      onInterim?.(interimTranscript);
    }

    if (finalTranscript) {
      onResult?.(finalTranscript, event.results[event.results.length - 1][0].confidence);
    }
  };

  recognition.onerror = (event) => {
    isListening = false;
    const message = getSpeechErrorMessage(event.error);
    onError?.(message);
  };

  recognition.onend = () => {
    isListening = false;
    onEnd?.();
  };

  try {
    recognition.start();
  } catch (err) {
    onError?.('Failed to start speech recognition. Please try again.');
  }
}

/**
 * Stop listening
 */
export function stopListening() {
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {
      // Already stopped
    }
    recognition = null;
  }
  isListening = false;
}

/**
 * Check if currently listening
 */
export function getIsListening() {
  return isListening;
}

/**
 * Get available languages
 */
export function getLanguages() {
  return LANGUAGES;
}

/**
 * Get user-friendly error message
 */
function getSpeechErrorMessage(error) {
  switch (error) {
    case 'no-speech':
      return "I couldn't hear anything. Please speak clearly and try again.";
    case 'audio-capture':
      return 'No microphone found. Please connect a microphone and try again.';
    case 'not-allowed':
      return 'Microphone permission denied. Please allow microphone access in your browser settings.';
    case 'network':
      return 'Network error. Speech recognition may need an initial internet connection for some languages.';
    case 'aborted':
      return 'Speech recognition was cancelled.';
    case 'language-not-supported':
      return 'This language is not supported for speech recognition on your device.';
    default:
      return "I couldn't catch that — please speak clearly or try again.";
  }
}
