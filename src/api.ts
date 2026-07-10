// ───────────────────────────────────────────────────────────────────────────
//  API service — talks to the HCD-AI backend.
//  Ported from the web app's utils/api.ts, utils/auth.tsx and chat/api.ts,
//  using fetch (no axios) so it runs in React Native.
// ───────────────────────────────────────────────────────────────────────────
import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { DEFAULT_DOCUMENT_TYPES, DocumentType } from '../config';

export interface LoginResult {
  access_token: string;
  role: string;
  user_id: number;
  expires_in: number;
}

export interface ChatImage {
  image_id: number;
  image_data: string;
  caption: string;
  document_name: string;
  page_number: number;
  document_id: number;
}

export interface CitationChunk {
  document_id: string;
  file_name: string;
  page_num_within_doc: number;
}

export interface Module {
  program_module_id: string;
  name: string;
}

export interface Program {
  program_id: string;
  program_module_id: string;
  name: string;
}

export type FeedbackType =
  | 'Too Short'
  | 'Too Long'
  | 'Fully Inaccurate'
  | 'Partially Inaccurate'
  | 'Not Clear'
  | 'Not related to my work'
  | 'Irrelevant'
  | 'Incorrect Program Documents Used'
  | 'Bad Translation';

export interface ChatResponseData {
  response_id: number;
  response: string;
  request_id: number;
  chat_id: string;
  original_language?: string;
  response_metadata?: { chunks: Record<string, CitationChunk> };
  images?: ChatImage[];
}

export interface ChatMessage {
  id: number;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
}

/** Normalise the base URL (strip a trailing slash). */
function base(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Build request headers, optionally including the APIM subscription key. */
function apimHeaders(
  token?: string,
  subscriptionKey?: string,
): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (subscriptionKey) h['Ocp-Apim-Subscription-Key'] = subscriptionKey;
  return h;
}

/** POST /login  — multipart form, same as the web app. */
export async function login(
  backendUrl: string,
  username: string,
  password: string,
  subscriptionKey?: string,
): Promise<LoginResult> {
  const form = new FormData();
  form.append('username', username);
  form.append('password', password);

  const headers: Record<string, string> = {};
  if (subscriptionKey) headers['Ocp-Apim-Subscription-Key'] = subscriptionKey;

  const res = await fetch(`${base(backendUrl)}/login`, {
    method: 'POST',
    body: form,
    headers,
    // NOTE: do not set Content-Type — fetch sets the multipart boundary itself.
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail || `Login failed (HTTP ${res.status})`;
    throw { status: res.status, message: detail };
  }
  return data as LoginResult;
}

interface SendChatParams {
  backendUrl: string;
  token: string;
  userId: number;
  message: string;
  chatId: string | null;
  documentTypes?: DocumentType[];
  documentModules?: string[] | null;
  documentPrograms?: string[] | null;
  signal?: AbortSignal;
  subscriptionKey?: string;
}

/** POST /chat/  — returns the AI message. Keeps chat_id for continuation. */
export async function sendChat(params: SendChatParams): Promise<ChatResponseData> {
  const body: Record<string, any> = {
    chat_id: params.chatId,
    document_types: params.documentTypes ?? DEFAULT_DOCUMENT_TYPES,
    user_id: params.userId,
    message: params.message,
  };

  // Add document filters if provided (like web app does)
  if (params.documentModules !== null && params.documentModules !== undefined) {
    body.document_modules = params.documentModules;
  }
  if (params.documentPrograms !== null && params.documentPrograms !== undefined) {
    body.document_programs = params.documentPrograms;
  }

  const res = await fetch(`${base(params.backendUrl)}/chat/`, {
    method: 'POST',
    headers: apimHeaders(params.token, params.subscriptionKey),
    body: JSON.stringify(body),
    signal: params.signal,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail || `Request failed (HTTP ${res.status})`;
    throw { status: res.status, message: detail };
  }
  return data as ChatResponseData;
}

/** POST /feedback/like */
export async function submitLikeFeedback(
  backendUrl: string,
  token: string,
  data: { request_id: number; is_like: boolean },
  subscriptionKey?: string,
): Promise<{ saved_feedback_id: string }> {
  const res = await fetch(`${base(backendUrl)}/feedback/like`, {
    method: 'POST',
    headers: apimHeaders(token, subscriptionKey),
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw { status: res.status, message: json?.detail || 'Feedback failed' };
  return json;
}

/** POST /feedback/categorical */
export async function submitCategoricalFeedback(
  backendUrl: string,
  token: string,
  data: { feedback_id: string; feedback_type_name: string },
  subscriptionKey?: string,
): Promise<void> {
  const res = await fetch(`${base(backendUrl)}/feedback/categorical`, {
    method: 'POST',
    headers: apimHeaders(token, subscriptionKey),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw { status: res.status, message: 'Categorical feedback failed' };
}

/** GET /programs/ — Fetch all programs */
export async function fetchPrograms(
  backendUrl: string,
  token: string,
  subscriptionKey?: string,
): Promise<{ programs: Program[] }> {
  const res = await fetch(`${base(backendUrl)}/programs/`, {
    method: 'GET',
    headers: apimHeaders(token, subscriptionKey),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw { status: res.status, message: json?.detail || 'Failed to fetch programs' };
  return json;
}

/** GET /program-modules/ — Fetch all modules */
export async function fetchProgramModules(
  backendUrl: string,
  token: string,
  subscriptionKey?: string,
): Promise<{ program_modules: Module[] }> {
  const res = await fetch(`${base(backendUrl)}/program-modules/`, {
    method: 'GET',
    headers: apimHeaders(token, subscriptionKey),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw { status: res.status, message: json?.detail || 'Failed to fetch modules' };
  return json;
}

/** POST /chat/text-to-speech — Convert AI response to audio (Amharic/Oromo only) */
export async function synthesizeSpeech(
  backendUrl: string,
  token: string,
  responseId: number,
  languageCode: 'am' | 'om', // kept for call-site type safety; not sent to API
  subscriptionKey?: string,
): Promise<ArrayBuffer> {
  // TTSRequest schema only accepts response_id — no language_code field
  const res = await fetch(`${base(backendUrl)}/chat/text-to-speech`, {
    method: 'POST',
    headers: apimHeaders(token, subscriptionKey),
    body: JSON.stringify({ response_id: responseId }),
  });
  if (!res.ok) throw { status: res.status, message: 'Failed to generate speech' };
  return res.arrayBuffer();
}

/** POST /chat/transcribe — Convert audio to text (Amharic/Oromo) */
export async function transcribeAudio(
  backendUrl: string,
  token: string,
  audioUri: string,
  languageCode: 'am' | 'om',
  subscriptionKey?: string,
): Promise<{ transcript: string }> {
  const headers: Record<string, string> = { 'Authorization': `Bearer ${token}` };
  if (subscriptionKey) headers['Ocp-Apim-Subscription-Key'] = subscriptionKey;

  // Derive MIME candidates from the actual recorded file extension.
  // WAV → server accepts without ffmpeg conversion; M4A → try m4a/mp4/mpeg.
  const ext = audioUri.split('.').pop()?.toLowerCase() ?? '';
  const candidates: string[] = ext === 'wav'
    ? ['audio/wav', 'audio/x-wav']
    : ['audio/m4a', 'audio/mp4', 'audio/mpeg'];

  for (let i = 0; i < candidates.length; i++) {
    const mimeType = candidates[i];
    console.log(`Transcribe attempt ${i + 1}/${candidates.length} — MIME: ${mimeType}`);

    let status: number;
    let rawText: string;

    if (Platform.OS !== 'web') {
      // Native: legacy uploadAsync passes mimeType to the iOS/Android native upload
      // stack, bypassing the JS FormData layer that always reports .m4a files as
      // 'audio/x-m4a'. The new File class API requires a custom dev build; this
      // legacy path works in Expo Go.
      const fileUri = audioUri.startsWith('file://') ? audioUri : `file://${audioUri}`;
      const uploadRes = await uploadAsync(
        `${base(backendUrl)}/chat/transcribe`,
        fileUri,
        {
          httpMethod: 'POST',
          uploadType: FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType,
          parameters: { language_code: languageCode },
          headers,
        },
      );
      status = uploadRes.status;
      rawText = uploadRes.body;
    } else {
      // Web: browsers honour the type on a Blob, so FormData works correctly.
      const formData = new FormData();
      formData.append('file', { uri: audioUri, name: 'audio.mp4', type: mimeType } as any);
      formData.append('language_code', languageCode);
      const res = await fetch(`${base(backendUrl)}/chat/transcribe`, {
        method: 'POST',
        headers,
        body: formData,
      });
      status = res.status;
      rawText = await res.text().catch(() => '');
    }

    console.log(`→ status ${status}, tail:`, rawText.slice(-400));
    // Parse detail for the real ffmpeg error (the header is hundreds of chars)
    try {
      const errDetail = (JSON.parse(rawText) as any).detail ?? '';
      if (errDetail) console.log(`→ detail tail:`, String(errDetail).slice(-600));
    } catch {}

    if (status >= 200 && status < 300) {
      return JSON.parse(rawText) as { transcript: string };
    }

    // Retry on MIME validation failures (500) and conversion failures (422);
    // any other error (auth, network, etc.) is terminal.
    const isRetryable = rawText.includes('Unsupported audio type') ||
      (status === 422 && rawText.includes('conversion failed'));
    if (!isRetryable || i === candidates.length - 1) {
      const detail = rawText.slice(-400) || `HTTP ${status}`;
      throw { status, message: detail };
    }

    console.log(`MIME ${mimeType} rejected, retrying with next candidate…`);
  }

  throw { status: 500, message: 'Failed to transcribe audio' };
}
