---
name: cibertron-bot-chat
description: "Project structure for Cibertron ChatBots - a Transformers-themed AI chat app (Megatron/Optimus Prime personas) using Gemini/Groq/Grok/Cerebras providers, Supabase persistence, and web search."
type: project
---

## Deployment Architecture

**Backend** (Render): Express API server with IA providers (Gemini, Groq, Grok, Cerebras), web search (DuckDuckGo/Brave), Supabase persistence. CORS configured for Vercel frontend.

**Frontend** (Vercel): React + Vite + Tailwind SPA. Calls backend via `VITE_API_URL`. No server-side code. All env vars prefixed with `VITE_`.

## Folder Structure

```
cibertron-chatbots/
├── backend/
│   ├── server.ts              # Express server (API-only, no static file serving)
│   ├── package.json            # Server deps only
│   ├── tsconfig.json
│   ├── .env                    # GEMINI_API_KEY, GROQ_API_KEY, CEREBRAS_API_KEY, etc.
│   └── src/
│       └── lib/
│           └── webSearch.ts    # DuckDuckGo/Brave search (server-side)
│
├── frontend/
│   ├── index.html
│   ├── package.json            # React/UI deps only
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── vercel.json             # SPA fallback config
│   ├── public/
│   │   ├── logo.png
│   │   └── logo.svg
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── types.ts
│       ├── vite-env.d.ts
│       ├── assets/
│       │   └── logo.png
│       ├── components/
│       │   ├── AudioWaveform.tsx
│       │   └── ProviderSelector.tsx
│       ├── helper/
│       │   ├── loadingMessages.ts
│       │   └── quickPromts.ts
│       ├── hooks/
│       │   └── useSupabaseSync.ts
│       └── lib/
│           └── deviceId.ts
│
└── supabase/
    └── migrations/
        ├── 001_schema.sql
        ├── 002_rls_policies.sql
        └── 003_profiles.sql
```

## Key Changes Made

1. **server.ts**: Added CORS middleware, removed static file serving for frontend in production. Import `webSearch` adjusted.
2. **App.tsx**: Changed `fetch("/api/chat")` to use `import.meta.env.VITE_API_URL` as base.
3. **useSupabaseSync.ts**: Changed `API_BASE = ""` to use `import.meta.env.VITE_API_URL`.
4. **Frontend package.json**: Only React/Vite/MUI/Tailwind deps. Removed Express/dotenv/esbuild/tsx.
5. **Backend package.json**: Only Express/Supabase/OpenAI/GoogleGenAI deps. No React/Vite/UI.

Why: Monolith was deployed as a single unit. Render handles backend API, Vercel handles frontend SPA. CORS needed because they're on different domains.
