/* ═══════════════════════════════════════════════════════════
   СУПЕРГЛАЗКА — Data-Driven Episode Engine
   ═══════════════════════════════════════════════════════════ */

const App = (function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // EPISODE DATA CONFIG
  // ═══════════════════════════════════════════════════════════
  // Данные эпизодов загружаются из js/episodes/*.js
  // EPISODES определён в js/episodes/index.js

  // ═══════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════
  let currentEpisode = null;
  let currentFrameIdx = 0;
  let frames = [];
  let gameAdvancePending = false;
  let isPlayingAudio = false;
  let audioTimeout = null;
  let currentAudioEl = null;
  let currentPhase = 'narration';
  let typeWriterInterval = null;
  let dialogueTimeouts = [];
  let swipeHintTimeout = null;

  // ═══════════════════════════════════════════════════════════
  // DOM REFS
  // ═══════════════════════════════════════════════════════════
  const mainMenu = document.getElementById('main-menu');
  const episodeViewer = document.getElementById('episode-viewer');
  const splash = document.getElementById('splash');
  const startBtn = document.getElementById('startBtn');
  const frameContainer = document.getElementById('frame-container');
  const progressFill = document.querySelector('.progress-fill');
  const frameCounter = document.querySelector('.frame-counter');
  const transitionOverlay = document.getElementById('transition-overlay');

  // ═══════════════════════════════════════════════════════════
  // RENDER FRAME
  // ═══════════════════════════════════════════════════════════
  function renderFrame(frameData, idx, total) {
    const hasVideo = !!frameData.videoSrc;
    const videoContent = hasVideo
      ? `<img class="frame-preview" src="${escapeHtml(frameData.bgImage)}" alt="">
         <div class="frame-preview-info">
           <div class="frame-preview-num">Кадр ${idx + 1}</div>
           <div class="frame-preview-title">${escapeHtml(frameData.title)}</div>
         </div>
         <button class="video-play-btn">▶</button>
         <video src="${frameData.videoSrc}" playsinline preload="auto"></video>`
      : `<div class="video-placeholder">
          <div class="ph-icon">🎬</div>
          <div class="ph-text">Видео: ${escapeHtml(frameData.title)}</div>
          <div class="ph-note">${escapeHtml(frameData.videoPrompt)}</div>
        </div>`;

    return `
      <div class="frame" data-index="${idx}">
        <div class="video-layer">
          ${videoContent}
        </div>

        <button class="audio-btn" data-audio="${escapeHtml(frameData.audioSrc || '')}" title="Озвучка рассказчика">
          <span class="audio-icon">🔊</span>
          <div class="audio-wave"><span></span><span></span><span></span><span></span></div>
        </button>
        ${(frameData.dialogueAudio?.length > 0) ? `
        <button class="dialogue-audio-btn" title="Озвучить диалог">
          <span>🗣️</span>
          <span>Озвучить диалог</span>
        </button>` : ''}

        <div class="narrator-bar">
          <span class="narrator-content"></span><span class="narrator-cursor">|</span>
        </div>
        <button class="narrator-toggle" title="Свернуть">
          <span class="nt-icon">−</span>
          <span class="nt-label">Субтитры</span>
        </button>

        <div class="swipe-hint">👆 Листай вверх</div>

        <div class="frame-nav-bar">
          <div class="nav-counter">Кадр ${idx + 1} из ${total}</div>
          <div class="game-dock">
            ${(frameData.availableGames || []).map(g => `
              <button class="game-chip" data-game="${g}" title="${GAME_NAMES[g] || g}">
                <span class="game-chip-icon">${GAME_ICONS[g] || '🎮'}</span>
              </button>
            `).join('')}
          </div>
        </div>

        ${idx < total - 1 ? `
        <div class="transition-popup" style="display:none">
          <div class="transition-popup-text"></div>
          <button class="transition-popup-btn">Далее →</button>
        </div>
        ` : ''}
      </div>
    `;
  }

  const SPEAKER_NAMES = {
    hrust: "Мудрый Хрусталик",
    sovet: "Советник",
    dev: "Девочка",
    tolpa: "Толпа",
    nar: "Рассказчик"
  };

  const GAME_NAMES = { blink: 'Моргай-зарядка', tracker: 'Трекер-взгляд' };
  const GAME_ICONS = { blink: '⚡', tracker: '👀' };

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════════════════════
  // TYPEWRITER
  // ═══════════════════════════════════════════════════════════
  function stopTypeWriter() {
    if (typeWriterInterval) {
      clearInterval(typeWriterInterval);
      typeWriterInterval = null;
    }
  }

  function clearDialogueTimeouts() {
    dialogueTimeouts.forEach(id => clearTimeout(id));
    dialogueTimeouts = [];
  }

  function typeWriter(text, element) {
    stopTypeWriter();
    if (!element) return;
    element.textContent = '';
    const speed = 30; // ms per character
    let i = 0;
    typeWriterInterval = setInterval(() => {
      if (i < text.length) {
        element.textContent += text.charAt(i);
        i++;
        // Auto-scroll to bottom
        const bar = element.closest('.narrator-bar');
        if (bar) bar.scrollTop = bar.scrollHeight;
      } else {
        stopTypeWriter();
      }
    }, speed);
  }

  // ═══════════════════════════════════════════════════════════
  // AUDIO
  // ═══════════════════════════════════════════════════════════
  function playAudioSequence(sources, onEnd) {
    stopAudio();
    const btn = document.querySelector('.frame.active .audio-btn');
    const queue = sources.filter(Boolean);

    function playNext() {
      if (queue.length === 0) {
        cleanupAudio(btn, onEnd);
        return;
      }
      const src = queue.shift();
      const audio = new Audio(src);
      audio.preload = 'auto';
      currentAudioEl = audio;

      if (btn) btn.classList.add('playing');
      isPlayingAudio = true;

      audio.onended = () => {
        if (audioTimeout) { clearTimeout(audioTimeout); audioTimeout = null; }
        playNext();
      };

      audio.onerror = () => {
        console.warn('Audio failed:', src);
        if (audioTimeout) { clearTimeout(audioTimeout); audioTimeout = null; }
        playNext();
      };

      audio.play().catch(err => {
        console.warn('Audio play failed:', src, err);
        if (audioTimeout) { clearTimeout(audioTimeout); audioTimeout = null; }
        playNext();
      });

      audioTimeout = setTimeout(() => {
        if (isPlayingAudio) {
          console.warn('Audio timeout, skipping:', src);
          playNext();
        }
      }, 30000);
    }

    if (queue.length === 0) {
      cleanupAudio(btn, onEnd);
      return;
    }
    playNext();
  }

  function stopAudio() {
    if (currentAudioEl) {
      currentAudioEl.pause();
      currentAudioEl = null;
    }
    if (audioTimeout) {
      clearTimeout(audioTimeout);
      audioTimeout = null;
    }
    const btn = document.querySelector('.frame.active .audio-btn');
    cleanupAudio(btn, null);
  }

  function cleanupAudio(btn, onEnd) {
    if (btn) btn.classList.remove('playing');
    isPlayingAudio = false;
    if (audioTimeout) {
      clearTimeout(audioTimeout);
      audioTimeout = null;
    }
    if (typeof onEnd === 'function') onEnd();
  }

  function showTransitionPopup(idx) {
    const frame = document.querySelectorAll('.frame')[idx];
    if (!frame) return;
    const popup = frame.querySelector('.transition-popup');
    if (!popup) return;
    const textEl = popup.querySelector('.transition-popup-text');
    const frameData = frames[idx];
    if (textEl && frameData && frameData.transitionText) {
      textEl.textContent = frameData.transitionText;
    }
    popup.style.display = 'flex';
    void popup.offsetWidth;
    popup.classList.add('visible');
  }

  function hideTransitionPopup(idx) {
    const frame = document.querySelectorAll('.frame')[idx];
    if (!frame) return;
    const popup = frame.querySelector('.transition-popup');
    if (!popup) return;
    popup.classList.remove('visible');
    setTimeout(() => {
      if (!popup.classList.contains('visible')) {
        popup.style.display = 'none';
      }
    }, 400);
  }

  function hideAllTransitionPopups() {
    document.querySelectorAll('.transition-popup.visible').forEach(p => {
      p.classList.remove('visible');
      setTimeout(() => {
        if (!p.classList.contains('visible')) p.style.display = 'none';
      }, 400);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // FRAME NAVIGATION
  // ═══════════════════════════════════════════════════════════
  function showFrame(idx, direction) {
    const allFrames = document.querySelectorAll('.frame');
    stopAudio();
    stopTypeWriter();
    clearDialogueTimeouts();
    hideAllTransitionPopups();

    // Disable transitions for instant init (direction === null)
    if (!direction) {
      allFrames.forEach(f => f.style.transition = 'none');
    }

    allFrames.forEach((f, i) => {
      // Pause video on frames leaving the viewport
      if (i !== idx) {
        const v = f.querySelector('video');
        if (v) { v.pause(); v.currentTime = 0; }
      }
      f.classList.remove('active', 'above', 'below');
      if (i === idx) {
        f.classList.add('active');
      } else if (i < idx) {
        f.classList.add('above');
      } else {
        f.classList.add('below');
      }
    });

    // Re-enable transitions after init
    if (!direction) {
      requestAnimationFrame(() => {
        allFrames.forEach(f => f.style.transition = '');
      });
    }

    currentFrameIdx = idx;

    const total = frames.length;
    if (progressFill) progressFill.style.width = ((idx + 1) / total * 100) + '%';
    if (frameCounter) frameCounter.textContent = `Кадр ${idx + 1} из ${total}`;

    const frame = allFrames[idx];
    if (!frame) return;

    // Reset video preview state for this frame
    const preview = frame.querySelector('.frame-preview');
    const previewInfo = frame.querySelector('.frame-preview-info');
    const playBtn = frame.querySelector('.video-play-btn');
    const video = frame.querySelector('video');
    if (preview) preview.classList.remove('hidden');
    if (previewInfo) previewInfo.classList.remove('hidden');
    if (playBtn) playBtn.style.display = 'flex';
    if (video) { video.classList.remove('visible'); video.pause(); video.currentTime = 0; }

    // Reset narrator bar collapse state
    const narratorBar = frame.querySelector('.narrator-bar');
    const narratorToggle = frame.querySelector('.narrator-toggle');
    if (narratorBar) { narratorBar.classList.remove('collapsed'); }
    if (narratorToggle) {
      const ntIcon = narratorToggle.querySelector('.nt-icon');
      if (ntIcon) ntIcon.textContent = '−';
      narratorToggle.title = 'Свернуть';
    }

    // Reset swipe hint
    const swipeHint = frame.querySelector('.swipe-hint');
    if (swipeHint) {
      swipeHint.classList.remove('hidden');
      if (swipeHintTimeout) clearTimeout(swipeHintTimeout);
      swipeHintTimeout = setTimeout(() => {
        if (swipeHint) swipeHint.classList.add('hidden');
      }, 3000);
    }

    // Auto-play audio narration + dialogue sequence
    const audioSrc = frame.querySelector('.audio-btn')?.dataset.audio;
    const dialogueAudios = frames[idx]?.dialogueAudio || [];
    const allAudio = [];
    if (audioSrc) allAudio.push(audioSrc);
    if (dialogueAudios.length) allAudio.push(...dialogueAudios);
    console.log('Frame', idx, 'audio queue:', allAudio);

    if (allAudio.length > 0) {
      playAudioSequence(allAudio, () => showTransitionPopup(idx));
    } else {
      setTimeout(() => showTransitionPopup(idx), 2500);
    }

    // Update profile badge in viewer
    if (typeof PlayerProfile !== 'undefined' && PlayerProfile.renderBadge) {
      PlayerProfile.renderBadge();
    }

    // Start typewriter narration
    const narratorContent = frame.querySelector('.narrator-content');
    const narrationText = frames[idx]?.narration || '';
    if (narratorContent && narrationText) {
      typeWriter(narrationText, narratorContent);
    }
  }

  function resetFrameState() {
    // No phase states to reset — video and audio start automatically
  }

  function animateTo(idx, direction) {
    if (idx < 0 || idx >= frames.length) return;
    showFrame(idx, direction);
  }

  function nextFrame() {
    const frameData = frames[currentFrameIdx];
    if (frameData && frameData.game) {
      gameAdvancePending = true;
      startGame(frameData.game);
      return;
    }
    if (currentFrameIdx < frames.length - 1) {
      animateTo(currentFrameIdx + 1, 'next');
    } else {
      showEndScreen();
    }
  }

  function advanceFromGame() {
    if (gameAdvancePending) {
      gameAdvancePending = false;
      if (currentFrameIdx < frames.length - 1) {
        animateTo(currentFrameIdx + 1, 'next');
      } else {
        showEndScreen();
      }
    }
  }

  function prevFrame() {
    if (currentFrameIdx > 0) {
      animateTo(currentFrameIdx - 1, 'prev');
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE TRANSITIONS
  // ═══════════════════════════════════════════════════════════
  function startVideoPhase() {
    // Deprecated — video now starts automatically with the frame
  }

  // ═══════════════════════════════════════════════════════════
  // GAME INTEGRATION
  // ═══════════════════════════════════════════════════════════
  function startGame(gameType) {
    stopAudio();
    if (gameType === 'runner') {
      showGameTransition('🏃 Мини-игра!', 'Помоги Суперглазке догнать Пикселька!', () => {
        if (typeof startRunnerGame === 'function') startRunnerGame();
      });
    } else if (gameType === 'gym') {
      showGameTransition('⚔️ Ваня против Ленивуса!', 'Используй три супер-атаки: Лазер, Прицел и Слёзы.', () => {
        if (typeof startGymGame === 'function') startGymGame();
      });
    } else if (gameType === 'blink') {
      showGameTransition('👁️ Моргайка!', 'Тренируем глазные мышцы: моргай, жмурься и распахивай глаза!', () => {
        if (typeof startBlinkGame === 'function') startBlinkGame();
      });
    } else if (gameType === 'tracker') {
      showGameTransition('🔮 Следи за шариком!', 'Следи глазами за светящимся шариком — тренируем внимание!', () => {
        if (typeof startTrackerGame === 'function') startTrackerGame();
      });
    }
  }

  function showGameTransition(title, subtitle, onStart) {
    const overlay = document.getElementById('game-transition-overlay');
    if (!overlay) { if (onStart) onStart(); return; }

    const tTitle = overlay.querySelector('.gt-title');
    const tSub = overlay.querySelector('.gt-sub');
    if (tTitle) tTitle.textContent = title;
    if (tSub) tSub.textContent = subtitle;

    overlay.classList.add('visible');

    const btn = overlay.querySelector('.gt-btn');
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      const start = () => {
        overlay.classList.remove('visible');
        if (onStart) setTimeout(onStart, 300);
      };
      newBtn.addEventListener('click', start);
      newBtn.addEventListener('touchstart', (e) => { e.preventDefault(); start(); }, {passive: false});
    }
  }

  // ═══════════════════════════════════════════════════════════
  // TRANSITIONS & END SCREEN
  // ═══════════════════════════════════════════════════════════
  function showTransition(onComplete) {
    if (!transitionOverlay) {
      if (onComplete) onComplete();
      return;
    }
    transitionOverlay.classList.add('visible');
    setTimeout(() => {
      transitionOverlay.classList.remove('visible');
      if (onComplete) onComplete();
    }, 800);
  }

  function showEndScreen() {
    const text = transitionOverlay ? transitionOverlay.querySelector('.transition-text') : null;
    if (text) text.textContent = 'Эпизод завершён! Скоро продолжение...';
    if (transitionOverlay) transitionOverlay.classList.add('visible');
    setTimeout(() => {
      if (transitionOverlay) transitionOverlay.classList.remove('visible');
      backToMenu();
    }, 3000);
  }

  // ═══════════════════════════════════════════════════════════
  // MENU
  // ═══════════════════════════════════════════════════════════
  function startEpisode(episodeId) {
    const epData = EPISODES[episodeId];
    if (!epData) return;

    currentEpisode = epData;
    frames = epData.frames;

    // Render frames into container
    if (frameContainer) {
      frameContainer.innerHTML = frames.map((f, i) => renderFrame(f, i, frames.length)).join('');
    }

    if (mainMenu) mainMenu.classList.add('hidden');
    if (episodeViewer) episodeViewer.classList.add('active');

    // Update profile badge
    if (typeof PlayerProfile !== 'undefined') PlayerProfile.renderBadge();

    // Bind events on newly rendered elements
    bindFrameEvents();
    showFrame(0, null);
  }

  function backToMenu() {
    stopAudio();
    if (episodeViewer) episodeViewer.classList.remove('active');
    if (mainMenu) mainMenu.classList.remove('hidden');
    if (frameContainer) frameContainer.innerHTML = '';
    currentEpisode = null;
    frames = [];
    currentFrameIdx = 0;
  }

  // ═══════════════════════════════════════════════════════════
  // EVENT BINDING
  // ═══════════════════════════════════════════════════════════
  function bindFrameEvents() {
    // Audio toggle
    document.querySelectorAll('.audio-btn').forEach(btn => {
      const toggle = () => {
        if (isPlayingAudio) {
          stopAudio();
        } else {
          const frameData = frames[currentFrameIdx];
          const allAudio = [];
          if (frameData?.audioSrc) allAudio.push(frameData.audioSrc);
          if (frameData?.dialogueAudio?.length) allAudio.push(...frameData.dialogueAudio);
          if (allAudio.length) playAudioSequence(allAudio, null);
        }
      };
      btn.addEventListener('click', toggle);
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); toggle(); }, {passive: false});
    });

    // Dialogue audio button
    document.querySelectorAll('.dialogue-audio-btn').forEach(btn => {
      const playDialogues = () => {
        stopAudio();
        const frameData = frames[currentFrameIdx];
        if (frameData?.dialogueAudio?.length) {
          playAudioSequence(frameData.dialogueAudio, null);
        }
      };
      btn.addEventListener('click', playDialogues);
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); playDialogues(); }, {passive: false});
    });

    // Video play button
    document.querySelectorAll('.video-play-btn').forEach(btn => {
      const playVideo = () => {
        const layer = btn.closest('.video-layer');
        const preview = layer?.querySelector('.frame-preview');
        const previewInfo = layer?.querySelector('.frame-preview-info');
        const video = layer?.querySelector('video');
        if (preview) preview.classList.add('hidden');
        if (previewInfo) previewInfo.classList.add('hidden');
        if (video) {
          video.classList.add('visible');
          video.muted = false;
          video.play().catch(() => {});
        }
        btn.style.display = 'none';
      };
      btn.addEventListener('click', playVideo);
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); playVideo(); }, {passive: false});
    });

    // Video pause/play toggle on video itself
    document.querySelectorAll('.video-layer video').forEach(video => {
      video.addEventListener('click', () => {
        if (video.paused) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
      video.addEventListener('ended', () => {
        const layer = video.closest('.video-layer');
        const preview = layer?.querySelector('.frame-preview');
        const previewInfo = layer?.querySelector('.frame-preview-info');
        const playBtn = layer?.querySelector('.video-play-btn');
        video.classList.remove('visible');
        if (preview) preview.classList.remove('hidden');
        if (previewInfo) previewInfo.classList.remove('hidden');
        if (playBtn) playBtn.style.display = 'flex';
      });
    });

    // Narrator bar toggle
    document.querySelectorAll('.narrator-toggle').forEach(btn => {
      const toggle = () => {
        const bar = btn.previousElementSibling;
        if (!bar || !bar.classList.contains('narrator-bar')) return;
        bar.classList.toggle('collapsed');
        const isCollapsed = bar.classList.contains('collapsed');
        const ntIcon = btn.querySelector('.nt-icon');
        if (ntIcon) ntIcon.textContent = isCollapsed ? '+' : '−';
        btn.title = isCollapsed ? 'Развернуть' : 'Свернуть';
      };
      btn.addEventListener('click', toggle);
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); toggle(); }, {passive: false});
    });

    // Transition popup buttons
    document.querySelectorAll('.transition-popup-btn').forEach(btn => {
      const go = () => { hideTransitionPopup(currentFrameIdx); nextFrame(); };
      btn.addEventListener('click', go);
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); go(); }, {passive: false});
    });

    // Game chips (replayable mini-games)
    document.querySelectorAll('.game-chip').forEach(btn => {
      const launch = () => {
        gameAdvancePending = false;
        const gameType = btn.dataset.game;
        if (gameType) startGame(gameType);
      };
      btn.addEventListener('click', launch);
      btn.addEventListener('touchstart', (e) => { e.preventDefault(); launch(); }, {passive: false});
    });
  }

  // ═══════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════
  function createSparkles(x, y) {
    const colors = ['#fbbf24', '#f59e0b', '#fff', '#a855f7', '#06b6d4'];
    const count = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      const isStar = Math.random() > 0.5;
      el.className = isStar ? 'sparkle star' : 'sparkle';
      if (isStar) el.textContent = '✨';
      else el.style.background = `radial-gradient(circle, ${colors[Math.floor(Math.random() * colors.length)]} 0%, transparent 70%)`;
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 50;
      el.style.setProperty('--sx', Math.cos(angle) * dist + 'px');
      el.style.setProperty('--sy', Math.sin(angle) * dist + 'px');
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 800);
    }
  }

  function initSwipe() {
    const container = frameContainer || document.getElementById('frame-container');
    if (!container) return;

    let startY = 0, startX = 0, isDragging = false;
    const SWIPE_THRESHOLD = 80;

    function onStart(y, x) {
      startY = y;
      startX = x;
      isDragging = true;
    }
    function onMove(y, x) {
      if (!isDragging) return;
      // Optional real-time drag feedback could go here
    }
    function onEnd(y, x) {
      if (!isDragging) return;
      isDragging = false;
      const deltaY = y - startY;
      const deltaX = x - startX;
      // Ignore horizontal swipes
      if (Math.abs(deltaX) > Math.abs(deltaY)) return;
      if (deltaY < -SWIPE_THRESHOLD) nextFrame();
      else if (deltaY > SWIPE_THRESHOLD) prevFrame();
    }

    container.addEventListener('touchstart', e => {
      // Ignore if touch starts inside interactive elements
      if (e.target.closest('.narrator-bar, .transition-popup, .video-play-btn, .audio-btn, .dialogue-audio-btn, .nav-btn, .game-chip, .narrator-toggle')) return;
      createSparkles(e.touches[0].clientX, e.touches[0].clientY);
      onStart(e.touches[0].clientY, e.touches[0].clientX);
    }, {passive: true});
    container.addEventListener('touchmove', e => {
      if (!isDragging) return;
      onMove(e.touches[0].clientY, e.touches[0].clientX);
    }, {passive: true});
    container.addEventListener('touchend', e => {
      if (!isDragging) return;
      onEnd(e.changedTouches[0].clientY, e.changedTouches[0].clientX);
    }, {passive: true});

    // Mouse support for desktop
    container.addEventListener('mousedown', e => {
      if (e.target.closest('.narrator-bar, .transition-popup, .video-play-btn, .audio-btn, .dialogue-audio-btn, .nav-btn, .game-chip, .narrator-toggle')) return;
      createSparkles(e.clientX, e.clientY);
      onStart(e.clientY, e.clientX);
    });
    container.addEventListener('mousemove', e => {
      if (!isDragging) return;
      onMove(e.clientY, e.clientX);
    });
    container.addEventListener('mouseup', e => {
      if (!isDragging) return;
      onEnd(e.clientY, e.clientX);
    });
    container.addEventListener('mouseleave', () => { isDragging = false; });
  }

  function init() {
    initSwipe();

    // Splash screen
    if (startBtn && splash) {
      startBtn.addEventListener('click', () => {
        // Initialize audio context on user gesture
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) { const ac = new AudioContext(); if (ac.state === 'suspended') ac.resume(); }
        } catch(e) {}
        splash.classList.add('hide');
        setTimeout(() => { splash.style.display = 'none'; }, 600);
        if (mainMenu) mainMenu.style.display = 'flex';
      });
      startBtn.addEventListener('touchend', (e) => { e.preventDefault(); startBtn.click(); }, {passive: false});
    }

    // Chapter cards
    document.querySelectorAll('.chapter-card').forEach(card => {
      card.addEventListener('click', () => {
        if (card.classList.contains('locked')) return;
        const episode = card.dataset.episode;
        if (episode) startEpisode(episode);
      });
    });

    // Back button
    document.querySelectorAll('.back-btn').forEach(btn => {
      btn.addEventListener('click', () => backToMenu());
    });

    // Keyboard nav
    document.addEventListener('keydown', (e) => {
      if (!episodeViewer || !episodeViewer.classList.contains('active')) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        const frameData = frames[currentFrameIdx];
        if (frameData && frameData.game) {
          startGame(frameData.game);
        } else {
          nextFrame();
        }
      }
      if (e.key === 'ArrowLeft') prevFrame();
      if (e.key === 'Escape') backToMenu();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { startEpisode, backToMenu, nextFrame, prevFrame, advanceFromGame };
})();

/* ═══════════════════════════════════════════════════════════
   LEGACY GAME COMPATIBILITY SHIMS
   ═══════════════════════════════════════════════════════════ */

// Called by game_runner.js when game ends or is skipped
window.closeRunner = function(skip) {
  document.getElementById('game-overlay-runner').classList.remove('visible');
  if (skip) {
    setTimeout(() => {
      if (typeof App !== 'undefined') App.advanceFromGame();
    }, 300);
  }
};

window.showRunnerRegistration = function() {
  document.getElementById('runner-stats-overlay').classList.remove('visible');
  document.getElementById('runner-registration-overlay').classList.add('visible');
};

window.skipRunnerRegistration = function() {
  document.getElementById('runner-registration-overlay').classList.remove('visible');
  if (typeof App !== 'undefined') App.advanceFromGame();
};

window.finishRunnerRegistration = function() {
  document.getElementById('runner-registration-overlay').classList.remove('visible');
  if (typeof App !== 'undefined') App.advanceFromGame();
};

// Called by game_gymnastics.js when game ends or is skipped
window.closeGym = function(skip) {
  document.getElementById('game-overlay-gym').classList.remove('visible');
  if (skip) {
    setTimeout(() => {
      if (typeof App !== 'undefined') App.advanceFromGame();
    }, 300);
  }
};

window.showRegistration = function() {
  document.getElementById('stats-overlay').classList.remove('visible');
  document.getElementById('registration-overlay').classList.add('visible');
};

window.skipRegistration = function() {
  document.getElementById('registration-overlay').classList.remove('visible');
  if (typeof App !== 'undefined') App.advanceFromGame();
};

window.finishRegistration = function() {
  document.getElementById('registration-overlay').classList.remove('visible');
  if (typeof App !== 'undefined') App.advanceFromGame();
};

// Called by both games on victory
window.closeWinContinue = function() {
  document.getElementById('win-overlay').classList.remove('visible');
  setTimeout(() => {
    if (typeof App !== 'undefined') App.advanceFromGame();
  }, 300);
};

// Hide overlay helper used by old comic.js
window.hideOverlay = function(id) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (el) el.classList.remove('visible');
};
