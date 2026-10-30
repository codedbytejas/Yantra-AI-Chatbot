# 🚀 Yantra AI — Autonomous Voice AI Companion

An advanced, cybernetic conversational Voice AI Companion powered by **Google Gemini API**, featuring animated cyan-blue AI eyes, autonomous speech synthesis, hands-free voice input, instant speech interruption, and a real-time subsystem telemetry HUD.

Built with **HTML5, CSS3, Vanilla JavaScript, and Node.js / Express**.

---

## 🌟 Key Upgrades & Features

### 1. 👁️ Futuristic Cybernetic AI Avatar
- **Animated Cyan-Blue AI Eyes**: Large, expressive robotic eyes embedded in a curved glossy visor.
- **Natural Gaze Tracking**: Pupils follow the cursor across the screen in real time during idle and listening states.
- **Organic Random Blinking**: Randomized smooth eyelid blinks every 3.5 to 6 seconds.
- **Visual State Transitions**:
  - `IDLE`: Cyan breathing ambient pulse and responsive gaze tracking.
  - `LISTENING`: Glowing green aura with expanding radar ripple waves.
  - `THINKING`: Pulsing yellow neural processing oscillation.
  - `SPEAKING`: Vibrant cyan-blue glow synchronized with active digital mouth waveform.
  - `INTERRUPTED`: Instant crimson flash and deactivation chirp.
- **Digital Mouth Audio Equalizer**: 16-bar animated waveform synchronized with AI voice synthesis.
- **View Mode Switcher**:
  - `Avatar Focus`: Maximizes the cybernetic visor for an immersive presence.
  - `Split HUD`: Balanced dual-pane view with companion stage on the left and conversation stream on the right.
  - `Chat Stream`: Full-width text and markdown conversation focus.

### 2. 🗣️ Autonomous Voice Output (MANDATORY SPEECH)
- **Automatic Speech on Every Answer**: The AI automatically speaks aloud every response upon generation completion—no manual "Read" button required.
- **Long Answer Chunking**: Automatically partitions long markdown responses into natural sentence units, overcoming browser speech synthesis cutoffs.
- **Natural Code Handling**: Detects programming code blocks and reads them as natural summaries so code is never read out as raw punctuation.
- **Continuous Keep-Alive Heartbeat**: Prevents Chromium's 15-second speech synthesis timeout bug with automated keepalive pulses.
- **Speech Parameter Sliders**: Real-time adjustable speech speed/rate (0.75x–1.5x) and voice pitch (0.8x–1.25x).
- **Voice Selection**: Automatically detects and lists all browser-available speech synthesis voices, prioritizing high-quality natural voices.
- **Floating Playback Bar**: Real-time status showing current speech state with Pause, Resume, and Stop controls.
- **Mute / Unmute Toggle**: One-click quick toggle in the visor header for quiet environments.

### 3. 🎙️ Voice Input & Hands-Free Interaction
- **Speech-to-Text Recognition**: Built-in Web Speech API integration (`webkitSpeechRecognition` / `SpeechRecognition`).
- **Live Transcription HUD**: Floating neon HUD banner displaying interim and final recognized phrases in real time.
- **Automatic Query Dispatch**: As soon as you pause speaking, your question is dispatched to Gemini automatically.
- **Hands-Free Continuous Mode**: Toggle the continuous dialogue mode so the microphone automatically re-arms after the AI finishes speaking its answer.
- **Dual Mic Triggers**: Access speech input via the large companion action button or the inline input bar mic icon.

### 4. 🛑 Instant Interruption System
- **Immediate Speech Halt**: Stop the AI mid-sentence with zero overlapping audio sessions.
- **Stream Abort**: Aborts the backend Gemini Server-Sent Events stream using `AbortController`.
- **Multiple Interruption Triggers**:
  - **Press `Space`**: Hit the spacebar at any time (when not typing inside an input) to cut off speech instantly.
  - **Click or Tap Visor**: Directly click anywhere on the AI's glossy visor to interrupt and initiate voice input.
  - **Click `Interrupt` Button**: Dedicated HUD button with visual feedback.
  - **Press `Escape`**: Universal escape key to halt speech or close modals.
- **Synthesized Sci-Fi Feedback**: Pure Web Audio API synthesized audio chirps for listening, interruption, and readiness.

### 5. 📊 Real-Time Subsystem Telemetry HUD
Never shows fake metrics or fabricated sensor telemetry. All indicators reflect genuine application state:
- **Display Subsystem**: Live connection status (`ONLINE (HTTP/2 SSE)` / `OFFLINE`).
- **Voice Input (MIC)**: Hardware microphone permission (`GRANTED`, `DENIED`, or `READY`).
- **AI State**: Real-time companion state (`IDLE`, `LISTENING`, `THINKING`, `SPEAKING`, `INTERRUPTED`).
- **Voice Synthesis (TTS)**: Speech synthesizer status (`READY`, `SPEAKING`, `PAUSED`, or `MUTED`).
- **Gemini Core**: Currently active Google Gemini model.
- **Session Turns**: Real count of conversation exchanges in the active session.

### 6. 🧠 Intelligent Gemini Integration
- **Latest Active Gemini Models**:
  - `gemini-3.5-flash-lite` *(Default: Ultra-fast latency ~1.5s, highly articulate)*
  - `gemini-3.5-flash` *(Deep thinking and complex reasoning)*
  - `gemini-3.6-flash` *(Next-gen multimodal flash)*
  - `gemini-3.1-flash-lite` *(High-efficiency lightweight model)*
- **Resilient Multi-Model Fallback**: If a model returns 404/deprecated, the backend automatically transitions to alternative available models.
- **SSE Streaming**: Live token-by-token response streaming with cursor animations.
- **Multi-Turn Context**: Preserves the complete dialog history across multiple questions.
- **Markdown & Code Highlighting**: Full Markdown formatting, tables, lists, and syntax-highlighted code blocks with 1-click Copy Code buttons.
- **Conversation Management**: Multiple chats, auto-naming, search, rename, delete, and export as Markdown (`.md`).

---

## 📂 Project Structure

```text
yantra_ai_chatbot/
├── public/
│   ├── index.html               # Visor avatar stage, telemetry HUD, chat & modals
│   ├── style.css                # Cybernetic dark styling, animated eyes, waveform & glowing effects
│   ├── script.js                # Avatar controller, VoiceEngine, VoiceInput & InterruptionManager
│   └── vendor/                  # Offline vendor scripts (Marked, DOMPurify, Highlight.js)
├── server/
│   └── server.js                # Express backend, Gemini SSE streaming proxy & fallback engine
├── .env                         # Server environment variables (API Key, Model, Port)
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore file
├── package.json                 # Dependencies & scripts
└── README.md                    # Comprehensive documentation
```

---

## ⚡ Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **Browser**: Chrome, Edge, Safari, or Brave (supporting Web Speech API for voice features)
- **Google Gemini API Key**: [Get a free API key at Google AI Studio](https://aistudio.google.com/app/apikey)

### 2. Installation
```bash
cd yantra_ai_chatbot
npm install
```

### 3. Configure Your Gemini API Key
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Open `.env` and configure:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
PORT=3000
```

> 💡 **Tip:** You can also run the server directly and input your API key inside the UI via **Settings (⚙️)**.

### 4. Run the Application
```bash
npm start
```

For development mode with automatic reload:
```bash
npm run dev
```

Open your browser and navigate to:
```
http://localhost:3000
```

---

## ⌨️ Keyboard Shortcuts & Controls

| Input | Action |
|---|---|
| `Space` | **Interrupt AI Speech** immediately (when not typing in textarea) |
| `Click Visor` | **Interrupt speech** or **Start listening** |
| `Enter` | Send typed message |
| `Shift + Enter` | Insert newline in textarea |
| `Escape` | Interrupt AI / Close modals |
| `Cmd + K` or `Ctrl + K` | Create a new conversation |
| `Cmd + N` or `Ctrl + N` | Create a new conversation |

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Subsystem status, API key readiness, and uptime. |
| `GET` | `/api/config` | Available Gemini models, active defaults, and system prompt. |
| `POST` | `/api/validate-key` | Test connection of a given Gemini API key. |
| `POST` | `/api/chat/stream` | SSE streaming endpoint for real-time generative responses. |
| `POST` | `/api/chat` | Non-streaming JSON endpoint. |

---

## 🛠️ Troubleshooting

### 1. Voice Output Is Silent
- Check the **Voice ON / Muted** button in the visor top-right bar.
- Ensure your browser's audio is not muted or blocked by an autoplay policy. Click anywhere on the page to initialize the Web Audio API context.
- Verify that a valid voice is selected in the **AI Companion Voice** dropdown.

### 2. Microphone Input Not Working
- Check the **VOICE INPUT (MIC)** item in the telemetry dashboard.
- If it displays `DENIED`, open your browser's site settings (`lock icon in URL bar -> Permissions`) and set Microphone to **Allow**.
- Ensure you are running on `http://localhost:3000` or `https://` (browsers block microphone access on insecure non-localhost origins).

### 3. Model Deprecation / 404 Error
- Legacy models like `gemini-2.5-flash`, `gemini-2.0-flash`, and `gemini-1.5-flash` were deprecated by Google for new users.
- Use `gemini-3.5-flash-lite` (default) or `gemini-3.5-flash`. The server includes automated fallback logic to ensure continuity.

---

## 📄 License
This project is open-source and released under the [MIT License](LICENSE).
