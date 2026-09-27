/**
 * meet4lyf - Ultra-smooth Scroll-driven Frame Animation Engine
 */

(function () {
  'use strict';

  // Configuration
  const TOTAL_FRAMES = 240;
  const INITIAL_BATCH_SIZE = 6;
  const FRAME_PREFIX = 'frames/frame_';
  const FRAME_EXTENSION = '.webp';
  const LERP_FACTOR = 0.085; // Inertia damping factor for silky smooth scrubbing

  // DOM Elements
  const canvas = document.getElementById('animation-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const siteHeader = document.getElementById('site-header');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loaderProgressFill = document.getElementById('loader-progress-fill');
  const loaderPercentage = document.getElementById('loader-percentage');
  const progressBarActive = document.getElementById('progress-bar-active');
  const frameCounter = document.getElementById('frame-counter');
  const scrollCue = document.getElementById('scroll-cue');

  // Modals DOM Elements
  const authModal = document.getElementById('auth-modal');
  const authBtn = document.getElementById('nav-auth-btn');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const modalTitle = document.getElementById('modal-title');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const loginOptions = document.getElementById('login-options');

  const infoModal = document.getElementById('info-modal');
  const infoModalClose = document.getElementById('info-modal-close');
  const infoModalTitle = document.getElementById('info-modal-title');
  const infoModalSub = document.getElementById('info-modal-sub');
  const infoModalContent = document.getElementById('info-modal-content');
  const infoModalBtn = document.getElementById('info-modal-btn');
  const navAboutBtn = document.getElementById('nav-about-btn');
  const navBlogsBtn = document.getElementById('nav-blogs-btn');

  // State
  const frames = new Array(TOTAL_FRAMES + 1);
  const loadedFlags = new Array(TOTAL_FRAMES + 1).fill(false);
  let loadedCount = 0;
  let isInitialReady = false;
  let lastDrawnFrameIndex = -1;

  let currentScrollProgress = 0;
  let targetScrollProgress = 0;
  let animationFrameId = null;

  // Format frame file path
  function getFramePath(index) {
    const padded = String(index).padStart(4, '0');
    return `${FRAME_PREFIX}${padded}${FRAME_EXTENSION}`;
  }

  // Preload a single frame
  function loadFrame(index) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = getFramePath(index);

      img.onload = () => {
        frames[index] = img;
        loadedFlags[index] = true;
        loadedCount++;
        onFrameLoaded();
        resolve(img);
      };

      img.onerror = () => {
        console.warn(`Failed to load frame ${index}`);
        loadedFlags[index] = false;
        resolve(null);
      };
    });
  }

  // Handle progress updates & loader dismiss
  function onFrameLoaded() {
    const percent = Math.round((loadedCount / TOTAL_FRAMES) * 100);
    
    if (loaderProgressFill) {
      loaderProgressFill.style.width = `${percent}%`;
    }
    if (loaderPercentage) {
      loaderPercentage.textContent = `${percent}%`;
    }

    // Render frame 1 immediately once ready
    if (!isInitialReady && loadedFlags[1]) {
      drawFrame(1);
    }

    // Dismiss loader once priority batch is ready
    if (!isInitialReady && (loadedCount >= INITIAL_BATCH_SIZE || percent >= 3)) {
      isInitialReady = true;
      dismissLoader();
    }
  }

  function dismissLoader() {
    if (loadingOverlay) {
      loadingOverlay.classList.add('fade-out');
      setTimeout(() => {
        loadingOverlay.style.display = 'none';
      }, 600);
    }
  }

  // Progressive Preloading Pipeline
  async function preloadAllFrames() {
    // 1. Priority load initial batch
    const priorityPromises = [];
    for (let i = 1; i <= Math.min(INITIAL_BATCH_SIZE, TOTAL_FRAMES); i++) {
      priorityPromises.push(loadFrame(i));
    }
    await Promise.all(priorityPromises);

    // 2. Load remaining frames with concurrency control
    const remainingIndices = [];
    for (let i = INITIAL_BATCH_SIZE + 1; i <= TOTAL_FRAMES; i++) {
      remainingIndices.push(i);
    }

    // Batch loading (chunks of 10)
    const BATCH_SIZE = 16;
    for (let i = 0; i < remainingIndices.length; i += BATCH_SIZE) {
      const chunk = remainingIndices.slice(i, i + BATCH_SIZE);
      await Promise.all(chunk.map((idx) => loadFrame(idx)));
    }
  }

  // Find nearest available loaded frame if target frame is pending
  function getBestAvailableFrame(index) {
    if (loadedFlags[index] && frames[index]) {
      return { img: frames[index], index };
    }

    // Search backwards
    for (let i = index - 1; i >= 1; i--) {
      if (loadedFlags[i] && frames[i]) {
        return { img: frames[i], index: i };
      }
    }

    // Search forwards
    for (let i = index + 1; i <= TOTAL_FRAMES; i++) {
      if (loadedFlags[i] && frames[i]) {
        return { img: frames[i], index: i };
      }
    }

    return null;
  }

  // High-DPI Canvas Resize and crisp coordinate mapping
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2 for performance & memory
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = Math.round(displayWidth * dpr);
      canvas.height = Math.round(displayHeight * dpr);
    }

    // Force redraw on resize
    if (lastDrawnFrameIndex > 0) {
      drawFrame(lastDrawnFrameIndex, true);
    }
  }

  // Draw frame with aspect-ratio preserving 'cover' scaling centered on screen
  function drawFrame(index, forceRedraw = false) {
    if (index === lastDrawnFrameIndex && !forceRedraw) return;

    const frameData = getBestAvailableFrame(index);
    if (!frameData || !frameData.img) return;

    const img = frameData.img;
    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth || 1280;
    const ih = img.naturalHeight || 720;

    // Cover math: scale to fill viewport while maintaining aspect ratio
    const imgRatio = iw / ih;
    const canvasRatio = cw / ch;

    let drawWidth, drawHeight, offsetX, offsetY;

    if (canvasRatio > imgRatio) {
      drawWidth = cw;
      drawHeight = cw / imgRatio;
      offsetX = 0;
      offsetY = (ch - drawHeight) / 2;
    } else {
      drawWidth = ch * imgRatio;
      drawHeight = ch;
      offsetX = (cw - drawWidth) / 2;
      offsetY = 0;
    }

    ctx.fillStyle = '#070709';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

    lastDrawnFrameIndex = index;
  }

  // Update target progress from window scroll
  function updateScrollProgress() {
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollTrack = document.querySelector('.scroll-track');
    const trackHeight = scrollTrack ? scrollTrack.offsetHeight : (document.documentElement.scrollHeight - window.innerHeight);
    
    if (trackHeight > 0) {
      targetScrollProgress = Math.max(0, Math.min(1, scrollY / trackHeight));
    } else {
      targetScrollProgress = 0;
    }

    // Fade UI overlay (frame counter & progress bar) when scrolling into bottom banner
    const uiOverlay = document.querySelector('.ui-overlay');
    if (uiOverlay) {
      if (scrollY >= trackHeight - 50) {
        uiOverlay.style.opacity = '0';
        uiOverlay.style.pointerEvents = 'none';
      } else {
        uiOverlay.style.opacity = '1';
        uiOverlay.style.pointerEvents = 'none';
      }
    }

    // Dynamic header styling on scroll
    if (siteHeader) {
      if (scrollY > 30) {
        siteHeader.classList.add('scrolled');
      } else {
        siteHeader.classList.remove('scrolled');
      }
    }

    // Hide scroll cue on initial user interaction
    if (scrollY > 60 && scrollCue && !scrollCue.classList.contains('hidden')) {
      scrollCue.classList.add('hidden');
    } else if (scrollY <= 60 && scrollCue && scrollCue.classList.contains('hidden')) {
      scrollCue.classList.remove('hidden');
    }
  }

  // Animation Loop with Inertia Lerp
  function renderLoop() {
    // Lerp smooth damping
    const diff = targetScrollProgress - currentScrollProgress;
    
    if (Math.abs(diff) > 0.0001) {
      currentScrollProgress += diff * LERP_FACTOR;
    } else {
      currentScrollProgress = targetScrollProgress;
    }

    // Calculate frame index (1 to TOTAL_FRAMES)
    const rawFrame = Math.round(currentScrollProgress * (TOTAL_FRAMES - 1)) + 1;
    const frameIndex = Math.max(1, Math.min(TOTAL_FRAMES, rawFrame));

    // Render frame
    drawFrame(frameIndex);

    // Update UI progress indicators
    const progressPercent = (currentScrollProgress * 100).toFixed(1);
    if (progressBarActive) {
      progressBarActive.style.width = `${Math.max(1, progressPercent)}%`;
    }
    if (frameCounter) {
      frameCounter.textContent = `Frame ${frameIndex} / ${TOTAL_FRAMES}`;
    }

    animationFrameId = requestAnimationFrame(renderLoop);
  }

  // Setup Modal Event Listeners
  function setupModals() {
    // Open Auth Modal
    if (authBtn && authModal) {
      authBtn.addEventListener('click', () => {
        authModal.classList.add('open');
        authModal.setAttribute('aria-hidden', 'false');
      });
    }

    // Close Auth Modal
    if (modalCloseBtn && authModal) {
      modalCloseBtn.addEventListener('click', () => {
        authModal.classList.remove('open');
        authModal.setAttribute('aria-hidden', 'true');
      });
    }

    // Backdrop click to close Auth Modal
    if (authModal) {
      authModal.addEventListener('click', (e) => {
        if (e.target === authModal) {
          authModal.classList.remove('open');
          authModal.setAttribute('aria-hidden', 'true');
        }
      });
    }

    // Tab switching (Login / Sign Up)
    if (tabLogin && tabSignup) {
      tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        modalTitle.textContent = 'Welcome to meet4lyf';
        authSubmitBtn.textContent = 'Log In';
        if (loginOptions) loginOptions.style.display = 'flex';
      });

      tabSignup.addEventListener('click', () => {
        tabSignup.classList.add('active');
        tabLogin.classList.remove('active');
        modalTitle.textContent = 'Create an Account';
        authSubmitBtn.textContent = 'Sign Up';
        if (loginOptions) loginOptions.style.display = 'none';
      });
    }

    // Info Modal Setup (About Us & Blogs)
    function openInfoModal(title, subtitle, content) {
      if (!infoModal) return;
      if (infoModalTitle) infoModalTitle.textContent = title;
      if (infoModalSub) infoModalSub.textContent = subtitle;
      if (infoModalContent) infoModalContent.innerHTML = content;
      infoModal.classList.add('open');
      infoModal.setAttribute('aria-hidden', 'false');
    }

    // navAboutBtn now navigates directly to about.html

    if (navBlogsBtn) {
      navBlogsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openInfoModal(
          'meet4lyf Stories & Blogs',
          'Insights on Romance, Compatibility & Life Partnerships',
          '<p>Explore curated articles on healthy relationships, conversation starters for your first meetup, and real wedding success stories from our couples.</p><p style="margin-top: 10px; color: var(--accent-gold);">New stories updated weekly!</p>'
        );
      });
    }

    if (infoModalClose && infoModal) {
      infoModalClose.addEventListener('click', () => {
        infoModal.classList.remove('open');
        infoModal.setAttribute('aria-hidden', 'true');
      });
    }

    if (infoModalBtn && infoModal) {
      infoModalBtn.addEventListener('click', () => {
        infoModal.classList.remove('open');
        infoModal.setAttribute('aria-hidden', 'true');
      });
    }

    if (infoModal) {
      infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) {
          infoModal.classList.remove('open');
          infoModal.setAttribute('aria-hidden', 'true');
        }
      });
    }

    // Step item interactive triggers
    const stepSignup = document.getElementById('step-signup');
    const stepMeetRm = document.getElementById('step-meet-rm');
    const stepJoinMeetups = document.getElementById('step-join-meetups');
    const stepConnectInteract = document.getElementById('step-connect-interact');
    const stepFindJodi = document.getElementById('step-find-jodi');

    if (stepSignup && authModal) {
      stepSignup.addEventListener('click', () => {
        authModal.classList.add('open');
        authModal.setAttribute('aria-hidden', 'false');
        if (tabSignup) tabSignup.click();
      });
    }

    if (stepMeetRm) {
      stepMeetRm.addEventListener('click', () => {
        openInfoModal(
          'Personalized Relationship Manager (RM)',
          'Verification & Expectations Setting',
          '<p>Every member is paired with an experienced Relationship Manager for thorough verification, background validation, and detailed understanding of your relationship values and life partner expectations.</p>'
        );
      });
    }

    if (stepJoinMeetups) {
      stepJoinMeetups.addEventListener('click', () => {
        openInfoModal(
          'Curated Marriage Cohort Meetups',
          'Courteous, Curated In-Person Gatherings',
          '<p>Skip endless superficial texting. We host private high-tea mixers, cohort dinners, and matrimonial meetups where you can meet prospective partners in a warm, respectful setting.</p>'
        );
      });
    }

    if (stepConnectInteract) {
      stepConnectInteract.addEventListener('click', () => {
        openInfoModal(
          'Connect & Interact',
          'Safe, Verified and Meaningful Dialogue',
          '<p>Express interest directly, schedule one-on-one virtual or physical introductions, and connect with 100% ID-verified matches in full confidentiality.</p>'
        );
      });
    }

    if (stepFindJodi && authModal) {
      stepFindJodi.addEventListener('click', () => {
        authModal.classList.add('open');
        authModal.setAttribute('aria-hidden', 'false');
        if (tabSignup) tabSignup.click();
      });
    }

    // ESC key closes any open modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (authModal && authModal.classList.contains('open')) {
          authModal.classList.remove('open');
          authModal.setAttribute('aria-hidden', 'true');
        }
        if (infoModal && infoModal.classList.contains('open')) {
          infoModal.classList.remove('open');
          infoModal.setAttribute('aria-hidden', 'true');
        }
      }
    });
  }

  // Setup Callback Widget
  function setupCallbackWidget() {
    const callbackCard = document.getElementById('callback-card');
    const callbackToggleBtn = document.getElementById('callback-toggle-btn');
    const callbackPillBtn = document.getElementById('callback-pill-btn');
    const callbackForm = document.getElementById('callback-form');
    const callbackName = document.getElementById('callback-name');
    const callbackPhone = document.getElementById('callback-phone');
    const callbackSubmitBtn = document.getElementById('callback-submit-btn');
    const callbackSuccess = document.getElementById('callback-success');
    const successPhoneDisplay = document.getElementById('success-phone-display');
    const callbackResetBtn = document.getElementById('callback-reset-btn');

    if (!callbackCard) return;

    // Minimize to pill button
    if (callbackToggleBtn && callbackPillBtn) {
      callbackToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbackCard.style.display = 'none';
        callbackPillBtn.style.display = 'inline-flex';
      });

      // Expand back from pill
      callbackPillBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbackPillBtn.style.display = 'none';
        callbackCard.style.display = 'block';
      });
    }

    // Handle form submission
    if (callbackForm) {
      callbackForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const phoneVal = callbackPhone ? callbackPhone.value.trim() : '';

        if (!phoneVal) return;

        if (callbackSubmitBtn) {
          callbackSubmitBtn.disabled = true;
          callbackSubmitBtn.textContent = 'Submitting...';
        }

        setTimeout(() => {
          if (callbackForm) callbackForm.style.display = 'none';
          if (callbackSuccess) callbackSuccess.style.display = 'block';
          if (successPhoneDisplay) successPhoneDisplay.textContent = phoneVal;

          if (callbackSubmitBtn) {
            callbackSubmitBtn.disabled = false;
            callbackSubmitBtn.textContent = 'Request a Call Back';
          }
        }, 500);
      });
    }

    // Reset form to send another request
    if (callbackResetBtn) {
      callbackResetBtn.addEventListener('click', () => {
        if (callbackForm) {
          callbackForm.reset();
          callbackForm.style.display = 'flex';
        }
        if (callbackSuccess) callbackSuccess.style.display = 'none';
      });
    }
  }

  // Event Listeners
  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  window.addEventListener('resize', resizeCanvas, { passive: true });

  // Keyboard navigation support (Arrow keys, PageUp/Down)
  window.addEventListener('keydown', (e) => {
    const step = 0.02;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      window.scrollBy({ top: maxScroll * step, behavior: 'smooth' });
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      window.scrollBy({ top: -maxScroll * step, behavior: 'smooth' });
    }
  });

  // Init
  function init() {
    resizeCanvas();
    updateScrollProgress();
    setupModals();
    setupCallbackWidget();
    renderLoop();
    preloadAllFrames();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
