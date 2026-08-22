# 🎙️ Scribe.txt — AI Speech-to-Text Transcription Platform

> **Turn any video, podcast, or audio clip into clean, timestamped transcripts in seconds.**  
> Powered by **100% Local On-Device Whisper AI** for free private transcriptions and **Official OpenAI Whisper Cloud AI (`whisper-1`)** for Pro members.

---

## ✨ Features

- **🔒 100% Local On-Device Whisper AI**:
  - Transcribe audio/video directly in the browser via WebAssembly & WebAudio.
  - **Zero API costs & 100% Privacy** — audio data never leaves the user's computer.
  - 7 free transcriptions daily for all users.
- **⚡ OpenAI Whisper Cloud AI (Pro Feature)**:
  - Powered by official OpenAI `whisper-1` model with priority queue and 99%+ accuracy.
  - Unlimited daily transcriptions for active Pro & Team subscribers.
- **🌐 99+ Languages & Auto-Detection**:
  - Supports English, Hindi, Spanish, French, German, Japanese, Chinese, Russian, Arabic, and dozens of regional languages.
- **🔗 Paste Links & Direct Uploads**:
  - Direct upload for `.mp4`, `.mov`, `.mp3`, `.wav`, and `.m4a` files up to 500MB.
  - Instant transcription for **YouTube videos/Shorts** and **Instagram Reels**.
- **📑 Multi-Format Exports**:
  - Export transcriptions with one click as **`.txt`**, **`.srt`** (Subtitles), or **`.vtt`** (Web Subtitles).
- **💳 UPI Payments & Admin Manual Review**:
  - Native Indian UPI payments via GPay, PhonePe, Paytm, BHIM, or QR Code.
  - Secure 12-digit UTR bank verification queue in the Admin Dashboard to eliminate fraudulent submissions.
- **🔐 Authentication**:
  - Email/Password login and 1-click **Google OAuth** authentication with Supabase.
- **🛠️ Comprehensive Admin Suite**:
  - Admin Overview (`/admin/overview`), Subscriptions & UPI Queue (`/admin/subscriptions`), Jobs Monitoring (`/admin/jobs`), and System Health Checks (`/admin/health`).

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, React Server Components & API routes)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: Neo-Brutalism design system with Tailwind CSS & custom CSS variables
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL database, Auth, Storage) & [Prisma ORM](https://www.prisma.io/)
- **AI Engines**:
  - **Cloud**: [Groq Whisper](https://console.groq.com/) (`whisper-large-v3-turbo`, `whisper-large-v3`) & [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text) (`whisper-1`)
  - **Local**: [@xenova/transformers](https://huggingface.co/docs/transformers.js) (`Xenova/whisper-tiny` multilingual)
- **Background Jobs**: [Inngest](https://www.inngest.com/)

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/prateekfx7/script.txt.git
cd script.txt/scribe-txt
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create a `.env.local` file in the `scribe-txt` root directory:

```bash
cp .env.local.example .env.local
```

Fill in your configuration:

```env
# ── Supabase ─────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
DATABASE_URL=postgresql://postgres.your-project:password@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# ── Groq Whisper (Lightning-Fast Cloud AI) ──────────────────────────────────
# Get your free API key at https://console.groq.com/keys
GROQ_API_KEY=gsk_...
WHISPER_MODEL=whisper-large-v3-turbo
TRANSCRIBE_API_BASE_URL=https://api.groq.com/openai/v1

# ── Inngest (Background Task Queue) ──────────────────────────────────────────
INNGEST_EVENT_KEY=your-inngest-event-key
INNGEST_SIGNING_KEY=your-inngest-signing-key

# ── App URL ──────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Push Database Schema
```bash
npx prisma db push
```

### 5. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Deploying to Vercel

1. Push your code to your GitHub repository.
2. Import the project into [Vercel](https://vercel.com).
3. Set the **Root Directory** to `scribe-txt`.
4. In **Project Settings → Environment Variables**, add the environment variables listed in `.env.local.example`.
5. Deploy! 🎉

---

## 📂 Project Structure

```text
scribe-txt/
├── public/                 # Fonts, sticker assets, static files
├── src/
│   ├── app/
│   │   ├── admin/          # Admin Dashboard (Subscriptions, Jobs, Health, Users)
│   │   ├── api/            # API Endpoints (transcribe-file, transcribe-link, verify-payment)
│   │   ├── auth/           # OAuth callback handler
│   │   ├── login/          # Login & Signup page with Google OAuth
│   │   ├── transcript/[id] # Transcript viewer & multi-format export
│   │   └── page.tsx        # Landing page
│   ├── components/
│   │   └── landing/        # Dropzone, Hero, Pricing, AudioVisualizer, FAQ
│   ├── lib/
│   │   ├── browserTranscribe.ts # 100% Local On-Device Whisper AI
│   │   ├── transcribe.ts        # OpenAI Whisper API cloud handler
│   │   ├── usageTracker.ts      # Daily quota tracking (7 free/day)
│   │   ├── webAudio.ts          # 16kHz audio decoding helper
│   │   └── supabase.ts          # Supabase client & admin instances
│   └── prisma/
│       └── schema.prisma   # PostgreSQL database schema
├── .env.local.example      # Environment variables template
└── README.md
```

---

## 📄 License & Credits

Built with ❤️ by [Prateek Maurya](https://prateekfxportfolio.vercel.app/).  
Licensed under the [MIT License](LICENSE).
