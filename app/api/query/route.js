// app/api/query/route.js
import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { SYSTEM_PROMPT } from "../../../lib/prompt";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION = process.env.QDRANT_COLLECTION || "ssc2";

// Optional PHI gate (stays off unless APP_REQUIRE_PHI_FILTER=true)
const REQUIRE_PHI_FILTER =
  (process.env.APP_REQUIRE_PHI_FILTER || "false").toLowerCase() === "true";

function containsPHI(text) {
  const rx =
    /(dob|mrn|ssn|social security|address|phone\s*:\s*\d|patient\s+name|full\s+name)/i;
  return rx.test(text || "");
}

function extractCitationFromPayload(payload = {}) {
  const candidates = [
    payload.source_file,
    payload.source,
    payload.file,
    payload.filename,
    payload.filepath,
    payload.path,
    payload.url,
    payload.name,
    payload.title,
  ].filter((v) => typeof v === "string" && v);

  if (!candidates.length) return null;

  let base = candidates[0].split(/[\\/]/).pop();
  base = base.replace(/\.[^.]+$/, "");

  // Filenames like "205- Fitting A Custom OA"
  let level = null, section = null, title = null;
  const m = base.match(/\b([1-5])([0-9]{2})\b/); // 101..599
  if (m) {
    level = Number(m[1]);
    section = Number(m[2].replace(/^0/, "")) || Number(m[2]);
    const dash = base.indexOf("-");
    if (dash !== -1) {
      title = base.slice(dash + 1).trim();
    }
  }
  if (!level || !section) return null;

  return {
    level,
    section,
    title: title ? title.charAt(0).toUpperCase() + title.slice(1) : null,
  };
}

function buildCitationsFromResults(results = []) {
  const seen = new Set();
  const items = [];
  for (const r of results) {
    const p = r?.payload || {};
    const c = extractCitationFromPayload(p);
    if (!c) continue;
    const key = `L${c.level}-S${c.section}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const label = c.title
      ? `Level ${c.level} section ${c.section} — ${c.title}`
      : `Level ${c.level} section ${c.section}`;
    items.push(label);
    if (items.length >= 6) break; // cap for neatness
  }
  return items;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const question = (body?.question || "").trim();

    // history: [{role:"user"|"assistant", content:"..."}, ...]
    const rawHistory = Array.isArray(body?.history) ? body.history : [];
    // keep last 10 messages (5 turns); drop anything else
    const history = rawHistory.slice(-10).filter(
      (m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant")
    );

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

    // Embed ONLY the current question for retrieval (avoid history leakage)
    const embed = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: question,
    });
    const queryVec = embed.data[0].embedding;

    // Vector search
    const results = await qdrant.search(COLLECTION, {
      vector: queryVec,
      limit: 6,
    });

    // Build human-readable context blocks
    const contextBlocks = results
      .map((r, i) => {
        const p = r.payload || {};
        const labelBits = [];
        if (p.level) labelBits.push(`Level ${p.level}`);
        if (p.section) labelBits.push(`section ${p.section}`);
        const where = labelBits.length ? labelBits.join(" ") : "Source ?";
        const pages =
          p.page != null ? ` p.${p.page}` : p.pages ? ` p.${p.pages}` : "";
        const time =
          p.timestamp_start || p.timestamp_end
            ? ` ${p.timestamp_start ?? ""}-${p.timestamp_end ?? ""}`
            : "";
        return `#${i + 1} [${where}${pages}${time}]\n${p.text ?? ""}`;
      })
      .join("\n\n");

    const citations = buildCitationsFromResults(results);

    // Compose messages: system + limited history + current question with context
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      // history is used for tone/continuity; DO NOT add facts from it
      ...history,
      {
        role: "user",
        content:
`Question:
${question}

Retrieved Context (KB only):
${contextBlocks}

Instructions:
- Use ONLY the retrieved context for facts.
- You may use the prior conversation turns for phrasing and continuity, not for adding new facts.
- Follow the output style from the system prompt.
- If context is insufficient, use the exact fallback line from the system prompt.`,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.2,
    });

    let answer = completion.choices?.[0]?.message?.content || "";

    // Attach friendly citations if we found any
    if (citations.length) {
      const lines = [
        "",
        "Where this lives in SSC",
        ...citations.slice(0, 4).map((c) => `• ${c}`),
        "You can also browse the SSC Library here: https://www.spencerstudyclub.com/library",
      ];
      answer += "\n\n" + lines.join("\n");
    }

    return new Response(JSON.stringify({ answer, citations }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Server error." }), { status: 500 });
  }
}