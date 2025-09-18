// app/api/query/route.js
import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { SYSTEM_PROMPT } from "../../../lib/prompt";

export const runtime = "nodejs";

// --- clients ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION = process.env.QDRANT_COLLECTION || "ssc2";

// Toggle PHI check via env: APP_REQUIRE_PHI_FILTER=true
const REQUIRE_PHI_FILTER =
  (process.env.APP_REQUIRE_PHI_FILTER || "false").toLowerCase() === "true";

// ----------------- helpers -----------------
function containsPHI(text) {
  // trivial placeholder — keep or remove per your needs
  const rx =
    /(dob|mrn|ssn|social security|address|phone\s*:\s*\d|patient\s+name|full\s+name)/i;
  return rx.test(text || "");
}

// Try to pull "Level X section Y — Optional Title" from payload filename/fields
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

  // e.g. "101- Anatomy Review Part 1" or "319- Regenerative TMD"
  const raw = candidates[0].split(/[\\/]/).pop();
  let base = raw.replace(/\.[^.]+$/, "");

  // Match "XYZ- Title" where XYZ is 3 digits => Level X, Section YZ
  const m = base.match(/\b([1-4])([0-9]{2})\b\s*-\s*(.+)$/);
  if (m) {
    const level = Number(m[1]);
    const section = Number(m[2].replace(/^0/, "")) || Number(m[2]);
    const title = m[3].trim();
    return { level, section, title };
  }

  // Fallbacks: "Level 2 section 5" / "L2 S5" / "205"
  let level = null,
    section = null;

  let m2 =
    base.match(/level\s*([1-9])\D*section\s*([0-9]{1,2})/i) ||
    base.match(/\bL\s*([1-9])\D*S\s*([0-9]{1,2})\b/i);

  if (m2) {
    level = Number(m2[1]);
    section = Number(m2[2]);
  } else {
    const m3 = base.match(/\b([1-4])([0-9]{2})\b/); // e.g., 205/301
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

// Trim history payload for safety (size + roles)
function sanitizeHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];
  const allowed = rawHistory
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
    .slice(-10); // last 5 turns (10 messages)

  // soft token/char guard
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

// ----------------- handler -----------------
export async function POST(req) {
  try {
    const body = await req.json();
    const question = (body?.question || "").trim();
    const history = sanitizeHistory(body?.history);

    if (!question) {
      return new Response(
        JSON.stringify({ error: "Question is required." }),
        { status: 400 }
      );
    }

    if (REQUIRE_PHI_FILTER && containsPHI(question)) {
      return new Response(
        JSON.stringify({
          error:
            "Please remove PHI. This endpoint is not configured to accept PHI.",
        }),
        { status: 400 }
      );
    }

    // ---- Embed the question ----
    const embed = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: question,
    });
    const queryVec = embed.data[0].embedding;

    // ---- Vector search in Qdrant ----
    const results = await qdrant.search(COLLECTION, {
      vector: queryVec,
      limit: 6,
    });

    // ---- Build context blocks (what the model is allowed to use) ----
    const contextBlocks = results
      .map((r, i) => {
        const p = r.payload || {};
        // Try to expose level/section derived from filename
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

        return `#${i + 1} [${header}${ts}${page}]
${p.text ?? ""}`;
      })
      .join("\n\n");

    // ---- Conversational history (for continuity only) ----
    // We feed it as prior turns; SYSTEM_PROMPT still forbids using anything beyond provided context.
    const priorTurns = history.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // ---- Compose final messages ----
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      // prior chat (user/assistant pairs), most recent last
      ...priorTurns,
      // current user question with explicit context bundle
      {
        role: "user",
        content:
          `Question:\n${question}\n\n` +
          `Retrieved Context (use ONLY this material; do not rely on memory):\n${contextBlocks}\n\n` +
          `Instructions:\n` +
          `- Use ONLY the retrieved context when giving facts.\n` +
          `- Keep the tone and format per the system prompt.\n` +
          `- If the context is insufficient, follow the exact fallback line from the system prompt.`,
      },
    ];

    // ---- Generate answer ----
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.2,
    });

    let answer = completion.choices?.[0]?.message?.content || "";

    // (Optional) Append conversational citations in a friendly way
    const friendlyCites = buildCitationsFromResults(results);
    if (friendlyCites.length) {
      const list = friendlyCites.map((c) => `- ${c}`).join("\n");
      answer +=
        `\n\nWhere this lives in SSC\n` +
        `This information can be found in:\n${list}\n` +
        `You can browse the SSC Library here: https://www.spencerstudyclub.com/library`;
    }

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error." }), {
      status: 500,
    });
  }
}
