// Ingests files from ./kb into Qdrant as 3072-dim embeddings using OpenAI text-embedding-3-large
import fs from "fs";
import path from "path";
import crypto from "crypto";
import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const qdrant = new QdrantClient({ url: process.env.QDRANT_URL, apiKey: process.env.QDRANT_API_KEY });
const COLLECTION = process.env.QDRANT_COLLECTION || "ssc2";

// Basic filename parser: L{level}_M{module}__Title.md  e.g., L3_M02__Airway_Diagnostics.md
function parseMetaFromFilename(filename) {
  const m = filename.match(/L(\d+)_M(\d+)/i);
  return {
    level: m ? Number(m[1]) : null,
    module: m ? Number(m[2]) : null
  };
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
      vectors: { size: 3072, distance: "Cosine" }
    });
  }
}

async function ingestFile(filePath) {
  const filename = path.basename(filePath);
  const raw = fs.readFileSync(filePath, "utf8");
  const meta = parseMetaFromFilename(filename);
  const chunks = chunkText(raw, 1000, 180);

  console.log(`Embedding ${filename} -> ${chunks.length} chunks`);

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: chunk
    });
    const vector = emb.data[0].embedding;

    const payload = {
      text: chunk,
      source_file: filename,
      ...meta,
      page: null,
      speaker: null,
      timestamp_start: null,
      timestamp_end: null
    };

    await qdrant.upsert(COLLECTION, {
      points: [{
        id: crypto.randomUUID(),
        vector,
        payload
      }]
    });

    if ((idx + 1) % 10 === 0) {
      console.log(`  upserted ${idx + 1}/${chunks.length}`);
    }
  }
}

async function main() {
  await ensureCollection();
  const dir = path.join(process.cwd(), "kb");
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith(".md") || f.endsWith(".txt"))
    .map(f => path.join(dir, f));

  if (!files.length) {
    console.log("No .md or .txt files found in ./kb");
    process.exit(0);
  }

  for (const f of files) {
    await ingestFile(f);
  }

  console.log("Done.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
