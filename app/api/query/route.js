// app/api/query/route.js  — Hybrid Search + Cohere Re-ranking
import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { SYSTEM_PROMPT } from "../../../lib/prompt";
import { auth, clerkClient } from "@clerk/nextjs/server";

export const runtime = "nodejs";

// --- clients ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION = process.env.QDRANT_COLLECTION || "ssc2-hybrid";
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const FREE_LIMIT = 3;

const REQUIRE_PHI_FILTER =
  (process.env.APP_REQUIRE_PHI_FILTER || "false").toLowerCase() === "true";

// ----------------- helpers -----------------
function containsPHI(text) {
  const rx =
    /(dob|mrn|ssn|social security|address|phone\s*:\s*\d|patient\s+name|full\s+name)/i;
  return rx.test(text || "");
}

function extractCitationFromPayload(payload = {}) {
  const candidates = [
    payload.source,
    payload.file,
    payload.filename,
    payload.filepath,
    payload.path,
    payload.url,
    payload.name,
    payload.title,
    payload.source_file,
  ].filter((v) => typeof v === "string" && v);

  if (!candidates.length) return null;

  const raw = candidates[0].split(/[\\/]/).pop();
  let base = raw.replace(/\.[^.]+$/, "");

  const m = base.match(/\b([1-4])([0-9]{2})\b\s*-\s*(.+)$/);
  if (m) {
    const level = Number(m[1]);
    const section = Number(m[2].replace(/^0/, "")) || Number(m[2]);
    const title = m[3].trim();
    return { level, section, title };
  }

  let level = null, section = null;
  let m2 =
    base.match(/level\s*([1-9])\D*section\s*([0-9]{1,2})/i) ||
    base.match(/\bL\s*([1-9])\D*S\s*([0-9]{1,2})\b/i);

  if (m2) {
    level = Number(m2[1]);
    section = Number(m2[2]);
  } else {
    const m3 = base.match(/\b([1-4])([0-9]{2})\b/);
    if (m3) {
      level = Number(m3[1]);
      section = Number(m3[2].replace(/^0/, "")) || Number(m3[2]);
    }
  }

  if (!level || !section) return null;

  let title = base
    .replace(/level\s*[1-9]\s*section\s*[0-9]{1,2}/i, "")
    .replace(/\bL\s*[1-9]\s*S\s*[0-9]{1,2}\b/i, "")
    .replace(/\b[1-4][0-9]{2}\b/, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\b(ssc|v?2\.?0?|module|kb|notes|doc|lecture|part|section)\b/gi, "")
    .trim()
    .replace(/\s{2,}/g, " ");

  if (title) title = title.charAt(0).toUpperCase() + title.slice(1);
  return { level, section, title };
}

function buildCitationsFromResults(results = []) {
  const seen = new Set();
  const items = [];
  for (const r of results) {
    const payload = r?.payload || r;
    const c = extractCitationFromPayload(payload);
    if (!c) continue;
    const key = `L${c.level}-S${c.section}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const label = c.title
      ? `Level ${c.level} section ${c.section} — ${c.title}`
      : `Level ${c.level} section ${c.section}`;
    items.push(label);
  }
  return items;
}

function sanitizeHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];
  const allowed = rawHistory
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
    .slice(-10);

  const MAX_CHARS = 8000;
  let total = 0;
  const clipped = [];
  for (let i = Math.max(0, allowed.length - 10); i < allowed.length; i++) {
    const msg = { ...allowed[i] };
    if (total + msg.content.length > MAX_CHARS) break;
    clipped.push(msg);
    total += msg.content.length;
  }
  return clipped;
}

// Build sparse BM25 vector from text (same algorithm as ingestion)
function buildSparseVector(text) {
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  const tf = {};
  for (const word of words) {
    tf[word] = (tf[word] || 0) + 1;
  }

  const indices = [];
  const values = [];

  for (const [word, count] of Object.entries(tf)) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % 30000;
    const tfScore = count / words.length;

    if (!indices.includes(idx)) {
      indices.push(idx);
      values.push(tfScore);
    }
  }

  return { indices, values };
}

// Cohere re-ranking
async function rerankWithCohere(query, documents, topN = 8) {
  if (!COHERE_API_KEY || documents.length === 0) return documents.slice(0, topN);

  try {
    const response = await fetch("https://api.cohere.com/v2/rerank", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${COHERE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "rerank-english-v3.0",
        query,
        documents: documents.map(d => d.payload?.text || ""),
        top_n: topN,
        return_documents: false,
      }),
    });

    if (!response.ok) {
      console.error("Cohere rerank error:", response.status, await response.text());
      return documents.slice(0, topN);
    }

    const data = await response.json();
    return data.results.map(r => documents[r.index]);
  } catch (e) {
    console.error("Cohere rerank exception:", e.message);
    return documents.slice(0, topN);
  }
}

// ----------------- handler -----------------
export async function POST(req) {
  try {
    // --- Auth check ---
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Not authenticated." }), { status: 401 });
    }

    // --- Plan / usage check ---
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const meta = user.publicMetadata || {};
    const plan = meta.plan || "free_trial";
    const chatCount = Number(meta.chatCount) || 0;

    if (plan === "free_trial" && chatCount >= FREE_LIMIT) {
      return new Response(
        JSON.stringify({
          error: "free_limit_reached",
          message: `You have used all ${FREE_LIMIT} free chats. Please subscribe to continue.`,
        }),
        { status: 402 }
      );
    }

    const body = await req.json();
    const question = (body?.question || "").trim();
    const history = sanitizeHistory(body?.history);

    if (!question) {
      return new Response(JSON.stringify({ error: "Question is required." }), { status: 400 });
    }

    if (REQUIRE_PHI_FILTER && containsPHI(question)) {
      return new Response(
        JSON.stringify({
          error: "Please remove PHI. This endpoint is not configured to accept PHI.",
        }),
        { status: 400 }
      );
    }

    // ---- Embed the question (dense vector) ----
    const embed = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: question,
    });
    const queryVec = embed.data[0].embedding;

    // ---- Build sparse vector for BM25 keyword search ----
    const sparseVec = buildSparseVector(question);

    // ---- Hybrid search: dense + sparse in parallel ----
    const [denseResults, sparseResults] = await Promise.all([
      // Dense semantic search
      qdrant.search(COLLECTION, {
        vector: { name: "dense", vector: queryVec },
        limit: 20,
        with_payload: true,
      }).catch(e => {
        console.error("Dense search error:", e.message);
        return [];
      }),
      // Sparse BM25 keyword search
      qdrant.search(COLLECTION, {
        vector: {
          name: "sparse",
          vector: { indices: sparseVec.indices, values: sparseVec.values },
        },
        limit: 20,
        with_payload: true,
      }).catch(e => {
        console.error("Sparse search error:", e.message);
        return [];
      }),
    ]);

    // ---- Reciprocal Rank Fusion (RRF) to merge results ----
    const k = 60; // RRF constant
    const scoreMap = new Map();
    const payloadMap = new Map();

    const addRRF = (results, weight = 1) => {
      results.forEach((r, rank) => {
        const id = String(r.id);
        const prev = scoreMap.get(id) || 0;
        scoreMap.set(id, prev + weight * (1 / (k + rank + 1)));
        if (!payloadMap.has(id)) payloadMap.set(id, r);
      });
    };

    addRRF(denseResults, 1.0);
    addRRF(sparseResults, 1.0);

    // Sort by RRF score and take top 25 candidates for re-ranking
    const candidates = Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([id]) => payloadMap.get(id));

    // ---- Cohere re-ranking ----
    const reranked = await rerankWithCohere(question, candidates, 8);

    // ---- Build context blocks ----
    const contextBlocks = reranked
      .map((r, i) => {
        const p = r.payload || {};
        const citation = extractCitationFromPayload(p);
        const header = citation
          ? `Level ${citation.level} section ${citation.section}${
              citation.title ? ` — ${citation.title}` : ""
            }`
          : `Level ${p.level ?? "?"} section ${p.module ?? "?"}`;
        const page = p.page ? ` p.${p.page}` : "";
        const ts =
          p.timestamp_start || p.timestamp_end
            ? ` ${p.timestamp_start ?? ""}-${p.timestamp_end ?? ""}`
            : "";
        return `#${i + 1} [${header}${ts}${page}]\n${p.text ?? ""}`;
      })
      .join("\n\n");

    // Build CITATIONS block from re-ranked results
    const friendlyCites = buildCitationsFromResults(reranked);
    const citationsBlock = friendlyCites.length
      ? friendlyCites.map((c) => `- ${c}`).join("\n")
      : "(none)";

    const priorTurns = history.map((m) => ({ role: m.role, content: m.content }));

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...priorTurns,
      {
        role: "user",
        content:
          `Question:\n${question}\n\n` +
          `Retrieved Context (use ONLY this material; do not rely on general knowledge):\n${contextBlocks}\n\n` +
          `CITATIONS:\n${citationsBlock}\n\n` +
          `Instructions:\n` +
          `- Answer the question using ONLY the retrieved context above. Speak naturally as Dr. Spencer.\n` +
          `- Do NOT add information from general medical knowledge that is not in the context.\n` +
          `- Only use the fallback line if the retrieved context has absolutely no relevant information.\n` +
          `- If the context is even partially relevant, use it to give the best answer you can.\n` +
          `- End your response with the "## Where this lives in SSC" section using only the CITATIONS list above.`,
      },
    ];

    // ---- Generate answer ----
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.3,
    });

    const answer = completion.choices?.[0]?.message?.content || "";

    // ---- Increment chat count ----
    const newCount = chatCount + 1;
    const lastChat = new Date().toISOString();
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...meta,
        chatCount: newCount,
        lastChat,
      },
    });

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error." }), { status: 500 });
  }
}
