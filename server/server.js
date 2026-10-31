/**
 * Server - Google Gemini AI Chatbot Backend
 * Handles secure communication with Google Gemini API,
 * Server-Sent Events (SSE) streaming, message formatting, model fallback, and health.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Active supported Gemini models
const AVAILABLE_MODELS = [
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', tag: 'Fastest & Recommended', description: 'Ultra-fast, low latency Google Gemini model' },
  { id: 'gemini-3.5-flash',      name: 'Gemini 3.5 Flash',      tag: 'Deep Reasoning', description: 'Advanced thinking and complex reasoning' },
  { id: 'gemini-3.6-flash',      name: 'Gemini 3.6 Flash',      tag: 'Next-Gen Flash', description: 'Google’s next-generation Flash model' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite', tag: 'Lightweight', description: 'Cost-efficient and fast execution' }
];

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'];

const DEFAULT_SYSTEM_INSTRUCTION = process.env.SYSTEM_INSTRUCTION ||
  'You are Yantra AI, an advanced, autonomous voice AI companion and intelligence partner powered by Google Gemini. ' +
  'You have a warm, natural, intelligent, and articulate personality. ' +
  'You speak naturally and conversationally, like a real AI companion, avoiding robotic boilerplate, repetitive apologies, or disclaimers. ' +
  'For concise questions, provide direct, articulate answers. For complex questions or programming tasks, provide well-structured explanations with Markdown and clean code blocks. ' +
  'Speak engagingly and directly to the user.';

/**
 * Enriches system instructions with real-time temporal grounding.
 * Anchors the model to the exact current real-world date, time, weekday, and year.
 */
function buildSystemInstruction(userInstruction) {
  const base = userInstruction || DEFAULT_SYSTEM_INSTRUCTION;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });

  return `${base}\n\n[Real-World Telemetry Anchor: Current real-world date is ${dateStr}, and current time is ${timeStr} (UTC: ${now.toUTCString()}). Use this timestamp to accurately answer questions regarding 'today', 'now', 'current year', or temporal context.]`;
}

/**
 * Helper to resolve the active Gemini API key.
 * Checks request headers first (x-gemini-api-key), then environment variable.
 */
function resolveApiKey(req) {
  const customKey = req.headers['x-gemini-api-key'] || (req.body && req.body.apiKey);
  if (customKey && typeof customKey === 'string' && customKey.trim().length > 0) {
    return customKey.trim();
  }
  return (process.env.GEMINI_API_KEY || '').trim();
}

/**
 * Helper to normalize incoming messages into the format required by Gemini API.
 * Maps 'assistant' role to 'model', merges consecutive messages of the same role,
 * and ensures non-empty text parts.
 */
function formatMessagesForGemini(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const formatted = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;
    const rawRole = (msg.role || 'user').toLowerCase();
    const role = (rawRole === 'assistant' || rawRole === 'model') ? 'model' : 'user';
    const content = typeof msg.content === 'string' ? msg.content.trim() : '';

    if (!content) continue;

    // Check if the last message in formatted array has the same role.
    // Gemini API requires alternating roles.
    if (formatted.length > 0 && formatted[formatted.length - 1].role === role) {
      formatted[formatted.length - 1].parts[0].text += `\n\n${content}`;
    } else {
      formatted.push({
        role,
        parts: [{ text: content }]
      });
    }
  }

  // Ensure first message is from 'user' (Gemini requirement)
  while (formatted.length > 0 && formatted[0].role !== 'user') {
    formatted.shift();
  }

  return formatted;
}

/**
 * Extract text safely from a Gemini response chunk, handling thinking parts.
 */
function extractChunkText(chunk) {
  if (!chunk) return '';
  if (typeof chunk.text === 'string' && chunk.text.length > 0) {
    return chunk.text;
  }
  if (chunk.candidates && Array.isArray(chunk.candidates) && chunk.candidates[0]?.content?.parts) {
    let t = '';
    for (const part of chunk.candidates[0].content.parts) {
      if (part && typeof part.text === 'string' && !part.thought) {
        t += part.text;
      }
    }
    return t;
  }
  return '';
}

/**
 * Format error messages into clear, actionable human-readable explanations.
 */
function parseGeminiError(err) {
  const errMsg = (err && err.message) ? String(err.message) : String(err);

  if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid') || (errMsg.includes('400') && errMsg.includes('API key'))) {
    return {
      status: 401,
      message: 'Invalid Gemini API Key. Please verify your API key in .env or the Settings dialog.'
    };
  }
  if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
    return {
      status: 429,
      message: 'Google Gemini API quota or rate limit exceeded. Please wait a few seconds and try again.'
    };
  }
  if (errMsg.includes('PERMISSION_DENIED') || errMsg.includes('403')) {
    return {
      status: 403,
      message: 'Permission denied. Ensure the Gemini API is enabled for your Google Cloud / AI Studio project.'
    };
  }
  if (errMsg.includes('NOT_FOUND') || errMsg.includes('404') || errMsg.includes('no longer available')) {
    return {
      status: 404,
      message: 'The requested Gemini model is no longer available. Switched to latest active model.'
    };
  }
  if (errMsg.includes('SAFETY') || errMsg.includes('blocked')) {
    return {
      status: 400,
      message: 'The response was blocked by Gemini safety guidelines.'
    };
  }
  if (errMsg.includes('timeout') || errMsg.includes('ETIMEDOUT') || errMsg.includes('ESOCKETTIMEDOUT')) {
    return {
      status: 504,
      message: 'Connection timed out while waiting for Gemini API response.'
    };
  }

  return {
    status: 500,
    message: errMsg.length > 250 ? errMsg.slice(0, 250) + '...' : errMsg
  };
}

// ==============================================================================
// API Routes
// ==============================================================================

/**
 * GET /api/health
 * Checks server health and configuration status.
 */
app.get('/api/health', (req, res) => {
  const hasEnvKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasApiKey: hasEnvKey,
    defaultModel: DEFAULT_MODEL,
    uptime: Math.floor(process.uptime())
  });
});

/**
 * GET /api/config
 * Returns public configuration and available models.
 */
app.get('/api/config', (req, res) => {
  const hasEnvKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  res.json({
    hasApiKey: hasEnvKey,
    defaultModel: DEFAULT_MODEL,
    availableModels: AVAILABLE_MODELS
  });
});

/**
 * POST /api/validate-key
 * Validates a Gemini API key by making a test ping call.
 */
app.post('/api/validate-key', async (req, res) => {
  const testKey = resolveApiKey(req);
  if (!testKey) {
    return res.status(400).json({ valid: false, message: 'No API key provided.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: testKey });
    // Quick test generation with lightweight active model
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: 'Ping',
      config: { maxOutputTokens: 5 }
    });

    if (response) {
      return res.json({ valid: true, message: 'API key is valid and working.' });
    }
    return res.json({ valid: true, message: 'Connection successful.' });
  } catch (err) {
    const parsed = parseGeminiError(err);
    return res.status(parsed.status).json({ valid: false, message: parsed.message });
  }
});

/**
 * POST /api/chat/stream
 * Server-Sent Events (SSE) streaming endpoint for real-time AI responses.
 * Includes automatic model fallback and chunk text extraction.
 */
app.post('/api/chat/stream', async (req, res) => {
  const apiKey = resolveApiKey(req);

  // If no API key is available, return 401 error
  if (!apiKey) {
    return res.status(401).json({
      error: 'Gemini API key is missing. Please set GEMINI_API_KEY in your .env file or configure it in the Chat Settings.'
    });
  }

  const {
    messages = [],
    model = DEFAULT_MODEL,
    systemInstruction,
    temperature = 0.7
  } = req.body;

  const formattedContents = formatMessagesForGemini(messages);
  if (formattedContents.length === 0) {
    return res.status(400).json({ error: 'Messages array is empty or contains invalid content.' });
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  let isClientConnected = true;
  res.on('close', () => {
    if (!res.writableEnded) {
      isClientConnected = false;
    }
  });

  const ai = new GoogleGenAI({ apiKey });

  // Prepare model candidates to attempt (requested model, then fallbacks)
  const candidateModels = [];
  if (model) candidateModels.push(model);
  for (const m of FALLBACK_MODELS) {
    if (!candidateModels.includes(m)) candidateModels.push(m);
  }

  let streamSucceeded = false;
  let lastError = null;

  for (const candidateModel of candidateModels) {
    if (!isClientConnected) break;

    try {
      console.log(`[Stream] Initiating stream with model: ${candidateModel}`);

      const activeInstruction = buildSystemInstruction(systemInstruction);
      const config = {
        systemInstruction: activeInstruction,
        temperature: Math.max(0, Math.min(1.0, Number(temperature) || 0.7)),
        tools: [{ googleSearch: {} }] // Attempt live Google Search Grounding
      };

      let streamResponse;
      try {
        streamResponse = await ai.models.generateContentStream({
          model: candidateModel,
          contents: formattedContents,
          config
        });
      } catch (streamInitErr) {
        // If Google Search tool is rejected (e.g. 429 quota limit on free tier without billing profile),
        // gracefully fall back to generation with temporal grounding
        const isQuotaErr = streamInitErr.status === 429 ||
          (streamInitErr.message && (streamInitErr.message.includes('429') || streamInitErr.message.includes('RESOURCE_EXHAUSTED')));
        if (config.tools && isQuotaErr) {
          console.log(`[Stream] Search Grounding quota unavailable on current key (429). Falling back to direct generation...`);
          delete config.tools;
          streamResponse = await ai.models.generateContentStream({
            model: candidateModel,
            contents: formattedContents,
            config
          });
        } else {
          throw streamInitErr;
        }
      }

      let sentAnyChunk = false;

      for await (const chunk of streamResponse) {
        if (!isClientConnected) break;

        const text = extractChunkText(chunk);
        if (text) {
          sentAnyChunk = true;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      if (sentAnyChunk) {
        streamSucceeded = true;
        if (isClientConnected) {
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
        }
        break; // Stream finished successfully
      } else {
        console.warn(`[Stream] Model ${candidateModel} produced 0 text chunks. Trying fallback...`);
      }
    } catch (err) {
      lastError = err;
      const parsed = parseGeminiError(err);
      console.warn(`[Stream] Model ${candidateModel} error: ${parsed.message}`);

      // If error is auth invalid key, don't retry other models as they will all fail
      if (parsed.status === 401) {
        break;
      }
      // Otherwise continue to next fallback model
    }
  }

  if (!streamSucceeded && isClientConnected) {
    const parsed = parseGeminiError(lastError || new Error('Failed to generate response.'));
    console.error('[Stream] All candidate models failed. Returning error:', parsed.message);
    res.write(`data: ${JSON.stringify({ error: parsed.message })}\n\n`);
    res.end();
  }
});

/**
 * POST /api/chat
 * Non-streaming fallback endpoint with model fallback.
 */
app.post('/api/chat', async (req, res) => {
  const apiKey = resolveApiKey(req);
  if (!apiKey) {
    return res.status(401).json({
      error: 'Gemini API key is missing. Please set GEMINI_API_KEY in your .env file or configure it in the Chat Settings.'
    });
  }

  const {
    messages = [],
    model = DEFAULT_MODEL,
    systemInstruction,
    temperature = 0.7
  } = req.body;

  const formattedContents = formatMessagesForGemini(messages);
  if (formattedContents.length === 0) {
    return res.status(400).json({ error: 'Messages array is empty or contains invalid content.' });
  }

  const ai = new GoogleGenAI({ apiKey });
  const candidateModels = [];
  if (model) candidateModels.push(model);
  for (const m of FALLBACK_MODELS) {
    if (!candidateModels.includes(m)) candidateModels.push(m);
  }

  let lastError = null;
  for (const candidateModel of candidateModels) {
    try {
      const activeInstruction = buildSystemInstruction(systemInstruction);
      const config = {
        systemInstruction: activeInstruction,
        temperature: Math.max(0, Math.min(1.0, Number(temperature) || 0.7)),
        tools: [{ googleSearch: {} }] // Attempt live Google Search Grounding
      };

      let response;
      try {
        response = await ai.models.generateContent({
          model: candidateModel,
          contents: formattedContents,
          config
        });
      } catch (genErr) {
        const isQuotaErr = genErr.status === 429 ||
          (genErr.message && (genErr.message.includes('429') || genErr.message.includes('RESOURCE_EXHAUSTED')));
        if (config.tools && isQuotaErr) {
          delete config.tools;
          response = await ai.models.generateContent({
            model: candidateModel,
            contents: formattedContents,
            config
          });
        } else {
          throw genErr;
        }
      }

      const text = response.text || '';
      if (text.trim().length > 0) {
        return res.json({
          text,
          model: candidateModel
        });
      }
    } catch (err) {
      lastError = err;
      const parsed = parseGeminiError(err);
      if (parsed.status === 401) break;
    }
  }

  const parsed = parseGeminiError(lastError || new Error('Failed to generate response.'));
  return res.status(parsed.status).json({ error: parsed.message });
});

/**
 * Helper to resolve Hugging Face access token for fast dedicated image generation.
 */
function resolveHfToken(req) {
  const customKey = req.headers['x-hf-token'] || (req.body && req.body.hfToken);
  if (customKey && typeof customKey === 'string' && customKey.trim().length > 0) {
    return customKey.trim();
  }
  return (process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || '').trim();
}

/**
 * Image Generator Tier 1: Hugging Face Serverless Inference (FLUX.1-schnell / SDXL)
 */
async function tryHuggingFace(prompt, hfToken) {
  if (!hfToken || typeof hfToken !== 'string' || hfToken.trim().length === 0) {
    return null;
  }
  const token = hfToken.trim();
  const models = [
    'black-forest-labs/FLUX.1-schnell',
    'stabilityai/stable-diffusion-xl-base-1.0'
  ];

  for (const modelId of models) {
    try {
      const endpoint = `https://router.huggingface.co/hf-inference/models/${modelId}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: prompt }),
        signal: AbortSignal.timeout(18000)
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type') || 'image/jpeg';
        if (contentType.startsWith('image/')) {
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          if (buffer.byteLength > 5000) {
            return {
              dataUri: `data:${contentType};base64,${buffer.toString('base64')}`,
              engine: `huggingface-${modelId.split('/').pop()}`
            };
          }
        }
      }
    } catch (err) {
      console.warn(`Hugging Face (${modelId}) inference error:`, err.message);
    }
  }
  return null;
}

/**
 * Image Generator Tier 2: Pollinations Sana Model (Opportunistic high-speed generation)
 * Strictly verifies HTTP 200, Content-Type image/*, and size > 8KB.
 * Automatically rejects 402/503 paywall banners.
 */
async function tryPollinationsSana(prompt, width = 1024, height = 1024) {
  try {
    const seed = Math.floor(Math.random() * 10000000);
    const encodedPrompt = encodeURIComponent(prompt);
    // Explicitly use model=sana (the only free model supported on image.pollinations.ai)
    const targetUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=sana&width=${width}&height=${height}&seed=${seed}&nologo=true`;

    const res = await fetch(targetUrl, {
      headers: { 'Accept': 'image/jpeg,image/png,image/*;q=0.9' },
      signal: AbortSignal.timeout(4500)
    });

    if (res.status === 200) {
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      if (contentType.startsWith('image/')) {
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        // Discard any payload smaller than 8KB to ensure no error text or tiny icons
        if (buffer.byteLength > 8192) {
          return {
            dataUri: `data:${contentType};base64,${buffer.toString('base64')}`,
            engine: 'pollinations-sana'
          };
        }
      }
    }
  } catch (err) {
    console.warn('Pollinations Sana bypass/timeout:', err.message);
  }
  return null;
}

/**
 * Image Generator Tier 3: AI Horde Crowdsourced Stable Diffusion Cluster
 * Zero-key anonymous cluster ('0000000000').
 * Uses curated fast models.
 */
async function tryAiHorde(prompt, width = 512, height = 512) {
  try {
    const hWidth = Math.min(Math.max(Math.round(width / 64) * 64, 384), 768);
    const hHeight = Math.min(Math.max(Math.round(height / 64) * 64, 384), 768);

    const postRes = await fetch('https://aihorde.net/api/v2/generate/async', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': '0000000000'
      },
      body: JSON.stringify({
        prompt: prompt,
        params: {
          steps: 16,
          width: hWidth,
          height: hHeight,
          sampler_name: 'k_euler_a',
          cfg_scale: 7
        },
        models: [
          'Deliberate',
          'Dreamshaper',
          'Realistic Vision',
          'AbsoluteReality',
          'ICBINP - I Can\'t Believe It\'s Not Photography'
        ]
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (!postRes.ok) return null;
    const { id } = await postRes.json();
    if (!id) return null;

    const startTime = Date.now();
    while (Date.now() - startTime < 25000) {
      await new Promise(r => setTimeout(r, 1800));
      const checkRes = await fetch(`https://aihorde.net/api/v2/generate/check/${id}`, {
        signal: AbortSignal.timeout(4000)
      });
      if (!checkRes.ok) continue;
      const checkData = await checkRes.json();

      if (checkData.done) {
        const statusRes = await fetch(`https://aihorde.net/api/v2/generate/status/${id}`, {
          signal: AbortSignal.timeout(5000)
        });
        if (!statusRes.ok) break;
        const statusData = await statusRes.json();
        const imgUrl = statusData.generations?.[0]?.img;
        if (!imgUrl) break;

        const imgFetch = await fetch(imgUrl, { signal: AbortSignal.timeout(8000) });
        if (imgFetch.ok) {
          const contentType = imgFetch.headers.get('content-type') || 'image/webp';
          const arrayBuffer = await imgFetch.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          if (buffer.byteLength > 4000) {
            return {
              dataUri: `data:${contentType};base64,${buffer.toString('base64')}`,
              engine: 'ai-horde-stable-diffusion'
            };
          }
        }
        break;
      }

      if (checkData.faulted) break;
    }
  } catch (err) {
    console.warn('AI Horde generation error:', err.message);
  }
  return null;
}

/**
 * POST /api/generate-image
 * Multi-Engine Resilient AI Image Generation:
 * 1. Intelligent Visual Prompt Optimization using Gemini Flash Lite
 * 2. Multi-tier Image Generation Waterfall:
 *    - Tier 1: Hugging Face Serverless FLUX.1-schnell / SDXL (if HF_TOKEN provided)
 *    - Tier 2: Pollinations Sana Model (opportunistic high-speed, strict HTTP 200 + >8KB)
 *    - Tier 3: AI Horde Crowdsourced Stable Diffusion Cluster (zero key, verified buffer)
 *    - Tier 4: Client direct bridge fallback (passes clientUrl with strict browser validation)
 * Converts all images to Base64 Data URI. NEVER returns raw URLs to avoid third-party banners.
 */
app.post('/api/generate-image', async (req, res) => {
  const { prompt, aspectRatio = '1:1' } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Image prompt is required.' });
  }

  const cleanPrompt = prompt.trim();
  const apiKey = resolveApiKey(req);

  // 1. Intelligent Visual Prompt Optimization using Gemini
  let enhancedPrompt = cleanPrompt;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const promptEnhanceRes = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: [
          {
            role: 'user',
            parts: [{
              text: `You are an expert AI prompt engineer. Convert this user idea into a vivid, detailed, photorealistic visual prompt with cinematic lighting, depth, atmosphere, textures, and composition: "${cleanPrompt}". Return ONLY the final expanded prompt without explanations, prefixes, or markdown, under 70 words.`
            }]
          }
        ],
        config: { temperature: 0.7 }
      });
      const generatedPrompt = promptEnhanceRes.text ? promptEnhanceRes.text.trim() : '';
      if (generatedPrompt && generatedPrompt.length > 10) {
        enhancedPrompt = generatedPrompt.replace(/[\n\r]+/g, ' ').replace(/^["']|["']$/g, '');
      }
    } catch (enhanceErr) {
      console.warn('Prompt enhancement fallback to original prompt:', enhanceErr.message);
      enhancedPrompt = cleanPrompt;
    }
  }

  // 2. Aspect Ratio Resolution
  let width = 1024;
  let height = 1024;
  if (aspectRatio === '16:9') {
    width = 1280;
    height = 720;
  } else if (aspectRatio === '9:16') {
    width = 720;
    height = 1280;
  } else if (aspectRatio === '4:3') {
    width = 1024;
    height = 768;
  }

  // 3. Multi-Engine Waterfall Execution
  try {
    // Engine Tier 1: Hugging Face Serverless (FLUX.1 / SDXL)
    const hfToken = resolveHfToken(req);
    if (hfToken) {
      console.log('Attempting Tier 1: Hugging Face Serverless...');
      const hfResult = await tryHuggingFace(enhancedPrompt, hfToken);
      if (hfResult) {
        return res.json({
          success: true,
          imageUrl: hfResult.dataUri,
          prompt: cleanPrompt,
          enhancedPrompt,
          aspectRatio,
          engine: hfResult.engine
        });
      }
    }

    // Engine Tier 2: Pollinations Sana (Server-side fast check)
    console.log('Attempting Tier 2: Pollinations Sana (Server)...');
    const sanaResult = await tryPollinationsSana(enhancedPrompt, width, height);
    if (sanaResult) {
      return res.json({
        success: true,
        imageUrl: sanaResult.dataUri,
        prompt: cleanPrompt,
        enhancedPrompt,
        aspectRatio,
        engine: sanaResult.engine
      });
    }

    // Engine Tier 3: AI Horde Crowdsourced Grid
    console.log('Attempting Tier 3: AI Horde Stable Diffusion...');
    const hordeResult = await tryAiHorde(enhancedPrompt, width, height);
    if (hordeResult) {
      return res.json({
        success: true,
        imageUrl: hordeResult.dataUri,
        prompt: cleanPrompt,
        enhancedPrompt,
        aspectRatio,
        engine: hordeResult.engine
      });
    }

    // Engine Tier 4: Client direct bridge fallback
    // If cloud server IP is temporarily throttled, send client-safe direct URL for browser fetch
    const seed = Math.floor(Math.random() * 10000000);
    const clientUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?model=sana&width=${width}&height=${height}&seed=${seed}&nologo=true`;

    return res.json({
      success: false,
      canTryClient: true,
      clientUrl,
      prompt: cleanPrompt,
      enhancedPrompt,
      aspectRatio,
      error: 'Cloud server generation clusters busy. Switching to direct user visual bridge...'
    });

  } catch (err) {
    console.error('Image Generation Critical Error:', err.message);
    return res.status(503).json({
      success: false,
      error: 'Image generation servers are currently experiencing peak traffic. Please try again in a few moments, or add a free Hugging Face token in Settings for instant dedicated FLUX generation.'
    });
  }
});

// Fallback to index.html for any unhandled routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Express Server
const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Yantra AI Chatbot Server running on http://localhost:${PORT}`);
  console.log(`🤖 Default Gemini Model: ${DEFAULT_MODEL}`);
  console.log(`🔑 API Key Configured: ${process.env.GEMINI_API_KEY ? 'YES (from .env)' : 'NO (awaiting key in settings)'}`);
  console.log(`=======================================================`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});
