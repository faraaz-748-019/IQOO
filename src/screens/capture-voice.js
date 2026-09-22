/**
 * KhataLens — Voice Capture Screen
 * Speech-to-ledger with language selection and real-time transcript.
 */
import { startListening, stopListening, getIsListening, getLanguages, isSpeechAvailable } from '../capture/voice-engine.js';
import { extractEntities } from '../ai/entity-extractor.js';
import { playTap } from '../utils/audio-feedback.js';

let currentLang = 'hindi';

export function renderVoice(app) {
  const langs = getLanguages();

  return `
    <div class="screen active" id="screen-voice">
      <!-- Header -->
      <div class="screen-header">
        <button class="back-btn" onclick="window.app.navigate('home')">←</button>
        <h2 class="screen-title">🎙️ Voice Entry</h2>
      </div>

      <!-- Language Selector -->
      <div class="lang-selector" style="margin-bottom: var(--space-2xl);">
        ${Object.entries(langs).map(([key, lang]) => `
          <button class="lang-btn ${key === currentLang ? 'active' : ''}"
                  id="lang-${key}"
                  onclick="window.voiceScreen.setLang('${key}')">
            ${lang.label}
          </button>
        `).join('')}
      </div>

      <!-- Instructions -->
      <div style="text-align: center; margin-bottom: var(--space-2xl);">
        <p class="body-text" id="voice-instruction">
          Tap the mic and speak naturally<br>
          <span style="font-size: var(--text-sm); color: var(--color-text-tertiary);">
            e.g. "Ramesh ka 500 rupees udhaar"
          </span>
        </p>
      </div>

      <!-- Mic Button -->
      <div style="display: flex; justify-content: center; margin-bottom: var(--space-2xl);">
        <button class="mic-button" id="mic-btn" onclick="window.voiceScreen.toggleMic()">
          <span class="mic-ripple"></span>
          <span class="mic-ripple"></span>
          <span class="mic-ripple"></span>
          <span id="mic-icon">🎙️</span>
        </button>
      </div>

      <!-- Status -->
      <div id="voice-status" style="text-align: center; margin-bottom: var(--space-lg);">
        <span class="caption" id="voice-status-text">Ready</span>
      </div>

      <!-- Transcript Display -->
      <div class="card" id="transcript-card" style="min-height: 80px; display: none;">
        <div class="caption" style="margin-bottom: var(--space-sm);">TRANSCRIPT</div>
        <p id="transcript-text" style="font-size: var(--text-md); font-weight: var(--weight-medium); line-height: var(--leading-relaxed);">
        </p>
        <p id="transcript-interim" style="font-size: var(--text-base); color: var(--color-text-tertiary); font-style: italic; margin-top: var(--space-sm);">
        </p>
      </div>

      <!-- Error Display -->
      <div id="voice-error" class="card" style="display: none; border-left: 3px solid var(--color-danger); margin-top: var(--space-lg);">
        <p id="voice-error-text" style="color: var(--color-danger); font-size: var(--text-sm);"></p>
      </div>

      <!-- Processing indicator -->
      <div id="voice-processing" style="display: none; text-align: center; margin-top: var(--space-xl);">
        <div class="spinner spinner-lg" style="margin: 0 auto var(--space-md);"></div>
        <p class="body-text">Processing your speech...</p>
      </div>

      ${!isSpeechAvailable() ? `
        <div class="card" style="border-left: 3px solid var(--color-warning); margin-top: var(--space-xl);">
          <p style="color: var(--color-warning); font-size: var(--text-sm);">
            ⚠️ Speech recognition is not supported in this browser. Please use Chrome on Android for the best experience.
          </p>
        </div>
      ` : ''}
    </div>
  `;
}

export function initVoice() {
  window.voiceScreen = {
    setLang(lang) {
      currentLang = lang;
      // Update UI
      document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
      document.getElementById(`lang-${lang}`)?.classList.add('active');
      playTap();
    },

    toggleMic() {
      if (getIsListening()) {
        stopListening();
        updateMicUI(false);
      } else {
        startVoiceCapture();
      }
    }
  };
}

function startVoiceCapture() {
  const transcriptCard = document.getElementById('transcript-card');
  const transcriptText = document.getElementById('transcript-text');
  const transcriptInterim = document.getElementById('transcript-interim');
  const errorDiv = document.getElementById('voice-error');
  const errorText = document.getElementById('voice-error-text');
  const statusText = document.getElementById('voice-status-text');
  const instruction = document.getElementById('voice-instruction');

  // Reset UI
  if (errorDiv) errorDiv.style.display = 'none';
  if (transcriptText) transcriptText.textContent = '';
  if (transcriptInterim) transcriptInterim.textContent = '';

  startListening({
    lang: currentLang,
    onStart: () => {
      updateMicUI(true);
      if (statusText) statusText.textContent = 'Listening...';
      if (instruction) instruction.innerHTML = 'Speak now...<br><span style="font-size: var(--text-sm); color: var(--color-accent-secondary);">🟢 Listening</span>';
      playTap();
    },
    onInterim: (text) => {
      if (transcriptCard) transcriptCard.style.display = 'block';
      if (transcriptInterim) transcriptInterim.textContent = text;
    },
    onResult: (text, confidence) => {
      updateMicUI(false);
      if (transcriptCard) transcriptCard.style.display = 'block';
      if (transcriptText) transcriptText.textContent = text;
      if (transcriptInterim) transcriptInterim.textContent = '';
      if (statusText) statusText.textContent = `Confidence: ${Math.round((confidence || 0) * 100)}%`;

      // Show processing
      const processingDiv = document.getElementById('voice-processing');
      if (processingDiv) processingDiv.style.display = 'block';

      // Process after brief delay for UX
      setTimeout(() => {
        const extraction = extractEntities(text);
        extraction.source = 'voice';

        if (processingDiv) processingDiv.style.display = 'none';

        // Navigate to confirmation
        window.app.showConfirmation(extraction);
      }, 600);
    },
    onError: (message) => {
      updateMicUI(false);
      if (statusText) statusText.textContent = 'Error';
      if (errorDiv) errorDiv.style.display = 'block';
      if (errorText) errorText.textContent = message;
      if (instruction) instruction.innerHTML = 'Tap the mic and speak naturally<br><span style="font-size: var(--text-sm); color: var(--color-text-tertiary);">e.g. "Ramesh ka 500 rupees udhaar"</span>';
    },
    onEnd: () => {
      updateMicUI(false);
      const statusText = document.getElementById('voice-status-text');
      if (statusText && statusText.textContent === 'Listening...') {
        statusText.textContent = 'Ready';
      }
    }
  });
}

function updateMicUI(listening) {
  const micBtn = document.getElementById('mic-btn');
  const micIcon = document.getElementById('mic-icon');

  if (micBtn) {
    if (listening) {
      micBtn.classList.add('listening');
    } else {
      micBtn.classList.remove('listening');
    }
  }

  if (micIcon) {
    micIcon.textContent = listening ? '⏹️' : '🎙️';
  }
}
