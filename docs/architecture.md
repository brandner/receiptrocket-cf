# Architectural Decisions & Context

This document is intended to help future AI assistants (and developers) understand why the codebase is structured this way, primarily to prevent regressions back into the legacy Next.js pattern.

## 1. Why decouple Vite and Hono?
Initially, ReceiptRocket was a Next.js App Router project using Server Actions and Firebase (`firebase-admin`). However, `firebase-admin` heavily relies on Node.js APIs, which often leads to severe compatibility issues when attempting to deploy to Cloudflare Pages (which uses the V8 Edge Runtime). 
To achieve "Cloudflare-nativity" while minimizing edge-case bugs, the project was rewritten into pure Option B: a static Vite SPA (Frontend) and a decoupled Hono Worker (Backend).

## 2. Anonymous UID Authentication
We removed Google OAuth in favor of a low-friction `localStorage` UID approach.
- The `useUID()` hook (`frontend/src/hooks/useUID.ts`) initializes a `crypto.randomUUID()` on first visit.
- This UID is passed in the `X-User-ID` header for every API call.
- The Hono Worker implicitly trusts this UID to query the D1 Database.
- Users can "restore" their session on other devices by viewing their UID in the UI and pasting it locally over there.

## 3. Cloudflare Workers AI
Instead of Genkit or pulling the Google Gemini SDK, the backend uses Cloudflare's native `env.AI.run` binding with the Llama Vision Instruct model. This completely eliminates third-party Node dependencies for image parsing. 
Images are sent to the model with a strict prompt forcing it to return a JSON string. The backend strips markdown formatting, parses the JS object, and inserts it directly into D1 alongside a Cloudflare R2 bucket upload.
