/* ═══════════════════════════════════════════════════════════
   СУПЕРГЛАЗКА — Stories Pro Engine
   ═══════════════════════════════════════════════════════════ */

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
// AUDIO CONTROLLER — unified audio mixer
// ═══════════════════════════════════════════════════════════
const AudioController = {
  queue: [],
  currentIdx: 0,
  currentAudio: null,
  state: 'idle',
  activeTracks: { narration: true, dialogue: true, video: false },
  volume: 0.8,
  timeoutId: null,
  frameData: null,

  setFrameData(frameData) {
    this.frameData = frameData;
    this.stop();
    this.currentIdx = 0;
    this.buildQueue();
  },

  buildQueue() {
    this.queue = [];
    if (this.activeTracks.narration && this.frameData?.audioSrc) {
      this.queue.push({ type: 'narration', src: this.frameData.audioSrc });
    }
    if (this.activeTracks.dialogue && this.frameData?.dialogueAudio?.length) {
      this.frameData.dialogueAudio.forEach(src => {
        this.queue.push({ type: 'dialogue', src });
      });
    }
  },

  play() {
    if (this.state === 'video') return;
    if (this.queue.length === 0) {
      this.state = 'idle';
      this.onQueueEnd();
      return;
    }
    this.state = 'playing';
    this.playNext();
  },

  playNext() {
    if (this.currentIdx >= this.queue.length) {
      this.stopCurrent();
      this.state = 'idle';
      this.onQueueEnd();
      return;
    }
    const item = this.queue[this.currentIdx];
    const audio = new Audio(item.src);
    audio.volume = this.volume;
    audio.preload = 'auto';
    this.currentAudio = audio;

    audio.onended = () => {
      this.clearTimeout();
      this.currentIdx++;
      this.playNext();
    };
    audio.onerror = () => {
      console.warn('Audio failed:', item.src);
      this.clearTimeout();
      this.currentIdx++;
      this.playNext();
    };

    audio.play().catch(err => {
      console.warn('Audio play failed:', item.src, err);
      this.clearTimeout();
      this.currentIdx++;
      this.playNext();
    });

    this.timeoutId = setTimeout(() => {
      if (this.currentAudio) {
        console.warn('Audio timeout, skipping:', item.src);
        this.currentIdx++;
        this.playNext();
      }
    }, 30000);

    this.updateUI();
  },

  stopCurrent() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.clearTimeout();
  },

  clearTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  },

  pause() {
    if (this.currentAudio && this.state === 'playing') {
      this.currentAudio.pause();
      this.state = 'paused';
      this.updateUI();
    }
  },

  resume() {
    if (this.currentAudio && this.state === 'paused') {
      this.currentAudio.play().catch(() => {});
      this.state = 'playing';
      this.updateUI();
    } else if ((this.state === 'idle' || this.state === 'paused') && this.queue.length > 0) {
      this.play();
    }
  },

  stop() {
    this.stopCurrent();
    this.state = 'idle';
    this.currentIdx = 0;
    this.updateUI();
  },

  toggleTrack(type) {
    this.activeTracks[type] = !this.activeTracks[type];

    if (type === 'video') {
      const video = document.querySelector('.frame.active video');
      if (this.activeTracks.video) {
        this.pause();
        this.state = 'video';
        if (video) {
          video.muted = false;
          video.play().catch(() => {});
        }
      } else {
        this.state = 'idle';
        if (video) {
          video.pause();
          video.currentTime = 0;
        }
        this.play();
      }
    } else {
      const wasPlaying = this.state === 'playing';
      this.stop();
      this.buildQueue();
      if (wasPlaying && !this.activeTracks.video) {
        this.play();
      }
    }
    this.updateUI();
  },

  playVideo(videoEl) {
    this.stop();
    this.state = 'video';
    this.activeTracks.video = true;
    this.activeTracks.narration = false;
    this.activeTracks.dialogue = false;
    videoEl.muted = false;
    this.updateUI();
  },

  onVideoEnded() {
    if (this.state === 'video') {
      this.activeTracks.video = false;
      this.activeTracks.narration = true;
      this.activeTracks.dialogue = true;
      this.state = 'idle';
      this.buildQueue();
      this.play();
      this.updateUI();
    }
  },

  onQueueEnd() {
    if (typeof App !== 'undefined' && App.onAudioEnd) {
      App.onAudioEnd();
    }
  },

  setVolume(v) {
    this.volume = v / 100;
    if (this.currentAudio) this.currentAudio.volume = this.volume;
    const video = document.querySelector('.frame.active video');
    if (video) video.volume = this.volume;
  },

  updateUI() {
    const narrStatus = document.getElementById('bsStatusNarration');
    const dialStatus = document.getElementById('bsStatusDialogue');
    const vidStatus = document.getElementById('bsStatusVideo');
    if (narrStatus) narrStatus.textContent = this.activeTracks.narration ? 'Вкл' : 'Выкл';
    if (dialStatus) dialStatus.textContent = this.activeTracks.dialogue ? 'Вкл' : 'Выкл';
    if (vidStatus) vidStatus.textContent = this.activeTracks.video ? 'Вкл' : 'Выкл';

    const narrToggle = document.getElementById('bsToggleNarration');
    const dialToggle = document.getElementById('bsToggleDialogue');
    const vidToggle = document.getElementById('bsToggleVideo');
    if (narrToggle) narrToggle.classList.toggle('active', this.activeTracks.narration);
    if (dialToggle) dialToggle.classList.toggle('active', this.activeTracks.dialogue);
    if (vidToggle) vidToggle.classList.toggle('active', this.activeTracks.video);

    const narrIcon = document.getElementById('bsIconNarration');
    const dialIcon = document.getElementById('bsIconDialogue');
    const vidIcon = document.getElementById('bsIconVideo');
    if (narrIcon) narrIcon.classList.toggle('playing', this.state === 'playing' && this.currentIdx === 0);
    if (dialIcon) dialIcon.classList.toggle('playing', this.state === 'playing' && this.currentIdx > 0);
    if (vidIcon) vidIcon.classList.toggle('playing', this.state === 'video');

    const btn = document.getElementById('bsAudioToggle');
    if (btn) {
      btn.classList.toggle('playing', this.state === 'playing' || this.state === 'video');
      if (this.state === 'video') btn.textContent = '🎬';
      else if (this.state === 'playing') btn.textContent = '⏸';
      else btn.textContent = '🔊';
    }
  }
};

// ═══════════════════════════════════════════════════════════
// BOTTOM SHEET — unified bottom panel
// ═══════════════════════════════════════════════════════════
const BottomSheet = {
  state: 'collapsed',

  init() {
    this.el = document.getElementById('bottomSheet');
    this.dragHandle = document.getElementById('bsDragHandle');
    this.subtitleText = document.getElementById('bsSubtitleText');
    this.subtitleIcon = document.getElementById('bsSubtitleIcon');
    this.narratorFull = document.getElementById('bsNarratorFull');
    this.gameDock = document.getElementById('bsGameDock');
    this.gamePanelInner = document.getElementById('bsGamePanelInner');
    this.nextBtn = document.getElementById('bsNextBtn');
    this.navNextBtn = document.getElementById('bsNavNextBtn');
    this.prevBtn = document.getElementById('bsPrevBtn');

    this.dragHandle.addEventListener('click', () => this.toggle());
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el || e.target.classList.contains('bs-subtitle')) {
        this.expand();
      }
    });

    const audioToggle = document.getElementById('bsAudioToggle');
    if (audioToggle) {
      audioToggle.addEventListener('click', () => {
        if (AudioController.state === 'playing') AudioController.pause();
        else if (AudioController.state === 'paused') AudioController.resume();
        else if (AudioController.state === 'video') AudioController.toggleTrack('video');
        else AudioController.play();
      });
    }

    ['Narration', 'Dialogue', 'Video'].forEach(type => {
      const toggle = document.getElementById('bsToggle' + type);
      if (toggle) toggle.addEventListener('click', () => AudioController.toggleTrack(type.toLowerCase()));
    });

    const volSlider = document.getElementById('bsVolumeSlider');
    if (volSlider) volSlider.addEventListener('input', (e) => AudioController.setVolume(e.target.value));

    if (this.nextBtn) this.nextBtn.addEventListener('click', () => App.nextFrame());
    if (this.navNextBtn) this.navNextBtn.addEventListener('click', () => App.nextFrame());
    if (this.prevBtn) this.prevBtn.addEventListener('click', () => App.prevFrame());

    this.initDrag();
  },

  toggle() { this.state === 'collapsed' ? this.expand() : this.collapse(); },
  expand() { this.state = 'expanded'; this.el.classList.remove('collapsed'); },
  collapse() { this.state = 'collapsed'; this.el.classList.add('collapsed'); },

  setSubtitle(text, icon) {
    if (this.subtitleText) this.subtitleText.textContent = text || '';
    if (this.subtitleIcon && icon) this.subtitleIcon.textContent = icon;
  },

  setNarratorFull(text) {
    if (this.narratorFull) this.narratorFull.textContent = text || '';
  },

  showNextButton(text) {
    if (this.nextBtn) {
      this.nextBtn.classList.add('active');
      if (text) this.nextBtn.textContent = text + ' →';
    }
    if (this.navNextBtn) this.navNextBtn.classList.add('active');
  },

  hideNextButton() {
    if (this.nextBtn) {
      this.nextBtn.classList.remove('active');
      this.nextBtn.textContent = 'Далее →';
    }
    if (this.navNextBtn) this.navNextBtn.classList.remove('active');
  },

  renderGameDock(games) {
    if (!this.gameDock) return;
    this.gameDock.innerHTML = '';
    if (!games || games.length === 0) return;
    games.forEach(g => {
      const chip = document.createElement('button');
      chip.className = 'game-chip';
      chip.title = GAME_NAMES[g] || g;
      chip.innerHTML = `<span class="game-chip-icon">${GAME_ICONS[g] || '🎮'}</span>`;
      chip.addEventListener('click', () => App.startGame(g));
      this.gameDock.appendChild(chip);
    });
  },

  renderGamePanel(games) {
    if (!this.gamePanelInner) return;
    this.gamePanelInner.innerHTML = '';
    if (!games || games.length === 0) {
      this.gamePanelInner.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-size:13px;">Нет доступных игр на этом кадре</div>';
      return;
    }
    games.forEach(g => {
      const chip = document.createElement('button');
      chip.className = 'bs-game-chip';
      chip.innerHTML = `<span class="bs-game-chip-icon">${GAME_ICONS[g] || '🎮'}</span><span>${GAME_NAMES[g] || g}</span>`;
      chip.addEventListener('click', () => App.startGame(g));
      this.gamePanelInner.appendChild(chip);
    });
  },

  initDrag() {
    let startY = 0;
    const onStart = (y) => { startY = y; };
    const onEnd = (y) => {
      const delta = startY - y;
      if (delta > 40) this.expand();
      else if (delta < -40) this.collapse();
    };
    this.dragHandle.addEventListener('touchstart', (e) => onStart(e.touches[0].clientY), {passive: true});
    this.dragHandle.addEventListener('touchend', (e) => onEnd(e.changedTouches[0].clientY), {passive: true});
    this.dragHandle.addEventListener('mousedown', (e) => onStart(e.clientY));
    this.dragHandle.addEventListener('mouseup', (e) => onEnd(e.clientY));
  }
};

// ═══════════════════════════════════════════════════════════
// APP CORE
// ═══════════════════════════════════════════════════════════
const App = (function() {
  'use strict';

  let currentEpisode = null;
  let currentFrameIdx = 0;
  let frames = [];
  let gameAdvancePending = false;
  let typeWriterInterval = null;
  let dialogueTimeouts = [];
  let audioEndedForFrame = false;
  let typewriterEndedForFrame = false;
  let uiHideTimeout = null;

  const mainMenu = document.getElementById('main-menu');
  const episodeViewer = document.getElementById('episode-viewer');
  const splash = document.getElementById('splash');
  const startBtn = document.getElementById('startBtn');
  const frameContainer = document.getElementById('frame-container');

  // ─── TYPEWRITER ───
  function stopTypeWriter() {
    if (typeWriterInterval) { clearInterval(typeWriterInterval); typeWriterInterval = null; }
  }

  function typeWriter(text, onUpdate, onEnd) {
    stopTypeWriter();
    if (!text) { if (onEnd) onEnd(); return; }
    let i = 0;
    typeWriterInterval = setInterval(() => {
      if (i < text.length) {
        if (onUpdate) onUpdate(text.substring(0, i + 1));
        i++;
      } else {
        stopTypeWriter();
        if (onEnd) onEnd();
      }
    }, 30);
  }

  // ─── RENDER FRAME ───
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
      </div>
    `;
  }

  // ─── PROGRESS DOTS ───
  function updateProgressDots(current, total) {
    const container = document.getElementById('progressDots');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('div');
      dot.className = 'progress-dot' + (i === current ? ' active' : i < current ? ' seen' : '');
      container.appendChild(dot);
    }
  }

  // ─── FRAME END CHECK ───
  function resetEndFlags() {
    audioEndedForFrame = false;
    typewriterEndedForFrame = false;
  }

  function checkFrameEnd() {
    if (audioEndedForFrame && typewriterEndedForFrame) {
      const frameData = frames[currentFrameIdx];
      BottomSheet.showNextButton(frameData?.transitionText || 'Далее');
    }
  }

  function onAudioEnd() {
    audioEndedForFrame = true;
    checkFrameEnd();
  }

  function onTypewriterEnd() {
    typewriterEndedForFrame = true;
    checkFrameEnd();
  }

  // ─── SHOW FRAME ───
  function showFrame(idx, direction) {
    const allFrames = document.querySelectorAll('.frame');
    AudioController.stop();
    stopTypeWriter();
    clearDialogueTimeouts();
    resetEndFlags();
    BottomSheet.hideNextButton();

    if (!direction) allFrames.forEach(f => f.style.transition = 'none');

    allFrames.forEach((f, i) => {
      if (i !== idx) {
        const v = f.querySelector('video');
        if (v) { v.pause(); v.currentTime = 0; }
      }
      f.classList.remove('active', 'above', 'below');
      if (i === idx) f.classList.add('active');
      else if (i < idx) f.classList.add('above');
      else f.classList.add('below');
    });

    if (!direction) {
      requestAnimationFrame(() => allFrames.forEach(f => f.style.transition = ''));
    }

    currentFrameIdx = idx;
    const frameData = frames[idx];

    updateProgressDots(idx, frames.length);
    BottomSheet.setSubtitle('');
    BottomSheet.setNarratorFull(frameData?.narration || '');
    BottomSheet.renderGameDock(frameData?.availableGames || []);
    BottomSheet.renderGamePanel(frameData?.availableGames || []);

    const frame = allFrames[idx];
    if (frame) {
      const preview = frame.querySelector('.frame-preview');
      const previewInfo = frame.querySelector('.frame-preview-info');
      const playBtn = frame.querySelector('.video-play-btn');
      const video = frame.querySelector('video');
      if (preview) preview.classList.remove('hidden');
      if (previewInfo) previewInfo.classList.remove('hidden');
      if (playBtn) playBtn.style.display = 'flex';
      if (video) {
        video.classList.remove('visible');
        video.pause();
        video.currentTime = 0;
        video.volume = AudioController.volume;
      }
    }

    AudioController.setFrameData(frameData);
    AudioController.play();

    const narrationText = frameData?.narration || '';
    if (narrationText) {
      typeWriter(narrationText,
        (text) => BottomSheet.setSubtitle(text),
        () => { onTypewriterEnd(); }
      );
    } else {
      typewriterEndedForFrame = true;
    }

    if (typeof PlayerProfile !== 'undefined' && PlayerProfile.renderBadge) {
      PlayerProfile.renderBadge();
    }

    // Reset UI hide timer
    clearTimeout(uiHideTimeout);
    episodeViewer.classList.remove('ui-hidden');
    uiHideTimeout = setTimeout(() => {
      if (BottomSheet.state === 'collapsed') episodeViewer.classList.add('ui-hidden');
    }, 3000);
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
    if (currentFrameIdx > 0) animateTo(currentFrameIdx - 1, 'prev');
  }

  // ─── GAME INTEGRATION ───
  function startGame(gameType) {
    AudioController.stop();
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
      const start = () => { overlay.classList.remove('visible'); if (onStart) setTimeout(onStart, 300); };
      newBtn.addEventListener('click', start);
      newBtn.addEventListener('touchstart', (e) => { e.preventDefault(); start(); }, {passive: false});
    }
  }

  // ─── TRANSITIONS & END ───
  function showTransition(onComplete) {
    const overlay = document.getElementById('transition-overlay');
    if (!overlay) { if (onComplete) onComplete(); return; }
    overlay.classList.add('visible');
    setTimeout(() => {
      overlay.classList.remove('visible');
      if (onComplete) onComplete();
    }, 800);
  }

  function showEndScreen() {
    const text = document.querySelector('#transition-overlay .transition-text');
    if (text) text.textContent = 'Эпизод завершён! Скоро продолжение...';
    const overlay = document.getElementById('transition-overlay');
    if (overlay) overlay.classList.add('visible');
    setTimeout(() => {
      if (overlay) overlay.classList.remove('visible');
      backToMenu();
    }, 3000);
  }

  // ─── MENU ───
  function startEpisode(episodeId) {
    const epData = EPISODES[episodeId];
    if (!epData) return;
    currentEpisode = epData;
    frames = epData.frames;
    if (frameContainer) frameContainer.innerHTML = frames.map((f, i) => renderFrame(f, i, frames.length)).join('');
    if (mainMenu) mainMenu.classList.add('hidden');
    if (episodeViewer) episodeViewer.classList.add('active');
    if (typeof PlayerProfile !== 'undefined') PlayerProfile.renderBadge();
    bindFrameEvents();
    showFrame(0, null);
  }

  function backToMenu() {
    AudioController.stop();
    if (episodeViewer) episodeViewer.classList.remove('active');
    if (mainMenu) mainMenu.classList.remove('hidden');
    if (frameContainer) frameContainer.innerHTML = '';
    currentEpisode = null;
    frames = [];
    currentFrameIdx = 0;
  }

  // ─── EVENT BINDING ───
  function bindFrameEvents() {
    // Video play & toggle (delegated)
    frameContainer.addEventListener('click', (e) => {
      const playBtn = e.target.closest('.video-play-btn');
      if (playBtn) {
        const layer = playBtn.closest('.video-layer');
        const preview = layer?.querySelector('.frame-preview');
        const previewInfo = layer?.querySelector('.frame-preview-info');
        const video = layer?.querySelector('video');
        if (preview) preview.classList.add('hidden');
        if (previewInfo) previewInfo.classList.add('hidden');
        if (video) {
          video.classList.add('visible');
          video.muted = false;
          video.play().catch(() => {});
          AudioController.playVideo(video);
        }
        playBtn.style.display = 'none';
        return;
      }
      const video = e.target.closest('.video-layer video');
      if (video) {
        if (video.paused) video.play().catch(() => {});
        else video.pause();
        return;
      }
    });

    // Video ended — direct binding (ended event does not bubble reliably)
    document.querySelectorAll('.video-layer video').forEach(video => {
      video.addEventListener('ended', () => {
        const layer = video.closest('.video-layer');
        const preview = layer?.querySelector('.frame-preview');
        const previewInfo = layer?.querySelector('.frame-preview-info');
        const playBtn = layer?.querySelector('.video-play-btn');
        video.classList.remove('visible');
        if (preview) preview.classList.remove('hidden');
        if (previewInfo) previewInfo.classList.remove('hidden');
        if (playBtn) playBtn.style.display = 'flex';
        AudioController.onVideoEnded();
      });
    });
  }

  // ─── SWIPE ───
  function initSwipe() {
    if (!frameContainer) return;
    let startY = 0, startX = 0, isDragging = false;
    const SWIPE_THRESHOLD = 80;

    function onStart(y, x) { startY = y; startX = x; isDragging = true; }
    function onEnd(y, x) {
      if (!isDragging) return;
      isDragging = false;
      const deltaY = y - startY;
      const deltaX = x - startX;
      if (Math.abs(deltaX) > Math.abs(deltaY)) return;
      if (deltaY < -SWIPE_THRESHOLD) nextFrame();
      else if (deltaY > SWIPE_THRESHOLD) prevFrame();
    }

    frameContainer.addEventListener('touchstart', e => {
      if (e.target.closest('.video-play-btn')) return;
      onStart(e.touches[0].clientY, e.touches[0].clientX);
    }, {passive: true});
    frameContainer.addEventListener('touchend', e => {
      if (!isDragging) return;
      onEnd(e.changedTouches[0].clientY, e.changedTouches[0].clientX);
    }, {passive: true});

    frameContainer.addEventListener('mousedown', e => {
      if (e.target.closest('.video-play-btn')) return;
      onStart(e.clientY, e.clientX);
    });
    frameContainer.addEventListener('mouseup', e => {
      if (!isDragging) return;
      onEnd(e.clientY, e.clientX);
    });
    frameContainer.addEventListener('mouseleave', () => { isDragging = false; });
  }

  // ─── UI HIDE ───
  function initUIHide() {
    if (!episodeViewer) return;
    episodeViewer.addEventListener('click', (e) => {
      // Ignore clicks on interactive elements
      if (e.target.closest('.frame-top-bar, .bottom-sheet, .video-play-btn, .video-layer, .bs-controls, .bs-expanded')) return;
      episodeViewer.classList.toggle('ui-hidden');
      if (!episodeViewer.classList.contains('ui-hidden')) {
        clearTimeout(uiHideTimeout);
        uiHideTimeout = setTimeout(() => {
          if (BottomSheet.state === 'collapsed') episodeViewer.classList.add('ui-hidden');
        }, 3000);
      }
    });
  }

  // ─── INIT ───
  function init() {
    initSwipe();
    initUIHide();
    BottomSheet.init();

    if (startBtn && splash) {
      startBtn.addEventListener('click', () => {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (AC) { const ac = new AC(); if (ac.state === 'suspended') ac.resume(); }
        } catch(e) {}
        splash.classList.add('hide');
        setTimeout(() => { splash.style.display = 'none'; }, 600);
        if (mainMenu) mainMenu.style.display = 'flex';
      });
      startBtn.addEventListener('touchend', (e) => { e.preventDefault(); startBtn.click(); }, {passive: false});
    }

    document.querySelectorAll('.chapter-card').forEach(card => {
      card.addEventListener('click', () => {
        if (card.classList.contains('locked')) return;
        const episode = card.dataset.episode;
        if (episode) startEpisode(episode);
      });
    });

    document.querySelectorAll('#viewerBackBtn, .back-btn').forEach(btn => {
      btn.addEventListener('click', () => backToMenu());
    });

    document.addEventListener('keydown', (e) => {
      if (!episodeViewer || !episodeViewer.classList.contains('active')) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        const frameData = frames[currentFrameIdx];
        if (frameData && frameData.game) startGame(frameData.game);
        else nextFrame();
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

  return { startEpisode, backToMenu, nextFrame, prevFrame, advanceFromGame, startGame, onAudioEnd };
})();

/* ═══════════════════════════════════════════════════════════
   LEGACY GAME COMPATIBILITY SHIMS
   ═══════════════════════════════════════════════════════════ */

window.closeRunner = function(skip) {
  document.getElementById('game-overlay-runner').classList.remove('visible');
  if (skip) setTimeout(() => { if (typeof App !== 'undefined') App.advanceFromGame(); }, 300);
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

window.closeGym = function(skip) {
  document.getElementById('game-overlay-gym').classList.remove('visible');
  if (skip) setTimeout(() => { if (typeof App !== 'undefined') App.advanceFromGame(); }, 300);
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

window.closeWinContinue = function() {
  document.getElementById('win-overlay').classList.remove('visible');
  setTimeout(() => { if (typeof App !== 'undefined') App.advanceFromGame(); }, 300);
};

window.hideOverlay = function(id) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (el) el.classList.remove('visible');
};
