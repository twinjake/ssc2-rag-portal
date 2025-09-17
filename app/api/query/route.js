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
const REQUIRE_PHI_FILTER =
  (process.env.APP_REQUIRE_PHI_FILTER || "false").toLowerCase() === "true";

function containsPHI(text) {
  const rx =
    /(dob|mrn|ssn|social security|address|phone\s*:\s*\d|patient\s+name|full\s+name)/i;
  return rx.test(text || "");
}

/** ------------------------------
 * Build citations from CURRENT results
 * ------------------------------ */
function buildCitations(results = []) {
  const seen = new Set();
  const list = [];

  for (const hit of results) {
    const p = hit?.payload || hit?.point?.payload || {};
    const L = Number(p.level || p?.metadata?.level || p?.meta?.level);
    const S =
      Number(p.section || p.module || p?.metadata?.section || p?.meta?.section);
    if (!L || !S) continue;
    const key = `L${L}-S${S}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const t = (p.title || p?.metadata?.title || p?.meta?.title || "").toString().trim();
    list.push(t ? `Level ${L} section ${S} — ${t}` : `Level ${L} section ${S}`);
  }

  return list;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const question = (body?.question || "").trim();

    if (!question) {
      return new Response(JSON.stringify({ error: "Question is required." }), {
        status: 400,
      });
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

    // 1) Embed
    const embed = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: question,
    });
    const queryVec = embed.data[0].embedding;

    // 2) Search
    const results = await qdrant.search(COLLECTION, {
      vector: queryVec,
      limit: 6,
    });

    // 3) Context blocks with Level/Section/Title when available
    const contextBlocks = results
      .map((r, i) => {
        const p = r?.payload || r?.point?.payload || {};
        const L =
          p.level ??
          p?.metadata?.level ??
          p?.meta?.level ??
          "?";
        const S =
          p.section ??
          p.module ??
          p?.metadata?.section ??
          p?.meta?.section ??
          "?";
        const title =
          p.title ??
          p?.metadata?.title ??
          p?.meta?.title ??
          "";
        const tsStart = p.timestamp_start ?? "";
        const tsEnd = p.timestamp_end ?? "";
        const page = p.page ?? "";
        const text = p.text ?? p.content ?? "";

        const header = title
          ? `Level ${L} section ${S} — ${title}`
          : `Level ${L} section ${S}`;

        return `#${i + 1} [${header} ${tsStart}${tsEnd ? "-" + tsEnd : ""} p.${page}]
${text}`;
      })
      .join("\n\n");

    // 4) Per-request CITATIONS (with titles when present)
    const citList = buildCitations(results);
    const citationsBlock = citList.length
      ? citList.map((c) => `- ${c}`).join("\n")
      : "(none)";

    // 5) Compose
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Question:
${question}

Retrieved Context:
${contextBlocks}

CITATIONS (only cite items from this list; do NOT add page numbers):
${citationsBlock}

Instructions:
- Use ONLY the context above.
- Follow the output format exactly.
- If context is insufficient, use the required fallback line from the system prompt.`,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.2,
    });

    const answer = completion.choices?.[0]?.message?.content || "";

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
