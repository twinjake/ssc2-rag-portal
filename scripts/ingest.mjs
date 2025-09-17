// scripts/ingest.mjs
// Ingests files from ./kb into Qdrant as 3072-dim embeddings using OpenAI text-embedding-3-large
import fs from "fs";
import path from "path";
import crypto from "crypto";
import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});
const COLLECTION = process.env.QDRANT_COLLECTION || "ssc2";

/**
 * Parse Level/Section/Title from filename.
 * Supports:
 *   - "101- Anatomy Review Part 1"  => L1 S01, title "Anatomy Review Part 1"
 *   - "319- Regenerative TMD"       => L3 S19, title "Regenerative TMD"
 * Also supports older patterns (L2_S5, L2-M05, 205, "Level 2 section 5").
 */
function parseMetaFromFilename(name = "") {
  const base = name.split(/[\\/]/).pop().replace(/\.[^.]+$/, "").trim();

  // New preferred pattern: d dd - Title
  // e.g., 101- Something, 319 - Title
  let m = base.match(/^([1-4])(\d{2})\s*[-–]\s*(.+)$/);
  if (m) {
    const level = Number(m[1]);
    const section = Number(m[2].replace(/^0/, "")) || Number(m[2]);
    const title = m[3].trim();
    return { level, section, title };
  }

  // Lx_Syy / Lx-Myy / Lx Syy
  let m2 =
    base.match(/\bL\s*([1-4])\s*[\-_ ]\s*S\s*([0-9]{1,2})\b/i) ||
    base.match(/\bL\s*([1-4])\s*[\-_ ]\s*M\s*([0-9]{1,2})\b/i);
  if (m2) {
    const level = Number(m2[1]);
    const section = Number(m2[2].replace(/^0/, "")) || Number(m2[2]);
    const title = base
      .replace(m2[0], "")
      .replace(/[_\-]+/g, " ")
      .replace(/\b(ssc|v?2\.?0?|module|kb|notes|doc|lecture|part|section)\b/gi, "")
      .trim();
    return { level, section, title };
  }

  // Compact 205 / 301 / 110
  const m3 = base.match(/\b([1-4])([0-9]{2})\b/);
  if (m3) {
    const level = Number(m3[1]);
    const section = Number(m3[2].replace(/^0/, "")) || Number(m3[2]);
    const title = base
      .replace(m3[0], "")
      .replace(/^[\s\-–:]+/, "")
      .trim();
    return { level, section, title };
  }

  // Textual: "Level 2 section 5"
  const m4 = base.match(/level\s*([1-4])\D*section\s*([0-9]{1,2})/i);
  if (m4) {
    const level = Number(m4[1]);
    const section = Number(m4[2]);
    const title = base
      .replace(m4[0], "")
      .replace(/^[\s\-–:]+/, "")
      .trim();
    return { level, section, title };
  }

  return { level: null, section: null, title: "" };
}

function chunkText(text, size = 1000, overlap = 180) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += (size - overlap)) {
    const part = words.slice(i, i + size).join(" ");
    if (part.trim()) chunks.push(part.trim());
    if (i + size >= words.length) break;
  }
  return chunks;
}

async function ensureCollection() {
  try {
    await qdrant.getCollection(COLLECTION);
    console.log("Collection exists:", COLLECTION);
  } catch {
    console.log("Creating collection:", COLLECTION);
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: 3072, distance: "Cosine" },
    });
  }
}

async function ingestFile(filePath) {
  const filename = path.basename(filePath);
  const raw = fs.readFileSync(filePath, "utf8");
  const { level, section, title } = parseMetaFromFilename(filename);
  const chunks = chunkText(raw, 1000, 180);

  console.log(
    `Embedding ${filename} -> ${chunks.length} chunks (Level ${level ?? "?"}, Section ${section ?? "?"}, Title "${title || "—"}")`
  );

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];

    const emb = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: chunk,
    });
    const vector = emb.data[0].embedding;

    const payload = {
      text: chunk,
      // canonical filename + easy-to-read fields for the router
      filename,
      level: level ?? null,
      section: section ?? null,
      module: section ?? null, // backward-compat with older code that reads "module"
      title: title || null,
      // optional extras
      page: null,
      speaker: null,
      timestamp_start: null,
      timestamp_end: null,
    };

    await qdrant.upsert(COLLECTION, {
      points: [
        {
          id: crypto.randomUUID(),
          vector,
          payload,
        },
      ],
    });

    if ((idx + 1) % 10 === 0) {
      console.log(`  upserted ${idx + 1}/${chunks.length}`);
    }
  }
}

async function main() {
  await ensureCollection();
  const dir = path.join(process.cwd(), "kb");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") || f.endsWith(".txt"))
    .map((f) => path.join(dir, f));

  if (!files.length) {
    console.log("No .md or .txt files found in ./kb");
    process.exit(0);
  }

  for (const f of files) {
    await ingestFile(f);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
