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
// Default OFF per your request. Set APP_REQUIRE_PHI_FILTER=true to re-enable.
const REQUIRE_PHI_FILTER =
  (process.env.APP_REQUIRE_PHI_FILTER || "false").toLowerCase() === "true";

function containsPHI(text) {
  // Very basic placeholder — safe to delete entirely if you never want PHI checks
  const rx =
    /(dob|mrn|ssn|social security|address|phone\s*:\s*\d|patient\s+name|full\s+name)/i;
  return rx.test(text || "");
}

export async function POST(req) {
  try {
    const body = await req.json();
    const question = (body?.question || "").trim();

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

    // Embed the question
    const embed = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: question,
    });
    const queryVec = embed.data[0].embedding;

    // Vector search in Qdrant
    const results = await qdrant.search(COLLECTION, {
      vector: queryVec,
      limit: 6,
    });

    const contextBlocks = results
      .map((r, i) => {
        const p = r.payload || {};
        return `#${i + 1} [Level ${p.level ?? "?"} section ${
          p.module ?? "?"
        } ${p.timestamp_start ?? ""}-${p.timestamp_end ?? ""} p.${
          p.page ?? ""
        }]
${p.text ?? ""}`;
      })
      .join("\n\n");

    // Compose completion
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Question:\n${question}\n\nRetrieved Context:\n${contextBlocks}\n\nInstructions:\n- Use ONLY the context.\n- Follow the output format exactly.\n- If context is insufficient, follow the fallback rule in the system prompt.`,
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
