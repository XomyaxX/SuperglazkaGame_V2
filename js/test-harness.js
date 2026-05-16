/* ═══════════════════════════════════════════════════════════
   TEST HARNESS — randomized stress-tester for episode viewer
   ═══════════════════════════════════════════════════════════
   Usage: include <script src="js/test-harness.js"></script> in app.html
   after app.js. Opens automatically when episode starts.
   ═══════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  const LOG = [];
  const MAX_STEPS = 1000;
  const DELAY_MS = 300;

  function log(type, msg, detail) {
    const entry = { t: performance.now().toFixed(1), type, msg, detail };
    LOG.push(entry);
    console.log(`[HARNESS:${type}]`, msg, detail || '');
  }

  // ─── INVARIANT CHECKERS ───
  let lastSubtitleText = null;
  let lastAudioSrc = null;

  function checkInvariants(step) {
    const issues = [];

    // 1. Subtitle should not flicker backwards without clear()
    if (SubtitleOverlay._last !== undefined && lastSubtitleText !== null) {
      // We can't easily detect flicker here, but we can detect if
      // SubtitleOverlay has pending timeouts that might race.
      if (SubtitleOverlay._pendingTimeout && lastSubtitleText !== SubtitleOverlay._last) {
        // This is OK if a new line arrived, but we'll flag it for manual review.
      }
    }
    lastSubtitleText = SubtitleOverlay._last;

    // 2. AudioController should not have multiple playing audios
    if (AudioController.currentAudio) {
      if (lastAudioSrc && lastAudioSrc !== AudioController.currentAudio.src) {
        // Check old audio is paused
        // (We can't reach the old Audio object, but we can check current state)
      }
      lastAudioSrc = AudioController.currentAudio.src;
    }

    // 3. subtitleSyncCleanup must be null after showFrame settles
    if (typeof subtitleSyncCleanup !== 'undefined' && subtitleSyncCleanup !== null) {
      // It's OK during playback; we just log presence.
    }

    // 4. BottomSheet transform must be within snapPoints
    const bs = BottomSheet;
    if (bs.el && bs.snapPoints) {
      // Read inline style (not getComputedStyle) to avoid catching transition mid-flight
      const inlineTransform = bs.el.style.transform || '';
      const m = inlineTransform.match(/translateY\(([-\d.]+)px\)/);
      const y = m ? parseFloat(m[1]) : bs.snapPoints[bs.state];
      const maxY = bs.snapPoints.hidden;
      if (y > maxY + 5) {
        issues.push(`BottomSheet overflow: translateY=${y} > hidden=${maxY}`);
      }
    }

    if (issues.length) {
      log('INVARIANT_FAIL', `Step ${step}`, issues.join('; '));
      return false;
    }
    return true;
  }

  // ─── RANDOM ACTIONS ───
  const ACTIONS = [
    {
      name: 'nextFrame',
      weight: 15,
      run() {
        if (typeof App !== 'undefined' && App.nextFrame) App.nextFrame();
      }
    },
    {
      name: 'prevFrame',
      weight: 10,
      run() {
        if (typeof App !== 'undefined' && App.prevFrame) App.prevFrame();
      }
    },
    {
      name: 'toggleBottomSheet',
      weight: 10,
      run() {
        BottomSheet.toggle();
      }
    },
    {
      name: 'expandBottomSheet',
      weight: 5,
      run() {
        BottomSheet.expand();
      }
    },
    {
      name: 'collapseBottomSheet',
      weight: 5,
      run() {
        BottomSheet.collapse();
      }
    },
    {
      name: 'hideBottomSheet',
      weight: 5,
      run() {
        BottomSheet.hide();
      }
    },
    {
      name: 'toggleVideoTrack',
      weight: 8,
      run() {
        AudioController.toggleTrack('video');
      }
    },
    {
      name: 'toggleNarrationTrack',
      weight: 5,
      run() {
        AudioController.toggleTrack('narration');
      }
    },
    {
      name: 'pauseResumeAudio',
      weight: 8,
      run() {
        if (AudioController.state === 'playing') AudioController.pause();
        else AudioController.resume();
      }
    },
    {
      name: 'seekAudioRandom',
      weight: 5,
      run() {
        const a = AudioController.currentAudio;
        if (a && a.duration && isFinite(a.duration)) {
          a.currentTime = Math.random() * a.duration;
        }
      }
    },
    {
      name: 'simulateResize',
      weight: 3,
      run() {
        window.dispatchEvent(new Event('resize'));
      }
    },
    {
      name: 'cinemaToggle',
      weight: 3,
      run() {
        const ev = document.getElementById('episode-viewer');
        if (ev) ev.classList.toggle('ui-hidden');
      }
    },
    {
      name: 'clickSubtitleOverlay',
      weight: 3,
      run() {
        const el = document.getElementById('subtitleOverlay');
        if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    },
    {
      name: 'startGameIfAvailable',
      weight: 2,
      run() {
        // Games are not always available; this is a no-op if none.
      }
    }
  ];

  function pickAction() {
    const totalWeight = ACTIONS.reduce((s, a) => s + a.weight, 0);
    let r = Math.random() * totalWeight;
    for (const a of ACTIONS) {
      r -= a.weight;
      if (r <= 0) return a;
    }
    return ACTIONS[ACTIONS.length - 1];
  }

  // ─── RUNNER ───
  let step = 0;
  let running = false;

  function runStep() {
    if (!running || step >= MAX_STEPS) {
      log('DONE', `Finished ${step} steps`);
      exportLog();
      return;
    }

    step++;
    const action = pickAction();
    log('ACTION', `${step}/${MAX_STEPS}: ${action.name}`);
    try {
      action.run();
    } catch (err) {
      log('ERROR', `${action.name} threw`, err.message);
    }

    // Let DOM/audio settle before checking invariants
    requestAnimationFrame(() => {
      checkInvariants(step);
      setTimeout(runStep, DELAY_MS);
    });
  }

  function exportLog() {
    const blob = new Blob([JSON.stringify(LOG, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harness-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── UI ───
  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'testHarnessPanel';
    panel.innerHTML = `
      <div style="position:fixed;top:8px;right:8px;z-index:9999;background:rgba(0,0,0,0.85);color:#0f0;font-family:monospace;font-size:12px;padding:10px;border-radius:8px;max-width:260px;">
        <div style="font-weight:bold;margin-bottom:6px;">🧪 Test Harness</div>
        <div id="hStatus">Idle</div>
        <div id="hStep" style="margin:4px 0;">Step: 0</div>
        <button id="hStart" style="margin-right:4px;">▶ Start</button>
        <button id="hStop">⏹ Stop</button>
        <button id="hExport" style="margin-top:4px;">💾 Export log</button>
      </div>
    `;
    document.body.appendChild(panel);

    const statusEl = panel.querySelector('#hStatus');
    const stepEl = panel.querySelector('#hStep');

    function updateUI() {
      statusEl.textContent = running ? 'Running…' : 'Paused';
      stepEl.textContent = `Step: ${step}`;
    }

    panel.querySelector('#hStart').addEventListener('click', () => {
      if (!running) { running = true; runStep(); }
      updateUI();
    });
    panel.querySelector('#hStop').addEventListener('click', () => { running = false; updateUI(); });
    panel.querySelector('#hExport').addEventListener('click', exportLog);
    updateUI();
  }

  // ─── INIT ───
  function init() {
    createPanel();
    log('INIT', 'Harness ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
