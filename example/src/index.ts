import { createDbWorker } from "sql.js-httpvfs";

const workerUrl = new URL(
  "sql.js-httpvfs/dist/sqlite.worker.js",
  import.meta.url
);
const wasmUrl = new URL("sql.js-httpvfs/dist/sql-wasm.wasm", import.meta.url);

async function load() {
  const worker = await createDbWorker(
    [
      {
        from: "inline",
        config: {
          serverMode: "full",
          // url: process.env.NODE_ENV === "development" ? "/example.sqlite3" : "/sql.js-httpvfs/example.sqlite3",
          url: "/sql.js-httpvfs/example.sqlite3",
          requestChunkSize: 4096,
        },
      },
    ],
    workerUrl.toString(),
    wasmUrl.toString()
  );

  await worker.db.query(`select * from sqlite_master`) // cache the main pages

  // get the vector from the url
  const searchParams = new URLSearchParams(window.location.search)
  const vectorBeingVectorLookup = JSON.parse(searchParams.get('vector') || '[1, 2, 3]');

  // create a sqlite function that calculates the cosine similarity between two vectors
  await worker.worker.evalCode(`
  function cosineSimilarity(input) {
    const vec1 = JSON.parse(input);
    const vec2 = ${JSON.stringify(vectorBeingVectorLookup)};
    const dotProduct = vec1.reduce((sum, a, i) => sum + a * vec2[i], 0);
    const magnitudeVec1 = Math.sqrt(vec1.reduce((sum, a) => sum + a * a, 0));
    const magnitudeVec2 = Math.sqrt(vec2.reduce((sum, b) => sum + b * b, 0));
    const similarity = dotProduct / (magnitudeVec1 * magnitudeVec2);
    return similarity;
  }
  await db.create_function("cosine_similarity", cosineSimilarity)`)

  // find the most similar vectors
  const result = await worker.db.query(`
  select vector, cosine_similarity("vector") as cosine from Vectors
    order by cosine desc limit 3;
`)

  document.body.textContent = JSON.stringify(result);
}

load();
