// ───────────────────────────────────────────────────────────────────────────
//  APP CONFIG  —  point the mobile app at your HCD-AI backend.
//
//  Default is the public dev server, reachable from the phone over the
//  internet. Endpoints derived from this base:
//      login →  <base>/login
//      chat  →  <base>/chat/
//
//  For a LOCAL backend, the phone CANNOT reach "localhost" — use your PC's
//  LAN IP instead (e.g. http://192.168.1.6:8000).
//
//  You can also change this live on the phone via the login "Server settings".
// ───────────────────────────────────────────────────────────────────────────

export const DEFAULT_BACKEND_URL = 'https://dev.hepassistai.org/api';

// Shown in the greeting before the user logs in.
export const APP_NAME = 'Hawa AI';

// Document scope sent with each chat request (mirrors the web app default).
// 'primary' only, or include 'secondary' for broader reference material.
export const DEFAULT_DOCUMENT_TYPES: DocumentType[] = ['primary'];

export type DocumentType = 'primary' | 'secondary';
