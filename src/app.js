/**
 * KhataLens — Main Application Controller
 * Hash-based routing, screen management, navigation, and toast notifications.
 */
import { renderHome, initHome } from './screens/home.js';
import { renderVoice, initVoice } from './screens/capture-voice.js';
import { renderCamera, initCamera } from './screens/capture-camera.js';
import { renderConfirmation, initConfirmation } from './screens/confirmation.js';
import { renderLedger, initLedger } from './screens/ledger.js';
import { renderQuery, initQuery } from './screens/query.js';
import { renderSummary, initSummary } from './screens/summary.js';
import { renderOfficeKit, initOfficeKit } from './screens/office-kit.js';
import { stopCamera } from './capture/camera.js';
import { stopListening } from './capture/voice-engine.js';

// ─── App State ──────────────────────────────────────────────

let currentScreen = 'home';
let pendingExtraction = null;

// ─── Screen Registry ────────────────────────────────────────

const screens = {
  home:         { render: renderHome, init: initHome },
  voice:        { render: renderVoice, init: initVoice },
  camera:       { render: renderCamera, init: initCamera },
  confirmation: { render: () => renderConfirmation(pendingExtraction), init: initConfirmation },
  ledger:       { render: renderLedger, init: initLedger },
  query:        { render: renderQuery, init: initQuery },
  summary:      { render: renderSummary, init: initSummary },
  officekit:    { render: renderOfficeKit, init: initOfficeKit },
};

// ─── Navigation ─────────────────────────────────────────────

function navigate(screenName) {
  // Cleanup previous screen
  if (currentScreen === 'camera') stopCamera();
  if (currentScreen === 'voice') stopListening();

  currentScreen = screenName;

  const screen = screens[screenName];
  if (!screen) {
    console.error(`Unknown screen: ${screenName}`);
    return;
  }

  const appEl = document.getElementById('app');
  const html = screen.render(window.app);

  // Build full page with nav
  appEl.innerHTML = html + renderNavBar(screenName);

  // Initialize screen
  if (screen.init) {
    screen.init();
  }

  // Update URL hash
  window.location.hash = screenName;
}

function showConfirmation(extraction) {
  pendingExtraction = extraction;
  navigate('confirmation');
}

// ─── Navigation Bar ─────────────────────────────────────────

function renderNavBar(activeScreen) {
  // Don't show nav on confirmation or camera screens
  if (['confirmation', 'camera'].includes(activeScreen)) return '';

  const items = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'ledger', icon: '📒', label: 'Khata' },
    { id: 'capture', icon: '➕', label: '' },
    { id: 'summary', icon: '📊', label: 'Summary' },
    { id: 'officekit', icon: '💼', label: 'Export' },
  ];

  return `
    <nav class="nav-bar">
      <div class="nav-bar-inner">
        ${items.map(item => {
          if (item.id === 'capture') {
            return `
              <button class="nav-item nav-item-capture" onclick="window.app.showCaptureOptions()">
                <span class="nav-icon">${item.icon}</span>
              </button>
            `;
          }

          const isActive = item.id === activeScreen;
          return `
            <button class="nav-item ${isActive ? 'active' : ''}" onclick="window.app.navigate('${item.id}')">
              <span class="nav-icon">${item.icon}</span>
              <span class="nav-label">${item.label}</span>
            </button>
          `;
        }).join('')}
      </div>
    </nav>
  `;
}

// ─── Capture Options Modal ──────────────────────────────────

function showCaptureOptions() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay active';
  overlay.id = 'capture-modal';
  overlay.onclick = (e) => {
    if (e.target === overlay) closeCaptureOptions();
  };

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-handle"></div>
      <h3 class="heading-3" style="text-align: center; margin-bottom: var(--space-xl);">Add Entry</h3>

      <div style="display: flex; flex-direction: column; gap: var(--space-md);">
        <button class="btn btn-lg btn-full btn-secondary" style="justify-content: flex-start; gap: var(--space-lg); padding: var(--space-xl);"
                onclick="window.app.closeCaptureOptions(); window.app.navigate('voice');">
          <span style="font-size: 1.5rem;">🎙️</span>
          <div style="text-align: left;">
            <div style="font-weight: var(--weight-semibold);">Voice Entry</div>
            <div style="font-size: var(--text-xs); color: var(--color-text-tertiary); font-weight: var(--weight-regular);">Speak in Hindi, Telugu, or English</div>
          </div>
        </button>

        <button class="btn btn-lg btn-full btn-secondary" style="justify-content: flex-start; gap: var(--space-lg); padding: var(--space-xl);"
                onclick="window.app.closeCaptureOptions(); window.app.navigate('camera');">
          <span style="font-size: 1.5rem;">📷</span>
          <div style="text-align: left;">
            <div style="font-weight: var(--weight-semibold);">Scan Chit / Bill</div>
            <div style="font-size: var(--text-xs); color: var(--color-text-tertiary); font-weight: var(--weight-regular);">Photograph a handwritten or printed note</div>
          </div>
        </button>

        <button class="btn btn-lg btn-full btn-secondary" style="justify-content: flex-start; gap: var(--space-lg); padding: var(--space-xl);"
                onclick="window.app.closeCaptureOptions(); window.app.showManualEntry();">
          <span style="font-size: 1.5rem;">✏️</span>
          <div style="text-align: left;">
            <div style="font-weight: var(--weight-semibold);">Manual Entry</div>
            <div style="font-size: var(--text-xs); color: var(--color-text-tertiary); font-weight: var(--weight-regular);">Type details manually</div>
          </div>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

function closeCaptureOptions() {
  document.getElementById('capture-modal')?.remove();
}

function showManualEntry() {
  const extraction = {
    customer: null,
    amount: null,
    type: 'credit',
    item: '',
    date: new Date().toISOString().split('T')[0],
    source: 'manual',
    rawText: '',
    confidence: {
      customer: 'missing',
      amount: 'missing',
      type: 'high'
    }
  };
  showConfirmation(extraction);
}

// ─── Toast Notifications ────────────────────────────────────

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Remove after animation
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// ─── App Init ───────────────────────────────────────────────

function init() {
  // Expose global app API
  window.app = {
    navigate,
    showConfirmation,
    showCaptureOptions,
    closeCaptureOptions,
    showManualEntry,
    showToast
  };

  // Handle hash-based routing
  const hash = window.location.hash.replace('#', '');
  const initialScreen = screens[hash] ? hash : 'home';

  // Small delay for loader animation
  setTimeout(() => {
    navigate(initialScreen);
  }, 600);

  // Handle back button
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && screens[hash] && hash !== currentScreen) {
      navigate(hash);
    }
  });

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('SW registered:', reg.scope);
    }).catch(err => {
      console.log('SW registration failed:', err);
    });
  }
}

// ─── Bootstrap ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
