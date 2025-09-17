# SSC 2.0 – Doctor Portal (Path A Starter)

Private, **education-only** Q&A for Spencer Study Club 2.0.
- Auth: Clerk (email allowlist)
- Host: Vercel (free Hobby)
- Vectors: Qdrant Cloud (free 1GB)
- LLM: OpenAI GPT-4o mini (cheap, pay-as-you-go)

> **Important:** This tool is **education-only. Not medical advice.** Do not paste PHI.

---

## 0) What you need
- A computer with internet
- A GitHub account (free)
- Your SSC 2.0 transcripts as `.md` or `.txt`

---

## 1) Create accounts (all free to start)
1. **OpenAI API** – get an API key  
   https://platform.openai.com  
2. **Vercel** – hosting  
   https://vercel.com/signup  
3. **Clerk** – authentication  
   https://clerk.com  
4. **Qdrant Cloud** – vector database (1GB free)  
   https://cloud.qdrant.io

---

## 2) Get your keys
- From **OpenAI**: `OPENAI_API_KEY`
- From **Clerk**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
- From **Qdrant Cloud**: `QDRANT_URL` and `QDRANT_API_KEY`

---

## 3) Put keys in `.env.local`
Copy `.env.example` to `.env.local` and fill in the values.

---

## 4) Add your knowledge base
- Put your SSC files in the `./kb` folder.
- Optional: name files like `L3_M02__Topic.md` so level/module are auto-tagged.

---

## 5) Ingest (first index of your KB)
Install Node.js (https://nodejs.org), then in a terminal:

```bash
# inside the project folder
npm install
npm run ingest
```

This creates a Qdrant collection and uploads embeddings.

---

## 6) Run locally (optional)
```bash
npm run dev
```
Open http://localhost:3000 and sign in.

---

## 7) Deploy to Vercel
- Push this folder to a GitHub repo
- In Vercel: **New Project → Import** your repo
- Add the same environment variables in Vercel
- Deploy

---

## Guardrails
- System prompt blocks patient-specific advice and asks for module-based citations.
- Footer shows **Education-only. Not medical advice.**
- Basic PHI keyword screen on input.

---

## Notes
- Qdrant collection vector size is set to **3072** (OpenAI `text-embedding-3-large`).
- You can re-run `npm run ingest` anytime after adding/updating files in `./kb`.
