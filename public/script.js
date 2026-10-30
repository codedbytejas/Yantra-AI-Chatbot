/**
 * Yantra AI — Autonomous Voice AI Companion
 * Vanilla JavaScript (ES6+), Gemini SSE Streaming, Autonomous Voice Synthesis,
 * Speech-to-Text, Animated Cyan Visor Eyes, Telemetry HUD, and Interruption System.
 */

(function () {
  'use strict';

  // ============================================================================
  // STORAGE KEYS & DEFAULT SETTINGS
  // ============================================================================
  const STORAGE_KEYS = {
    CHATS: 'yantra_ai_chats_v2',
    ACTIVE_CHAT_ID: 'yantra_ai_active_chat_id_v2',
    SETTINGS: 'yantra_ai_settings_v2',
    THEME: 'yantra_ai_theme_v3',
    VIEW_MODE: 'yantra_ai_view_mode_v2',
    VOICE_CONFIG: 'yantra_ai_voice_config_v2'
  };

  const DEFAULT_SETTINGS = {
    model: 'gemini-3.5-flash-lite',
    apiKey: '',
    systemInstruction:
      'You are Yantra AI, an advanced, autonomous voice AI companion and intelligence partner powered by Google Gemini. ' +
      'You have a warm, natural, intelligent, and articulate personality. ' +
      'You speak naturally and conversationally, like a real AI companion, avoiding robotic boilerplate, repetitive apologies, or disclaimers. ' +
      'For concise questions, provide direct, articulate answers. For complex questions or programming tasks, provide well-structured explanations with Markdown and clean code blocks. ' +
      'Speak engagingly and directly to the user.',
    temperature: 0.7
  };

  const DEFAULT_VOICE_CONFIG = {
    autoSpeak: true,
    handsFree: false,
    voiceURI: '',
    rate: 1.05,
    pitch: 1.0,
    volume: 1.0
  };

  // ============================================================================
  // APPLICATION STATE
  // ============================================================================
  const state = {
    chats: [],
    activeChatId: null,
    settings: { ...DEFAULT_SETTINGS },
    voiceConfig: { ...DEFAULT_VOICE_CONFIG },
    theme: 'light',
    viewMode: 'split', // 'split' | 'visor' | 'chat'
    companionState: 'idle', // 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted'
    isGenerating: false,
    abortController: null,
    serverHasKey: false,
    autoScroll: true,
    
    // Voice Output
    speechQueue: [],
    speechCurrentIndex: 0,
    isSpeaking: false,
    isPaused: false,
    speechKeepAliveTimer: null,
    availableVoices: [],

    // Voice Input (STT)
    speechRecognition: null,
    isListening: false,
    transcriptBuffer: '',
    
    // Audio Context Synthesizer
    audioCtx: null
  };

  // ============================================================================
  // DOM ELEMENT REFERENCES
  // ============================================================================
  const elements = {
    // App & Layout
    appContainer: document.querySelector('.app-container'),
    sidebar: document.getElementById('sidebar'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop'),
    toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
    closeSidebarBtn: document.getElementById('closeSidebarBtn'),
    companionWorkspace: document.getElementById('companionWorkspace'),
    companionStage: document.getElementById('companionStage'),
    chatStage: document.getElementById('chatStage'),
    viewModeBtns: document.querySelectorAll('.view-mode-btn'),

    // Top Bar
    currentChatTitle: document.getElementById('currentChatTitle'),
    renameChatBtn: document.getElementById('renameChatBtn'),
    modelSelector: document.getElementById('modelSelector'),
    companionStatePill: document.getElementById('companionStatePill'),
    companionStateLabel: document.getElementById('companionStateLabel'),
    apiKeyStatusPill: document.getElementById('apiKeyStatusPill'),
    apiPillText: document.getElementById('apiPillText'),
    exportChatBtn: document.getElementById('exportChatBtn'),
    clearChatBtn: document.getElementById('clearChatBtn'),

    // Sidebar
    newChatBtn: document.getElementById('newChatBtn'),
    searchChatsInput: document.getElementById('searchChatsInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    chatHistoryList: document.getElementById('chatHistoryList'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),
    clearAllChatsBtn: document.getElementById('clearAllChatsBtn'),

    // Avatar Visor & Eyes
    avatarVisor: document.getElementById('avatarVisor'),
    leftEye: document.getElementById('leftEye'),
    rightEye: document.getElementById('rightEye'),
    leftPupil: document.getElementById('leftPupil'),
    rightPupil: document.getElementById('rightPupil'),
    avatarWaveform: document.getElementById('avatarWaveform'),
    visorTouchPrompt: document.getElementById('visorTouchPrompt'),
    toggleAudioMuteBtn: document.getElementById('toggleAudioMuteBtn'),
    audioMuteLabel: document.getElementById('audioMuteLabel'),

    // Companion Action Bar
    voiceInputBtn: document.getElementById('voiceInputBtn'),
    voiceInputBtnLabel: document.getElementById('voiceInputBtnLabel'),
    interruptBtn: document.getElementById('interruptBtn'),
    handsFreeBtn: document.getElementById('handsFreeBtn'),
    handsFreeIndicator: document.getElementById('handsFreeIndicator'),

    // Telemetry Dashboard
    telemetryStatusBadge: document.getElementById('telemetryStatusBadge'),
    telemDisplayDot: document.getElementById('telemDisplayDot'),
    telemDisplayVal: document.getElementById('telemDisplayVal'),
    telemMicDot: document.getElementById('telemMicDot'),
    telemMicVal: document.getElementById('telemMicVal'),
    telemStateDot: document.getElementById('telemStateDot'),
    telemStateVal: document.getElementById('telemStateVal'),
    telemTtsDot: document.getElementById('telemTtsDot'),
    telemTtsVal: document.getElementById('telemTtsVal'),
    telemCoreDot: document.getElementById('telemCoreDot'),
    telemCoreVal: document.getElementById('telemCoreVal'),
    telemTurnsDot: document.getElementById('telemTurnsDot'),
    telemTurnsVal: document.getElementById('telemTurnsVal'),

    // Voice Controls
    activeVoiceNameDisplay: document.getElementById('activeVoiceNameDisplay'),
    voiceSelect: document.getElementById('voiceSelect'),
    rateSlider: document.getElementById('rateSlider'),
    rateValueDisplay: document.getElementById('rateValueDisplay'),
    pitchSlider: document.getElementById('pitchSlider'),
    pitchValueDisplay: document.getElementById('pitchValueDisplay'),

    // Chat Area
    chatScrollArea: document.getElementById('chatScrollArea'),
    welcomeScreen: document.getElementById('welcomeScreen'),
    messagesContainer: document.getElementById('messagesContainer'),
    scrollToBottomBtn: document.getElementById('scrollToBottomBtn'),

    // Voice Banners
    liveVoiceBanner: document.getElementById('liveVoiceBanner'),
    liveVoiceStatusText: document.getElementById('liveVoiceStatusText'),
    liveVoiceTranscript: document.getElementById('liveVoiceTranscript'),
    cancelVoiceInputBtn: document.getElementById('cancelVoiceInputBtn'),

    speakingPlaybackBanner: document.getElementById('speakingPlaybackBanner'),
    speakingStatusLabel: document.getElementById('speakingStatusLabel'),
    pauseResumeVoiceBtn: document.getElementById('pauseResumeVoiceBtn'),
    pauseIcon: document.getElementById('pauseIcon'),
    playIcon: document.getElementById('playIcon'),
    pauseBtnText: document.getElementById('pauseBtnText'),
    stopVoiceBtn: document.getElementById('stopVoiceBtn'),

    // Input Area
    stopGeneratingWrapper: document.getElementById('stopGeneratingWrapper'),
    stopGeneratingBtn: document.getElementById('stopGeneratingBtn'),
    inlineMicBtn: document.getElementById('inlineMicBtn'),
    chatInput: document.getElementById('chatInput'),
    sendBtn: document.getElementById('sendBtn'),
    charCount: document.getElementById('charCount'),

    // Settings Modal
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsModalBtn: document.getElementById('closeSettingsModalBtn'),
    cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    toggleApiKeyVisibilityBtn: document.getElementById('toggleApiKeyVisibilityBtn'),
    testApiKeyBtn: document.getElementById('testApiKeyBtn'),
    testKeySpinner: document.getElementById('testKeySpinner'),
    testKeyText: document.getElementById('testKeyText'),
    testKeyFeedback: document.getElementById('testKeyFeedback'),
    modalModelSelect: document.getElementById('modalModelSelect'),
    systemInstructionInput: document.getElementById('systemInstructionInput'),
    temperatureSlider: document.getElementById('temperatureSlider'),
    tempValueDisplay: document.getElementById('tempValueDisplay'),

    // Confirm Modal
    confirmModal: document.getElementById('confirmModal'),
    confirmModalTitle: document.getElementById('confirmModalTitle'),
    confirmModalMessage: document.getElementById('confirmModalMessage'),
    closeConfirmModalBtn: document.getElementById('closeConfirmModalBtn'),
    cancelConfirmBtn: document.getElementById('cancelConfirmBtn'),
    actionConfirmBtn: document.getElementById('actionConfirmBtn'),

    // Toast Container & Highlight Theme
    toastContainer: document.getElementById('toastContainer'),
    hljsThemeLink: document.getElementById('hljs-theme')
  };

  // ============================================================================
  // WEB AUDIO API FEEDBACK CHIRPS (Pure synthesized sci-fi tones)
  // ============================================================================
  function playAudioTone(type) {
    try {
      if (!state.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) state.audioCtx = new AudioContext();
      }
      if (!state.audioCtx) return;

      if (state.audioCtx.state === 'suspended') {
        state.audioCtx.resume();
      }

      const now = state.audioCtx.currentTime;
      const osc = state.audioCtx.createOscillator();
      const gain = state.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(state.audioCtx.destination);

      if (type === 'listen') {
        // Dual soft listening chirp: 520Hz -> 880Hz
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === 'interrupt') {
        // Deactivation power-down tone: 440Hz -> 180Hz
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'ready') {
        // Soft response chime: 660Hz -> 1100Hz
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(1100, now + 0.1);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.14);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch (_) {
      // AudioContext unavailable or blocked by autoplay policy
    }
  }

  // ============================================================================
  // AVATAR EYE CONTROLLER & STATE MACHINE
  // ============================================================================
  const AvatarController = {
    blinkTimeout: null,

    init() {
      this.bindMouseTracking();
      this.scheduleNextBlink();
      this.updateState('idle');
    },

    updateState(newState) {
      state.companionState = newState;

      // Update Visor Classes
      const visor = elements.avatarVisor;
      if (visor) {
        visor.classList.remove('state-idle', 'state-listening', 'state-thinking', 'state-speaking', 'state-interrupted');
        visor.classList.add(`state-${newState}`);
      }

      // Update Top Bar State Pill
      const pill = elements.companionStatePill;
      const label = elements.companionStateLabel;
      if (pill && label) {
        pill.classList.remove('state-idle', 'state-listening', 'state-thinking', 'state-speaking', 'state-interrupted');
        pill.classList.add(`state-${newState}`);
        label.textContent = newState.toUpperCase();
      }

      // Update Telemetry Values
      TelemetryMonitor.update();

      // Audio Equalizer Waveform activity
      const waveform = elements.avatarWaveform;
      if (waveform) {
        if (newState === 'speaking' || newState === 'listening') {
          waveform.style.opacity = '1';
        } else {
          waveform.style.opacity = '0.35';
        }
      }

      // Voice Input Button state
      if (elements.voiceInputBtn) {
        if (newState === 'listening') {
          elements.voiceInputBtn.classList.add('listening');
          elements.voiceInputBtnLabel.textContent = 'Listening...';
          elements.inlineMicBtn.classList.add('listening');
        } else {
          elements.voiceInputBtn.classList.remove('listening');
          elements.voiceInputBtnLabel.textContent = 'Tap to Speak';
          elements.inlineMicBtn.classList.remove('listening');
        }
      }
    },

    scheduleNextBlink() {
      // Natural randomized blinking every 3.5s to 6s
      const delay = Math.random() * 2500 + 3500;
      this.blinkTimeout = setTimeout(() => {
        if (state.companionState === 'idle' || state.companionState === 'speaking') {
          this.triggerBlink();
        }
        this.scheduleNextBlink();
      }, delay);
    },

    triggerBlink() {
      if (elements.leftEye && elements.rightEye) {
        elements.leftEye.classList.add('blinking');
        elements.rightEye.classList.add('blinking');
        setTimeout(() => {
          elements.leftEye.classList.remove('blinking');
          elements.rightEye.classList.remove('blinking');
        }, 130);
      }
    },

    bindMouseTracking() {
      // Natural gaze tracking: pupils follow the user's cursor smoothly when idle
      document.addEventListener('mousemove', (e) => {
        if (state.companionState !== 'idle' && state.companionState !== 'listening') return;
        if (!elements.avatarVisor || !elements.leftPupil || !elements.rightPupil) return;

        const rect = elements.avatarVisor.getBoundingClientRect();
        const visorCenterX = rect.left + rect.width / 2;
        const visorCenterY = rect.top + rect.height / 2;

        const deltaX = (e.clientX - visorCenterX) / (window.innerWidth / 2);
        const deltaY = (e.clientY - visorCenterY) / (window.innerHeight / 2);

        // Clamped pupil translation offset (-14px to +14px)
        const moveX = Math.max(-14, Math.min(14, deltaX * 16));
        const moveY = Math.max(-10, Math.min(10, deltaY * 12));

        elements.leftPupil.style.transform = `translate(${moveX}px, ${moveY}px)`;
        elements.rightPupil.style.transform = `translate(${moveX}px, ${moveY}px)`;
      });

      // Reset gaze when mouse leaves document
      document.addEventListener('mouseleave', () => {
        if (elements.leftPupil && elements.rightPupil) {
          elements.leftPupil.style.transform = 'translate(0px, 0px)';
          elements.rightPupil.style.transform = 'translate(0px, 0px)';
        }
      });
    }
  };

  // ============================================================================
  // VOICE OUTPUT ENGINE (AUTONOMOUS SPEECH SYNTHESIS)
  // ============================================================================
  const VoiceEngine = {
    init() {
      this.loadVoices();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    },

    loadVoices() {
      if (!('speechSynthesis' in window)) return;
      state.availableVoices = window.speechSynthesis.getVoices() || [];

      if (!elements.voiceSelect) return;
      elements.voiceSelect.innerHTML = '';

      if (state.availableVoices.length === 0) {
        elements.voiceSelect.innerHTML = '<option value="">Default System Voice</option>';
        return;
      }

      // Prioritize English and high-quality natural voices
      const sortedVoices = [...state.availableVoices].sort((a, b) => {
        const aIsEn = a.lang.startsWith('en');
        const bIsEn = b.lang.startsWith('en');
        if (aIsEn && !bIsEn) return -1;
        if (!aIsEn && bIsEn) return 1;
        return a.name.localeCompare(b.name);
      });

      let selectedVoiceIndex = 0;
      sortedVoices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = voice.voiceURI;
        option.textContent = `${voice.name} (${voice.lang})`;
        
        // Auto-select preferred natural English voice
        if (state.voiceConfig.voiceURI && voice.voiceURI === state.voiceConfig.voiceURI) {
          selectedVoiceIndex = index;
          option.selected = true;
        } else if (!state.voiceConfig.voiceURI && (
          voice.name.includes('Natural') || 
          voice.name.includes('Google US English') || 
          voice.name.includes('Samantha') || 
          voice.name.includes('Daniel')
        )) {
          selectedVoiceIndex = index;
          option.selected = true;
          state.voiceConfig.voiceURI = voice.voiceURI;
        }

        elements.voiceSelect.appendChild(option);
      });

      const activeVoice = sortedVoices[selectedVoiceIndex];
      if (activeVoice && elements.activeVoiceNameDisplay) {
        elements.activeVoiceNameDisplay.textContent = activeVoice.name.split(' ')[0] || 'Default';
      }
    },

    getSelectedVoice() {
      if (!('speechSynthesis' in window) || state.availableVoices.length === 0) return null;
      if (state.voiceConfig.voiceURI) {
        const match = state.availableVoices.find(v => v.voiceURI === state.voiceConfig.voiceURI);
        if (match) return match;
      }
      return state.availableVoices.find(v => v.lang.startsWith('en')) || state.availableVoices[0];
    },

    /**
     * Splits response text into clean, natural sentences.
     * Replaces code blocks with a natural spoken prompt so code is read clearly.
     */
    prepareSentences(markdownText) {
      if (!markdownText) return [];

      let clean = markdownText
        // Replace code block with natural spoken indicator
        .replace(/```[a-zA-Z]*\n([\s\S]*?)```/g, ' Here is the code snippet. ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[#*_~>]/g, '')
        .replace(/\|.*?\|/g, '')
        .replace(/\n{2,}/g, '. ');

      // Split by sentence terminators
      const rawSentences = clean.split(/(?<=[.?!;:\n])\s+/).map(s => s.trim()).filter(s => s.length > 0);
      const chunks = [];

      for (const sentence of rawSentences) {
        // If a single sentence exceeds 180 characters, split by commas or clauses
        if (sentence.length > 180) {
          const subParts = sentence.split(/(?<=[,])\s+/);
          for (const sub of subParts) {
            if (sub.trim().length > 0) chunks.push(sub.trim());
          }
        } else {
          chunks.push(sentence);
        }
      }

      return chunks.length > 0 ? chunks : [clean];
    },

    /**
     * Speak response automatically.
     */
    speakResponse(text) {
      if (!state.voiceConfig.autoSpeak) return;
      if (!('speechSynthesis' in window)) return;

      this.stop(); // Stop any previous speech immediately

      const sentences = this.prepareSentences(text);
      if (sentences.length === 0) return;

      state.speechQueue = sentences;
      state.speechCurrentIndex = 0;
      state.isSpeaking = true;
      state.isPaused = false;

      AvatarController.updateState('speaking');
      this.showPlaybackBanner(true);
      this.startKeepAlive();
      this.playNextSentence();
    },

    playNextSentence() {
      if (!state.isSpeaking || state.isPaused) return;

      if (state.speechCurrentIndex >= state.speechQueue.length) {
        // Complete speech finished cleanly
        this.finishSpeech();
        return;
      }

      const sentence = state.speechQueue[state.speechCurrentIndex];
      const utterance = new SpeechSynthesisUtterance(sentence);
      
      const voice = this.getSelectedVoice();
      if (voice) utterance.voice = voice;
      
      utterance.rate = state.voiceConfig.rate || 1.05;
      utterance.pitch = state.voiceConfig.pitch || 1.0;
      utterance.volume = state.voiceConfig.volume || 1.0;

      utterance.onend = () => {
        state.speechCurrentIndex++;
        this.playNextSentence();
      };

      utterance.onerror = (e) => {
        console.warn('Speech synthesis utterance error:', e);
        state.speechCurrentIndex++;
        this.playNextSentence();
      };

      window.speechSynthesis.speak(utterance);
    },

    pause() {
      if (!state.isSpeaking || state.isPaused) return;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.pause();
      }
      state.isPaused = true;
      AvatarController.updateState('idle');
      this.updatePlaybackControlsUI(true);
    },

    resume() {
      if (!state.isSpeaking || !state.isPaused) return;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.resume();
      }
      state.isPaused = false;
      AvatarController.updateState('speaking');
      this.updatePlaybackControlsUI(false);
    },

    stop() {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      this.stopKeepAlive();
      state.isSpeaking = false;
      state.isPaused = false;
      state.speechQueue = [];
      state.speechCurrentIndex = 0;

      this.showPlaybackBanner(false);
      AvatarController.updateState('idle');
    },

    finishSpeech() {
      this.stop();
      playAudioTone('ready');

      // Hands-Free Continuous Mode: automatically start listening for follow-up!
      if (state.voiceConfig.handsFree && !state.isGenerating) {
        setTimeout(() => {
          if (!state.isSpeaking && !state.isGenerating) {
            VoiceInput.startListening();
          }
        }, 600);
      }
    },

    startKeepAlive() {
      // Standard Chromium fix for keeping long speech alive
      this.stopKeepAlive();
      state.speechKeepAliveTimer = setInterval(() => {
        if (state.isSpeaking && !state.isPaused && 'speechSynthesis' in window) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 7000);
    },

    stopKeepAlive() {
      if (state.speechKeepAliveTimer) {
        clearInterval(state.speechKeepAliveTimer);
        state.speechKeepAliveTimer = null;
      }
    },

    showPlaybackBanner(show) {
      if (!elements.speakingPlaybackBanner) return;
      if (show) {
        elements.speakingPlaybackBanner.classList.remove('hidden');
        this.updatePlaybackControlsUI(false);
      } else {
        elements.speakingPlaybackBanner.classList.add('hidden');
      }
    },

    updatePlaybackControlsUI(isPaused) {
      if (!elements.pauseIcon || !elements.playIcon || !elements.pauseBtnText) return;
      if (isPaused) {
        elements.pauseIcon.classList.add('hidden');
        elements.playIcon.classList.remove('hidden');
        elements.pauseBtnText.textContent = 'Resume';
        elements.speakingStatusLabel.textContent = 'Voice output paused';
      } else {
        elements.pauseIcon.classList.remove('hidden');
        elements.playIcon.classList.add('hidden');
        elements.pauseBtnText.textContent = 'Pause';
        elements.speakingStatusLabel.textContent = 'Yantra AI is speaking...';
      }
    }
  };

  // ============================================================================
  // VOICE INPUT ENGINE (SPEECH-TO-TEXT / WEBKIT SPEECH RECOGNITION)
  // ============================================================================
  const VoiceInput = {
    init() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.warn('SpeechRecognition API is not supported in this browser environment.');
        return;
      }

      state.speechRecognition = new SpeechRecognition();
      state.speechRecognition.continuous = false;
      state.speechRecognition.interimResults = true;
      state.speechRecognition.lang = 'en-US';

      state.speechRecognition.onstart = () => {
        state.isListening = true;
        state.transcriptBuffer = '';
        AvatarController.updateState('listening');
        playAudioTone('listen');
        this.showLiveBanner(true, 'Listening... Speak your query aloud.');
      };

      state.speechRecognition.onresult = (event) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript;
          } else {
            interimText += event.results[i][0].transcript;
          }
        }

        const currentText = (finalText || interimText).trim();
        if (currentText) {
          state.transcriptBuffer = currentText;
          if (elements.liveVoiceTranscript) {
            elements.liveVoiceTranscript.textContent = `"${currentText}"`;
          }
        }
      };

      state.speechRecognition.onerror = (event) => {
        console.warn('Speech recognition event error:', event.error);
        if (event.error === 'not-allowed') {
          showToast('Microphone access denied. Please grant permission in browser settings.', 'error');
        } else if (event.error !== 'no-speech') {
          showToast(`Voice input error: ${event.error}`, 'error');
        }
        this.stopListening(false);
      };

      state.speechRecognition.onend = () => {
        const textToSend = state.transcriptBuffer.trim();
        this.stopListening(false);

        if (textToSend.length > 0) {
          sendMessage(textToSend);
        } else if (state.companionState === 'listening') {
          AvatarController.updateState('idle');
        }
      };
    },

    startListening() {
      // If AI is currently speaking, interrupt it first
      if (state.isSpeaking) {
        InterruptionManager.triggerInterrupt();
      }

      if (!state.speechRecognition) {
        showToast('Voice speech recognition is not supported in this browser.', 'error');
        return;
      }

      try {
        state.speechRecognition.start();
      } catch (err) {
        // Recognition already started or busy
        try {
          state.speechRecognition.stop();
          setTimeout(() => state.speechRecognition.start(), 150);
        } catch (_) {}
      }
    },

    stopListening(send = true) {
      state.isListening = false;
      this.showLiveBanner(false);

      if (state.speechRecognition) {
        try { state.speechRecognition.stop(); } catch (_) {}
      }

      if (!send) {
        state.transcriptBuffer = '';
      }
    },

    showLiveBanner(show, initialText = '') {
      if (!elements.liveVoiceBanner) return;
      if (show) {
        elements.liveVoiceBanner.classList.remove('hidden');
        if (elements.liveVoiceTranscript) {
          elements.liveVoiceTranscript.textContent = initialText || 'Listening for speech...';
        }
      } else {
        elements.liveVoiceBanner.classList.add('hidden');
      }
    }
  };

  // ============================================================================
  // INTERRUPTION SYSTEM (HALT SPEECH & STREAM IMMEDIATELY)
  // ============================================================================
  const InterruptionManager = {
    triggerInterrupt() {
      const wasActive = state.isSpeaking || state.isGenerating || state.isListening;
      if (!wasActive) return;

      // 1. Immediately halt Speech Synthesis
      VoiceEngine.stop();

      // 2. Immediately cancel Voice Input if recording
      VoiceInput.stopListening(false);

      // 3. Immediately abort active Gemini SSE generation
      if (state.abortController) {
        state.abortController.abort();
        state.abortController = null;
      }

      state.isGenerating = false;
      updateGeneratingUI(false);

      // 4. Trigger red flash glitch state on avatar visor
      AvatarController.updateState('interrupted');
      playAudioTone('interrupt');
      showToast('AI Interrupted', 'info', 1500);

      // 5. Smooth return to ready/idle after 350ms
      setTimeout(() => {
        if (state.companionState === 'interrupted') {
          AvatarController.updateState('idle');
        }
      }, 350);
    }
  };

  // ============================================================================
  // REAL-TIME TELEMETRY MONITOR
  // ============================================================================
  const TelemetryMonitor = {
    init() {
      this.checkMicPermission();
      this.update();
      window.addEventListener('online', () => this.update());
      window.addEventListener('offline', () => this.update());
    },

    async checkMicPermission() {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const status = await navigator.permissions.query({ name: 'microphone' });
          this.applyMicPermission(status.state);
          status.onchange = () => this.applyMicPermission(status.state);
        } catch (_) {
          this.applyMicPermission('available');
        }
      } else {
        this.applyMicPermission('available');
      }
    },

    applyMicPermission(stateStr) {
      if (!elements.telemMicVal || !elements.telemMicDot) return;
      if (stateStr === 'granted') {
        elements.telemMicVal.textContent = 'GRANTED (ONLINE)';
        elements.telemMicDot.className = 'telemetry-dot dot-green';
      } else if (stateStr === 'denied') {
        elements.telemMicVal.textContent = 'DENIED (MUTED)';
        elements.telemMicDot.className = 'telemetry-dot dot-red';
      } else {
        elements.telemMicVal.textContent = 'READY (TAP TO TALK)';
        elements.telemMicDot.className = 'telemetry-dot dot-cyan';
      }
    },

    update() {
      // 1. Subsystem Online/Offline
      const isOnline = navigator.onLine;
      if (elements.telemDisplayVal && elements.telemDisplayDot) {
        elements.telemDisplayVal.textContent = isOnline ? 'ONLINE (HTTP/2 SSE)' : 'OFFLINE';
        elements.telemDisplayDot.className = isOnline ? 'telemetry-dot dot-green' : 'telemetry-dot dot-red';
      }

      // 2. AI State
      if (elements.telemStateVal && elements.telemStateDot) {
        elements.telemStateVal.textContent = state.companionState.toUpperCase();
        if (state.companionState === 'listening') elements.telemStateDot.className = 'telemetry-dot dot-green';
        else if (state.companionState === 'thinking') elements.telemStateDot.className = 'telemetry-dot dot-yellow';
        else if (state.companionState === 'speaking') elements.telemStateDot.className = 'telemetry-dot dot-cyan';
        else if (state.companionState === 'interrupted') elements.telemStateDot.className = 'telemetry-dot dot-red';
        else elements.telemStateDot.className = 'telemetry-dot dot-cyan';
      }

      // 3. Speech Synthesizer Status
      if (elements.telemTtsVal && elements.telemTtsDot) {
        if (!state.voiceConfig.autoSpeak) {
          elements.telemTtsVal.textContent = 'MUTED (OFF)';
          elements.telemTtsDot.className = 'telemetry-dot dot-idle';
        } else if (state.isSpeaking) {
          elements.telemTtsVal.textContent = 'SPEAKING (ACTIVE)';
          elements.telemTtsDot.className = 'telemetry-dot dot-cyan';
        } else if (state.isPaused) {
          elements.telemTtsVal.textContent = 'PAUSED';
          elements.telemTtsDot.className = 'telemetry-dot dot-yellow';
        } else {
          elements.telemTtsVal.textContent = 'READY (AUTO-VOICE)';
          elements.telemTtsDot.className = 'telemetry-dot dot-green';
        }
      }

      // 4. Gemini Model Core
      if (elements.telemCoreVal) {
        elements.telemCoreVal.textContent = state.settings.model || 'gemini-3.5-flash-lite';
      }

      // 5. Session Turns
      const activeChat = getActiveChat();
      if (elements.telemTurnsVal) {
        const turnCount = activeChat && activeChat.messages ? activeChat.messages.length : 0;
        elements.telemTurnsVal.textContent = `${turnCount} TURNS`;
      }
    }
  };

  // ============================================================================
  // MARKDOWN CONFIGURATION (Marked.js + Highlight.js + DOMPurify)
  // ============================================================================
  function setupMarkdown() {
    if (typeof marked !== 'undefined') {
      const renderer = new marked.Renderer();

      renderer.code = function (codeObj) {
        const text = (typeof codeObj === 'object' && codeObj !== null) ? (codeObj.text || '') : arguments[0] || '';
        const lang = ((typeof codeObj === 'object' && codeObj !== null) ? codeObj.lang : arguments[1]) || '';

        const validLang = lang && typeof hljs !== 'undefined' && hljs.getLanguage(lang) ? lang : '';
        let highlighted = '';

        if (validLang && typeof hljs !== 'undefined') {
          try {
            highlighted = hljs.highlight(text, { language: validLang }).value;
          } catch (_) {
            highlighted = escapeHtml(text);
          }
        } else if (typeof hljs !== 'undefined') {
          try {
            highlighted = hljs.highlightAuto(text).value;
          } catch (_) {
            highlighted = escapeHtml(text);
          }
        } else {
          highlighted = escapeHtml(text);
        }

        const displayLang = (lang || 'code').toUpperCase();
        const codeId = 'code-' + Math.random().toString(36).substring(2, 9);

        return `
          <div class="code-block-wrapper">
            <div class="code-block-header">
              <span class="code-lang-label">${displayLang}</span>
              <button class="copy-code-btn" data-code-id="${codeId}" title="Copy code snippet">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Copy</span>
              </button>
            </div>
            <pre><code id="${codeId}" class="hljs ${validLang}">${highlighted}</code></pre>
          </div>
        `;
      };

      renderer.link = function (linkObj) {
        const href = (typeof linkObj === 'object' && linkObj !== null) ? linkObj.href : arguments[0];
        const title = (typeof linkObj === 'object' && linkObj !== null) ? linkObj.title : arguments[1];
        const text = (typeof linkObj === 'object' && linkObj !== null) ? linkObj.text : arguments[2];
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
      };

      marked.setOptions({ renderer, gfm: true, breaks: true });
    }
  }

  function renderMarkdown(rawText) {
    if (!rawText) return '';
    try {
      if (typeof marked !== 'undefined') {
        const parsed = marked.parse(rawText);
        if (typeof DOMPurify !== 'undefined') {
          return DOMPurify.sanitize(parsed, {
            ADD_ATTR: ['target', 'data-code-id'],
            ADD_TAGS: ['button']
          });
        }
        return parsed;
      }
    } catch (e) {
      console.error('Markdown parse error:', e);
    }
    return escapeHtml(rawText).replace(/\n/g, '<br>');
  }

  function escapeHtml(string) {
    if (typeof string !== 'string') return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return string.replace(/[&<>"']/g, m => map[m]);
  }

  // ============================================================================
  // LOCAL STORAGE & PERSISTENCE
  // ============================================================================
  function loadPersistedData() {
    // Theme (Default white/light)
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    applyTheme(savedTheme);

    // View Mode ('split' | 'visor' | 'chat')
    const savedMode = localStorage.getItem(STORAGE_KEYS.VIEW_MODE) || 'split';
    applyViewMode(savedMode);

    // Voice Config
    try {
      const savedVoice = localStorage.getItem(STORAGE_KEYS.VOICE_CONFIG);
      if (savedVoice) {
        state.voiceConfig = { ...DEFAULT_VOICE_CONFIG, ...JSON.parse(savedVoice) };
      }
    } catch (_) {}

    applyVoiceConfigUI();

    // Settings
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (savedSettings) {
        state.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
      }
    } catch (_) {}

    // Auto-migrate legacy models
    const legacyModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    if (legacyModels.includes(state.settings.model)) {
      state.settings.model = 'gemini-3.5-flash-lite';
      saveSettings();
    }

    if (elements.modelSelector) elements.modelSelector.value = state.settings.model;
    if (elements.modalModelSelect) elements.modalModelSelect.value = state.settings.model;
    if (elements.apiKeyInput) elements.apiKeyInput.value = state.settings.apiKey;
    if (elements.systemInstructionInput) elements.systemInstructionInput.value = state.settings.systemInstruction;
    if (elements.temperatureSlider) elements.temperatureSlider.value = state.settings.temperature;
    if (elements.tempValueDisplay) elements.tempValueDisplay.textContent = state.settings.temperature;

    // Chats
    try {
      const savedChats = localStorage.getItem(STORAGE_KEYS.CHATS);
      if (savedChats) {
        state.chats = JSON.parse(savedChats);
        state.chats.forEach(c => {
          if (c && legacyModels.includes(c.model)) {
            c.model = 'gemini-3.5-flash-lite';
          }
        });
      }
    } catch (_) {
      state.chats = [];
    }

    const savedActiveId = localStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT_ID);
    if (savedActiveId && state.chats.some(c => c.id === savedActiveId)) {
      state.activeChatId = savedActiveId;
    } else if (state.chats.length > 0) {
      state.activeChatId = state.chats[0].id;
    } else {
      createNewChat(false);
    }
  }

  function saveChats() {
    try {
      localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(state.chats));
      if (state.activeChatId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT_ID, state.activeChatId);
      }
      TelemetryMonitor.update();
    } catch (_) {}
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
    } catch (_) {}
  }

  function saveVoiceConfig() {
    try {
      localStorage.setItem(STORAGE_KEYS.VOICE_CONFIG, JSON.stringify(state.voiceConfig));
    } catch (_) {}
  }

  // ============================================================================
  // THEME & VIEW MODE MANAGEMENT
  // ============================================================================
  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEYS.THEME, theme);

    if (elements.hljsThemeLink) {
      elements.hljsThemeLink.href = theme === 'dark' 
        ? 'vendor/highlight-dark.min.css' 
        : 'vendor/highlight-light.min.css';
    }

    const darkIcon = document.querySelector('.theme-icon-dark');
    const lightIcon = document.querySelector('.theme-icon-light');
    if (darkIcon && lightIcon) {
      if (theme === 'dark') {
        darkIcon.classList.remove('hidden');
        lightIcon.classList.add('hidden');
      } else {
        darkIcon.classList.add('hidden');
        lightIcon.classList.remove('hidden');
      }
    }
  }

  function toggleTheme() {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    showToast(`Switched to ${nextTheme} mode`, 'info');
  }

  function applyViewMode(mode) {
    state.viewMode = mode;
    localStorage.setItem(STORAGE_KEYS.VIEW_MODE, mode);

    if (elements.companionWorkspace) {
      elements.companionWorkspace.className = `companion-workspace layout-${mode}`;
    }

    elements.viewModeBtns.forEach(btn => {
      const btnMode = btn.getAttribute('data-mode');
      btn.classList.toggle('active', btnMode === mode);
    });
  }

  function applyVoiceConfigUI() {
    // Auto-Speak Mute button
    if (elements.audioMuteLabel && elements.toggleAudioMuteBtn) {
      if (state.voiceConfig.autoSpeak) {
        elements.audioMuteLabel.textContent = 'Voice ON';
        elements.toggleAudioMuteBtn.classList.remove('muted');
      } else {
        elements.audioMuteLabel.textContent = 'Muted';
        elements.toggleAudioMuteBtn.classList.add('muted');
      }
    }

    // Hands-Free Toggle
    if (elements.handsFreeBtn && elements.handsFreeIndicator) {
      elements.handsFreeBtn.classList.toggle('active', state.voiceConfig.handsFree);
      elements.handsFreeIndicator.textContent = state.voiceConfig.handsFree ? 'ON' : 'OFF';
    }

    // Sliders
    if (elements.rateSlider) elements.rateSlider.value = state.voiceConfig.rate;
    if (elements.rateValueDisplay) elements.rateValueDisplay.textContent = `${state.voiceConfig.rate}x`;
    if (elements.pitchSlider) elements.pitchSlider.value = state.voiceConfig.pitch;
    if (elements.pitchValueDisplay) elements.pitchValueDisplay.textContent = `${state.voiceConfig.pitch}x`;
  }

  // ============================================================================
  // TOAST NOTIFICATIONS
  // ============================================================================
  function showToast(message, type = 'info', duration = 3000) {
    if (!elements.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    } else {
      iconSvg = '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  // ============================================================================
  // SERVER CONFIG & HEALTH
  // ============================================================================
  async function checkServerHealth() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Health check error');
      const data = await res.json();
      state.serverHasKey = Boolean(data.hasApiKey);
      updateApiStatusUI(true);
    } catch (_) {
      updateApiStatusUI(false);
    }
  }

  function updateApiStatusUI(isReachable = true) {
    const hasCustomKey = Boolean(state.settings.apiKey && state.settings.apiKey.trim().length > 0);
    const hasValidKey = hasCustomKey || state.serverHasKey;

    if (!isReachable) {
      elements.statusDot.className = 'status-dot status-error';
      elements.statusText.textContent = 'Server Offline';
      elements.apiKeyStatusPill.className = 'api-pill error';
      elements.apiPillText.textContent = 'Offline';
      return;
    }

    if (hasValidKey) {
      elements.statusDot.className = 'status-dot status-ready';
      elements.statusText.textContent = hasCustomKey ? 'API Key (Custom)' : 'API Key (Active)';
      elements.apiKeyStatusPill.className = 'api-pill ready';
      elements.apiPillText.textContent = 'API Ready';
    } else {
      elements.statusDot.className = 'status-dot status-warning';
      elements.statusText.textContent = 'API Key Needed';
      elements.apiKeyStatusPill.className = 'api-pill warning';
      elements.apiPillText.textContent = 'Key Needed';
    }
  }

  // ============================================================================
  // CHAT SESSIONS & CONVERSATION MANAGEMENT
  // ============================================================================
  function getActiveChat() {
    return state.chats.find(c => c.id === state.activeChatId);
  }

  function createNewChat(switchToIt = true) {
    const newChat = {
      id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: 'New Chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model: state.settings.model,
      messages: []
    };

    state.chats.unshift(newChat);
    saveChats();

    if (switchToIt) {
      setActiveChat(newChat.id);
      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    }
    renderSidebarHistory();
    return newChat;
  }

  function setActiveChat(chatId) {
    if (state.isGenerating || state.isSpeaking) {
      InterruptionManager.triggerInterrupt();
    }

    state.activeChatId = chatId;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT_ID, chatId);

    const activeChat = getActiveChat();
    if (activeChat) {
      elements.currentChatTitle.textContent = activeChat.title || 'New Chat';
      if (elements.modelSelector) {
        elements.modelSelector.value = activeChat.model || state.settings.model;
      }
    }

    renderSidebarHistory();
    renderActiveChatMessages();
    focusChatInput();
    TelemetryMonitor.update();
  }

  function renameChat(chatId) {
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;

    const currentTitle = chat.title || 'New Chat';
    const newTitle = prompt('Enter a new title for this conversation:', currentTitle);

    if (newTitle !== null && newTitle.trim().length > 0) {
      chat.title = newTitle.trim();
      chat.updatedAt = new Date().toISOString();
      saveChats();
      renderSidebarHistory();
      if (state.activeChatId === chatId) {
        elements.currentChatTitle.textContent = chat.title;
      }
      showToast('Conversation renamed', 'success');
    }
  }

  function deleteChat(chatId) {
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;

    openConfirmModal(
      'Delete Conversation',
      `Are you sure you want to delete "${chat.title}"?`,
      () => {
        state.chats = state.chats.filter(c => c.id !== chatId);
        if (state.activeChatId === chatId) {
          state.activeChatId = state.chats.length > 0 ? state.chats[0].id : null;
          if (!state.activeChatId) {
            createNewChat(true);
          } else {
            setActiveChat(state.activeChatId);
          }
        }
        saveChats();
        renderSidebarHistory();
        showToast('Conversation deleted', 'info');
      }
    );
  }

  function clearActiveChat() {
    const activeChat = getActiveChat();
    if (!activeChat || activeChat.messages.length === 0) return;

    openConfirmModal(
      'Clear Conversation',
      'Clear all messages in this conversation?',
      () => {
        if (state.isGenerating || state.isSpeaking) {
          InterruptionManager.triggerInterrupt();
        }
        activeChat.messages = [];
        activeChat.title = 'New Chat';
        activeChat.updatedAt = new Date().toISOString();
        elements.currentChatTitle.textContent = 'New Chat';
        saveChats();
        renderSidebarHistory();
        renderActiveChatMessages();
        showToast('Chat cleared', 'info');
      }
    );
  }

  function clearAllChats() {
    if (state.chats.length === 0) return;

    openConfirmModal(
      'Clear All Conversations',
      'Are you sure you want to delete all saved conversations?',
      () => {
        if (state.isGenerating || state.isSpeaking) {
          InterruptionManager.triggerInterrupt();
        }
        state.chats = [];
        saveChats();
        createNewChat(true);
        showToast('All conversations cleared', 'info');
      }
    );
  }

  // ============================================================================
  // SIDEBAR RENDERING
  // ============================================================================
  function renderSidebarHistory() {
    if (!elements.chatHistoryList) return;

    const searchTerm = (elements.searchChatsInput ? elements.searchChatsInput.value : '').toLowerCase().trim();
    const filteredChats = state.chats.filter(chat => {
      if (!searchTerm) return true;
      const titleMatch = (chat.title || '').toLowerCase().includes(searchTerm);
      const msgMatch = (chat.messages || []).some(m => (m.content || '').toLowerCase().includes(searchTerm));
      return titleMatch || msgMatch;
    });

    if (filteredChats.length === 0) {
      elements.chatHistoryList.innerHTML = `
        <div class="empty-history-notice">
          ${searchTerm ? 'No matching conversations' : 'No conversations yet.<br>Click "+ New Chat" to begin.'}
        </div>
      `;
      return;
    }

    elements.chatHistoryList.innerHTML = filteredChats.map(chat => {
      const isActive = chat.id === state.activeChatId;
      const title = escapeHtml(chat.title || 'New Chat');

      return `
        <div class="chat-history-item ${isActive ? 'active' : ''}" data-chat-id="${chat.id}">
          <div class="chat-item-main">
            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span class="chat-item-title">${title}</span>
          </div>
          <div class="chat-item-actions">
            <button class="item-action-btn edit" data-action="rename" data-chat-id="${chat.id}" title="Rename conversation">
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="item-action-btn delete" data-action="delete" data-chat-id="${chat.id}" title="Delete conversation">
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ============================================================================
  // MESSAGES RENDERING
  // ============================================================================
  function renderActiveChatMessages() {
    const activeChat = getActiveChat();

    if (!activeChat || !activeChat.messages || activeChat.messages.length === 0) {
      elements.welcomeScreen.classList.remove('hidden');
      elements.messagesContainer.classList.add('hidden');
      elements.messagesContainer.innerHTML = '';
      return;
    }

    elements.welcomeScreen.classList.add('hidden');
    elements.messagesContainer.classList.remove('hidden');

    elements.messagesContainer.innerHTML = activeChat.messages.map((msg, index) => {
      return renderMessageRowHtml(msg, index);
    }).join('');

    bindCopyCodeButtons();
    scrollToBottom();
  }

  function renderMessageRowHtml(msg, index) {
    const isUser = msg.role === 'user';
    const timeFormatted = formatTimestamp(msg.timestamp || new Date().toISOString());

    if (isUser) {
      return `
        <div class="message-row user" id="msg-row-${index}">
          <div class="avatar user-avatar" title="You">
            <svg viewBox="0 0 24 24" width="17" height="17" stroke="currentColor" stroke-width="2.2" fill="none">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div class="message-bubble-wrapper">
            <div class="message-header-info">
              <span class="message-sender">You</span>
              <span class="message-time">${timeFormatted}</span>
            </div>
            <div class="message-bubble">
              <div class="message-text">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
            </div>
          </div>
        </div>
      `;
    }

    // AI Message
    const renderedBody = renderMarkdown(msg.content);
    const isError = Boolean(msg.isError);

    return `
      <div class="message-row model" id="msg-row-${index}">
        <div class="avatar ai-avatar" title="Yantra AI">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none">
            <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="currentColor"/>
          </svg>
        </div>
        <div class="message-bubble-wrapper">
          <div class="message-header-info">
            <span class="message-sender">Yantra AI</span>
            <span class="message-time">${timeFormatted}</span>
          </div>
          <div class="message-bubble">
            ${isError ? `
              <div class="message-error-card">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <div>
                  <strong>Error generating response:</strong>
                  <div>${escapeHtml(msg.content)}</div>
                  <div class="message-actions" style="margin-top: 8px;">
                    <button class="action-pill-btn" onclick="document.getElementById('openSettingsBtn').click()">
                      Configure Key
                    </button>
                    <button class="action-pill-btn" data-action="regenerate" data-msg-index="${index}">
                      Retry
                    </button>
                  </div>
                </div>
              </div>
            ` : `
              <div class="markdown-body" id="msg-body-${index}">
                ${renderedBody}
              </div>
            `}
          </div>

          ${!isError && typeof msg.content === 'string' && msg.content.trim().length > 0 ? `
            <div class="message-actions">
              <button class="action-pill-btn" data-action="speak-msg" data-msg-index="${index}" title="Speak response aloud">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
                <span>Speak</span>
              </button>

              <button class="action-pill-btn" data-action="copy-msg" data-msg-index="${index}" title="Copy full response">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Copy</span>
              </button>

              <button class="action-pill-btn" data-action="regenerate" data-msg-index="${index}" title="Regenerate this response">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                <span>Regenerate</span>
              </button>
            </div>
          ` : ''}

        </div>
      </div>
    `;
  }

  function formatTimestamp(isoString) {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  }

  // ============================================================================
  // SEND MESSAGE & STREAMING ENGINE (WITH AUTONOMOUS VOICE TRIGGER)
  // ============================================================================
  async function sendMessage(promptOverride = null) {
    if (state.isGenerating) return;

    // Interrupt any ongoing speech
    if (state.isSpeaking) {
      VoiceEngine.stop();
    }

    const text = promptOverride !== null 
      ? String(promptOverride).trim() 
      : elements.chatInput.value.trim();

    if (!text) return;

    let activeChat = getActiveChat();
    if (!activeChat) {
      activeChat = createNewChat(true);
    }

    // Auto-title conversation on first message
    if (activeChat.messages.length === 0) {
      const cleanTitle = text.replace(/[\n\r]+/g, ' ').substring(0, 34);
      activeChat.title = cleanTitle.length === 34 ? cleanTitle + '...' : cleanTitle;
      elements.currentChatTitle.textContent = activeChat.title;
    }

    // Add User Message
    const userMsg = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    activeChat.messages.push(userMsg);
    activeChat.updatedAt = new Date().toISOString();

    // Clear input
    if (promptOverride === null) {
      elements.chatInput.value = '';
      autoResizeTextarea();
      updateCharCount();
    }

    // Placeholder for AI response
    const aiMsg = {
      role: 'model',
      content: '',
      timestamp: new Date().toISOString()
    };
    activeChat.messages.push(aiMsg);
    const aiMsgIndex = activeChat.messages.length - 1;

    saveChats();
    renderSidebarHistory();
    renderActiveChatMessages();

    // Start Streaming
    await streamAiResponse(activeChat, aiMsgIndex);
  }

  async function streamAiResponse(chat, aiMsgIndex) {
    state.isGenerating = true;
    updateGeneratingUI(true);
    AvatarController.updateState('thinking');

    const msgBody = document.getElementById(`msg-body-${aiMsgIndex}`);
    if (msgBody) {
      msgBody.innerHTML = '<span class="streaming-cursor"></span>';
    }

    state.abortController = new AbortController();
    let accumulatedText = '';

    const contextMessages = chat.messages.slice(0, aiMsgIndex).map(m => ({
      role: m.role,
      content: m.content
    }));

    const selectedModel = elements.modelSelector ? elements.modelSelector.value : state.settings.model;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (state.settings.apiKey && state.settings.apiKey.trim().length > 0) {
        headers['x-gemini-api-key'] = state.settings.apiKey.trim();
      }

      const payload = {
        messages: contextMessages,
        model: selectedModel,
        systemInstruction: state.settings.systemInstruction,
        temperature: Number(state.settings.temperature)
      };

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: state.abortController.signal
      });

      if (!response.ok) {
        let errDetails = `Server error (${response.status})`;
        try {
          const errData = await response.json();
          if (errData && (errData.error || errData.message)) {
            errDetails = errData.error || errData.message;
          }
        } catch (_) {}
        throw new Error(errDetails);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let streamHasEnded = false;

      while (!streamHasEnded) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.replace(/^data:\s*/, '').trim();
          if (!jsonStr) continue;

          let data;
          try {
            data = JSON.parse(jsonStr);
          } catch (jsonErr) {
            console.warn('SSE Chunk JSON parse warning:', jsonErr);
            continue;
          }

          if (data.error) {
            throw new Error(data.error);
          }

          if (data.text) {
            accumulatedText += data.text;
            chat.messages[aiMsgIndex].content = accumulatedText;

            if (msgBody) {
              msgBody.innerHTML = renderMarkdown(accumulatedText) + '<span class="streaming-cursor"></span>';
              bindCopyCodeButtons();
            }

            if (state.autoScroll) {
              scrollToBottom();
            }
          }

          if (data.done) {
            streamHasEnded = true;
            break;
          }
        }
      }

      if (!accumulatedText || accumulatedText.trim().length === 0) {
        throw new Error('Received an empty response from Gemini. Please try again.');
      }

      // Finish Stream Cleanly
      chat.messages[aiMsgIndex].content = accumulatedText;
      chat.messages[aiMsgIndex].isError = false;
      saveChats();

      if (msgBody) {
        msgBody.innerHTML = renderMarkdown(accumulatedText);
        bindCopyCodeButtons();
      }

      renderActiveChatMessages();

      // ================================================================
      // MANDATORY AUTONOMOUS VOICE OUTPUT
      // Automatically speaks every completed answer aloud!
      // ================================================================
      VoiceEngine.speakResponse(accumulatedText);

    } catch (err) {
      if (err.name === 'AbortError') {
        showToast('Generation stopped', 'info');
        if (accumulatedText.trim().length > 0) {
          chat.messages[aiMsgIndex].content = accumulatedText;
          chat.messages[aiMsgIndex].isError = false;
        } else {
          chat.messages.splice(aiMsgIndex, 1);
        }
      } else {
        console.error('Generation Error:', err);
        chat.messages[aiMsgIndex].content = err.message || 'An unexpected error occurred while contacting Gemini API.';
        chat.messages[aiMsgIndex].isError = true;
        showToast(err.message || 'Generation failed', 'error');
      }
      saveChats();
      renderActiveChatMessages();
      AvatarController.updateState('idle');
    } finally {
      state.isGenerating = false;
      state.abortController = null;
      updateGeneratingUI(false);
      saveChats();
      scrollToBottom();
      TelemetryMonitor.update();
    }
  }

  function regenerateMessage(msgIndex) {
    if (state.isGenerating) return;

    // Interrupt any ongoing speech
    if (state.isSpeaking) {
      VoiceEngine.stop();
    }

    const activeChat = getActiveChat();
    if (!activeChat) return;

    if (msgIndex >= 0 && msgIndex < activeChat.messages.length) {
      activeChat.messages = activeChat.messages.slice(0, msgIndex);
    }

    const freshAiMsg = {
      role: 'model',
      content: '',
      timestamp: new Date().toISOString()
    };
    activeChat.messages.push(freshAiMsg);
    const newIdx = activeChat.messages.length - 1;

    saveChats();
    renderActiveChatMessages();
    streamAiResponse(activeChat, newIdx);
  }

  function updateGeneratingUI(isGenerating) {
    if (isGenerating) {
      elements.stopGeneratingWrapper.classList.remove('hidden');
      elements.sendBtn.disabled = true;
      elements.chatInput.setAttribute('disabled', 'true');
    } else {
      elements.stopGeneratingWrapper.classList.add('hidden');
      elements.chatInput.removeAttribute('disabled');
      updateSendButtonState();
      focusChatInput();
    }
  }

  // ============================================================================
  // AUTO SCROLL & VIEWPORT MANAGEMENT
  // ============================================================================
  function scrollToBottom(smooth = false) {
    if (!elements.chatScrollArea) return;
    elements.chatScrollArea.scrollTo({
      top: elements.chatScrollArea.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  function handleScroll() {
    if (!elements.chatScrollArea) return;
    const { scrollTop, scrollHeight, clientHeight } = elements.chatScrollArea;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;

    state.autoScroll = isAtBottom;

    if (elements.scrollToBottomBtn) {
      if (!isAtBottom && scrollHeight > clientHeight * 1.3) {
        elements.scrollToBottomBtn.classList.remove('hidden');
      } else {
        elements.scrollToBottomBtn.classList.add('hidden');
      }
    }
  }

  // ============================================================================
  // COPY CODE & TEXT UTILITIES
  // ============================================================================
  function bindCopyCodeButtons() {
    const copyBtns = document.querySelectorAll('.copy-code-btn');
    copyBtns.forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);

      newBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const codeId = newBtn.getAttribute('data-code-id');
        const codeEl = document.getElementById(codeId);
        if (!codeEl) return;

        const textToCopy = codeEl.innerText || codeEl.textContent;
        try {
          await navigator.clipboard.writeText(textToCopy);
          newBtn.classList.add('copied');
          const span = newBtn.querySelector('span');
          if (span) span.textContent = 'Copied!';
          setTimeout(() => {
            newBtn.classList.remove('copied');
            if (span) span.textContent = 'Copy';
          }, 2000);
          showToast('Code copied to clipboard', 'success');
        } catch (_) {
          fallbackCopyToClipboard(textToCopy);
        }
      });
    });
  }

  async function copyMessageText(msgIndex) {
    const activeChat = getActiveChat();
    if (!activeChat || !activeChat.messages[msgIndex]) return;

    const text = activeChat.messages[msgIndex].content;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Response copied to clipboard', 'success');
    } catch (_) {
      fallbackCopyToClipboard(text);
    }
  }

  function fallbackCopyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast('Copied to clipboard', 'success');
    } catch (_) {
      showToast('Failed to copy text', 'error');
    }
    document.body.removeChild(textarea);
  }

  function exportChatAsMarkdown() {
    const activeChat = getActiveChat();
    if (!activeChat || activeChat.messages.length === 0) {
      showToast('No messages to export', 'info');
      return;
    }

    const title = activeChat.title || 'Conversation';
    let mdContent = `# ${title}\n\n`;
    mdContent += `*Exported from Yantra AI Voice Companion on ${new Date().toLocaleString()}*\n`;
    mdContent += `*Model: ${activeChat.model || state.settings.model}*\n\n---\n\n`;

    activeChat.messages.forEach(msg => {
      const sender = msg.role === 'user' ? '### User' : '### Yantra AI (Gemini)';
      mdContent += `${sender}\n\n${msg.content}\n\n---\n\n`;
    });

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Exported as Markdown file', 'success');
  }

  // ============================================================================
  // UI EVENT HANDLERS & INPUT INTERACTION
  // ============================================================================
  function autoResizeTextarea() {
    if (!elements.chatInput) return;
    elements.chatInput.style.height = 'auto';
    elements.chatInput.style.height = Math.min(elements.chatInput.scrollHeight, 160) + 'px';
  }

  function updateCharCount() {
    if (!elements.chatInput || !elements.charCount) return;
    const len = elements.chatInput.value.length;
    if (len > 30) {
      elements.charCount.classList.remove('hidden');
      elements.charCount.textContent = `${len} characters`;
    } else {
      elements.charCount.classList.add('hidden');
    }
  }

  function updateSendButtonState() {
    if (!elements.chatInput || !elements.sendBtn) return;
    const hasText = elements.chatInput.value.trim().length > 0;
    elements.sendBtn.disabled = !hasText || state.isGenerating;
  }

  function focusChatInput() {
    if (elements.chatInput && window.innerWidth > 768) {
      elements.chatInput.focus();
    }
  }

  function toggleSidebar() {
    if (window.innerWidth <= 768) {
      elements.sidebar.classList.toggle('open');
      elements.sidebarBackdrop.classList.toggle('active');
    } else {
      elements.sidebar.classList.toggle('collapsed');
    }
  }

  function closeSidebar() {
    elements.sidebar.classList.remove('open');
    elements.sidebarBackdrop.classList.remove('active');
  }

  // ============================================================================
  // MODAL CONTROLS (Settings & Confirm)
  // ============================================================================
  function openSettingsModal() {
    elements.apiKeyInput.value = state.settings.apiKey || '';
    elements.modalModelSelect.value = state.settings.model || DEFAULT_SETTINGS.model;
    elements.systemInstructionInput.value = state.settings.systemInstruction || DEFAULT_SETTINGS.systemInstruction;
    elements.temperatureSlider.value = state.settings.temperature;
    elements.tempValueDisplay.textContent = state.settings.temperature;
    elements.testKeyFeedback.textContent = '';
    elements.testKeyFeedback.className = 'test-feedback';

    elements.settingsModal.classList.remove('hidden');
  }

  function closeSettingsModal() {
    elements.settingsModal.classList.add('hidden');
  }

  function saveSettingsFromModal() {
    state.settings.apiKey = elements.apiKeyInput.value.trim();
    state.settings.model = elements.modalModelSelect.value;
    state.settings.systemInstruction = elements.systemInstructionInput.value.trim() || DEFAULT_SETTINGS.systemInstruction;
    state.settings.temperature = parseFloat(elements.temperatureSlider.value);

    if (elements.modelSelector) {
      elements.modelSelector.value = state.settings.model;
    }

    saveSettings();
    updateApiStatusUI();
    TelemetryMonitor.update();
    closeSettingsModal();
    showToast('Settings saved successfully', 'success');
  }

  async function testApiKeyConnection() {
    const key = elements.apiKeyInput.value.trim();
    if (!key && !state.serverHasKey) {
      elements.testKeyFeedback.textContent = 'Please enter an API key to test.';
      elements.testKeyFeedback.className = 'test-feedback error';
      return;
    }

    elements.testKeySpinner.classList.remove('hidden');
    elements.testKeyText.textContent = 'Testing...';
    elements.testApiKeyBtn.disabled = true;
    elements.testKeyFeedback.textContent = '';

    try {
      const response = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key })
      });

      const data = await response.json();
      if (response.ok && data.valid) {
        elements.testKeyFeedback.textContent = '✓ Connected successfully!';
        elements.testKeyFeedback.className = 'test-feedback success';
        showToast('Gemini API connected successfully!', 'success');
      } else {
        elements.testKeyFeedback.textContent = '✗ ' + (data.message || 'Key invalid');
        elements.testKeyFeedback.className = 'test-feedback error';
      }
    } catch (_) {
      elements.testKeyFeedback.textContent = '✗ Network error connecting to backend.';
      elements.testKeyFeedback.className = 'test-feedback error';
    } finally {
      elements.testKeySpinner.classList.add('hidden');
      elements.testKeyText.textContent = 'Test API Connection';
      elements.testApiKeyBtn.disabled = false;
    }
  }

  let activeConfirmAction = null;
  function openConfirmModal(title, message, onConfirm) {
    elements.confirmModalTitle.textContent = title;
    elements.confirmModalMessage.textContent = message;
    activeConfirmAction = onConfirm;
    elements.confirmModal.classList.remove('hidden');
  }

  function closeConfirmModal() {
    elements.confirmModal.classList.add('hidden');
    activeConfirmAction = null;
  }

  // ============================================================================
  // EVENT LISTENERS BINDING
  // ============================================================================
  function bindEventListeners() {
    // Layout & Navigation
    elements.toggleSidebarBtn.addEventListener('click', toggleSidebar);
    elements.closeSidebarBtn.addEventListener('click', closeSidebar);
    elements.sidebarBackdrop.addEventListener('click', closeSidebar);
    elements.themeToggleBtn.addEventListener('click', toggleTheme);
    elements.newChatBtn.addEventListener('click', () => createNewChat(true));
    elements.clearChatBtn.addEventListener('click', clearActiveChat);
    elements.clearAllChatsBtn.addEventListener('click', clearAllChats);
    elements.exportChatBtn.addEventListener('click', exportChatAsMarkdown);
    elements.openSettingsBtn.addEventListener('click', openSettingsModal);
    elements.apiKeyStatusPill.addEventListener('click', openSettingsModal);

    elements.currentChatTitle.addEventListener('click', () => {
      if (state.activeChatId) renameChat(state.activeChatId);
    });
    elements.renameChatBtn.addEventListener('click', () => {
      if (state.activeChatId) renameChat(state.activeChatId);
    });

    // View Mode Switcher
    elements.viewModeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        applyViewMode(mode);
      });
    });

    // Model Selector Change
    elements.modelSelector.addEventListener('change', (e) => {
      const activeChat = getActiveChat();
      if (activeChat) {
        activeChat.model = e.target.value;
        saveChats();
      }
      state.settings.model = e.target.value;
      saveSettings();
      TelemetryMonitor.update();
      showToast(`Model set to ${e.target.value}`, 'info');
    });

    // ========================================================================
    // AVATAR & VOICE COMPANION CONTROLS
    // ========================================================================

    // 1. Visor Avatar Click: Interrupts speech if talking, starts listening if idle
    elements.avatarVisor.addEventListener('click', () => {
      if (state.isSpeaking || state.isGenerating) {
        InterruptionManager.triggerInterrupt();
      } else {
        VoiceInput.startListening();
      }
    });

    // 2. Interrupt Button
    elements.interruptBtn.addEventListener('click', () => {
      InterruptionManager.triggerInterrupt();
    });

    // 3. Microphone Button
    elements.voiceInputBtn.addEventListener('click', () => {
      if (state.isListening) {
        VoiceInput.stopListening(true);
      } else {
        VoiceInput.startListening();
      }
    });

    elements.inlineMicBtn.addEventListener('click', () => {
      if (state.isListening) {
        VoiceInput.stopListening(true);
      } else {
        VoiceInput.startListening();
      }
    });

    elements.cancelVoiceInputBtn.addEventListener('click', () => {
      VoiceInput.stopListening(false);
      AvatarController.updateState('idle');
    });

    // 4. Hands-Free Continuous Mode Toggle
    elements.handsFreeBtn.addEventListener('click', () => {
      state.voiceConfig.handsFree = !state.voiceConfig.handsFree;
      saveVoiceConfig();
      applyVoiceConfigUI();
      showToast(`Hands-Free conversation: ${state.voiceConfig.handsFree ? 'ENABLED' : 'DISABLED'}`, 'info');
    });

    // 5. Auto-Speak Mute Toggle
    elements.toggleAudioMuteBtn.addEventListener('click', () => {
      state.voiceConfig.autoSpeak = !state.voiceConfig.autoSpeak;
      if (!state.voiceConfig.autoSpeak) {
        VoiceEngine.stop();
      }
      saveVoiceConfig();
      applyVoiceConfigUI();
      TelemetryMonitor.update();
      showToast(`AI Voice Output: ${state.voiceConfig.autoSpeak ? 'ENABLED' : 'MUTED'}`, 'info');
    });

    // 6. Voice Synthesizer Controls
    elements.voiceSelect.addEventListener('change', (e) => {
      state.voiceConfig.voiceURI = e.target.value;
      saveVoiceConfig();
      const selected = VoiceEngine.getSelectedVoice();
      if (selected && elements.activeVoiceNameDisplay) {
        elements.activeVoiceNameDisplay.textContent = selected.name.split(' ')[0] || 'Selected';
      }
      showToast('Voice updated', 'info');
    });

    elements.rateSlider.addEventListener('input', (e) => {
      state.voiceConfig.rate = parseFloat(e.target.value);
      elements.rateValueDisplay.textContent = `${state.voiceConfig.rate}x`;
      saveVoiceConfig();
    });

    elements.pitchSlider.addEventListener('input', (e) => {
      state.voiceConfig.pitch = parseFloat(e.target.value);
      elements.pitchValueDisplay.textContent = `${state.voiceConfig.pitch}x`;
      saveVoiceConfig();
    });

    // 7. Active Playback Controls (Pause / Resume / Stop)
    elements.pauseResumeVoiceBtn.addEventListener('click', () => {
      if (state.isPaused) {
        VoiceEngine.resume();
      } else {
        VoiceEngine.pause();
      }
    });

    elements.stopVoiceBtn.addEventListener('click', () => {
      VoiceEngine.stop();
    });

    // Search Chats
    elements.searchChatsInput.addEventListener('input', (e) => {
      if (e.target.value.length > 0) {
        elements.clearSearchBtn.classList.remove('hidden');
      } else {
        elements.clearSearchBtn.classList.add('hidden');
      }
      renderSidebarHistory();
    });

    elements.clearSearchBtn.addEventListener('click', () => {
      elements.searchChatsInput.value = '';
      elements.clearSearchBtn.classList.add('hidden');
      renderSidebarHistory();
      elements.searchChatsInput.focus();
    });

    // Chat History Item Delegated Click
    elements.chatHistoryList.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('.item-action-btn');
      if (actionBtn) {
        const action = actionBtn.getAttribute('data-action');
        const chatId = actionBtn.getAttribute('data-chat-id');
        if (action === 'rename') renameChat(chatId);
        else if (action === 'delete') deleteChat(chatId);
        return;
      }

      const item = e.target.closest('.chat-history-item');
      if (item) {
        const chatId = item.getAttribute('data-chat-id');
        setActiveChat(chatId);
        if (window.innerWidth <= 768) closeSidebar();
      }
    });

    // Suggestion Cards Delegated Click
    elements.welcomeScreen.addEventListener('click', (e) => {
      const card = e.target.closest('.suggestion-card');
      if (card) {
        const promptText = card.getAttribute('data-prompt');
        if (promptText) sendMessage(promptText);
      }
    });

    // Messages Container Action Delegated Click
    elements.messagesContainer.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('.action-pill-btn');
      if (!actionBtn) return;

      const action = actionBtn.getAttribute('data-action');
      const msgIndex = parseInt(actionBtn.getAttribute('data-msg-index'), 10);

      if (action === 'copy-msg') copyMessageText(msgIndex);
      else if (action === 'regenerate') regenerateMessage(msgIndex);
      else if (action === 'speak-msg') {
        const activeChat = getActiveChat();
        if (activeChat && activeChat.messages[msgIndex]) {
          VoiceEngine.speakResponse(activeChat.messages[msgIndex].content);
        }
      }
    });

    // Scroll & Viewport
    elements.chatScrollArea.addEventListener('scroll', handleScroll);
    elements.scrollToBottomBtn.addEventListener('click', () => scrollToBottom(true));

    // Input & Send
    elements.chatInput.addEventListener('input', () => {
      autoResizeTextarea();
      updateCharCount();
      updateSendButtonState();
    });

    elements.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    elements.sendBtn.addEventListener('click', () => sendMessage());
    elements.stopGeneratingBtn.addEventListener('click', () => {
      InterruptionManager.triggerInterrupt();
    });

    // Settings Modal
    elements.closeSettingsModalBtn.addEventListener('click', closeSettingsModal);
    elements.cancelSettingsBtn.addEventListener('click', closeSettingsModal);
    elements.saveSettingsBtn.addEventListener('click', saveSettingsFromModal);
    elements.testApiKeyBtn.addEventListener('click', testApiKeyConnection);

    elements.toggleApiKeyVisibilityBtn.addEventListener('click', () => {
      const isPassword = elements.apiKeyInput.type === 'password';
      elements.apiKeyInput.type = isPassword ? 'text' : 'password';
    });

    elements.temperatureSlider.addEventListener('input', (e) => {
      elements.tempValueDisplay.textContent = e.target.value;
    });

    // Confirm Modal
    elements.closeConfirmModalBtn.addEventListener('click', closeConfirmModal);
    elements.cancelConfirmBtn.addEventListener('click', closeConfirmModal);
    elements.actionConfirmBtn.addEventListener('click', () => {
      if (typeof activeConfirmAction === 'function') activeConfirmAction();
      closeConfirmModal();
    });

    // ========================================================================
    // GLOBAL HOTKEYS: Space to Interrupt, Esc to Close/Interrupt
    // ========================================================================
    document.addEventListener('keydown', (e) => {
      const targetTag = (e.target.tagName || '').toLowerCase();
      const isEditable = targetTag === 'input' || targetTag === 'textarea' || e.target.isContentEditable;

      // Space key interrupts AI speech when not focused inside a text input
      if (e.code === 'Space' && !isEditable) {
        if (state.isSpeaking || state.isGenerating) {
          e.preventDefault();
          InterruptionManager.triggerInterrupt();
        }
      }

      // Escape key cancels modals or interrupts AI
      if (e.key === 'Escape') {
        if (!elements.settingsModal.classList.contains('hidden')) {
          closeSettingsModal();
        } else if (!elements.confirmModal.classList.contains('hidden')) {
          closeConfirmModal();
        } else if (state.isSpeaking || state.isGenerating) {
          InterruptionManager.triggerInterrupt();
        }
      }

      // Cmd/Ctrl + K or Cmd/Ctrl + N: New Chat
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'n')) {
        e.preventDefault();
        createNewChat(true);
      }
    });
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  function init() {
    setupMarkdown();
    loadPersistedData();
    bindEventListeners();
    AvatarController.init();
    VoiceEngine.init();
    VoiceInput.init();
    TelemetryMonitor.init();
    checkServerHealth();
    autoResizeTextarea();
    updateSendButtonState();
    focusChatInput();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
