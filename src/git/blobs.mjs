import { git, SetupError } from "./commands.mjs";

// Leave headroom below Git's 64 MiB output limit for batch headers.
const batchBytes = 16 * 1024 * 1024;

function blobInfo(repo, hashes) {
  if (hashes.some((hash) => !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(hash)))
    throw new SetupError("Expected full Git blob hashes");
  const lines = git(repo, ["cat-file", "--batch-check"], {
    input: hashes.join("\n") + "\n",
  })
    .trimEnd()
    .split("\n");
  if (lines.length !== hashes.length)
    throw new SetupError("Incomplete Git blob metadata");
  return lines.map((line, index) => {
    const match = /^([a-f0-9]+) blob (\d+)$/u.exec(line);
    const size = Number(match?.[2]);
    if (!match || match[1] !== hashes[index] || !Number.isSafeInteger(size))
      throw new SetupError("Invalid Git blob metadata");
    return { hash: hashes[index], size };
  });
}

function readBatch(repo, entries) {
  const output = git(repo, ["cat-file", "--batch"], {
    encoding: null,
    input: entries.map(({ hash }) => hash).join("\n") + "\n",
  });
  let offset = 0;
  const blobs = entries.map(({ hash, size }) => {
    const header = Buffer.from(`${hash} blob ${size}\n`);
    const end = offset + header.length + size;
    if (
      !output.subarray(offset, offset + header.length).equals(header) ||
      output[end] !== 10
    )
      throw new SetupError("Invalid Git blob batch");
    const bytes = output.subarray(offset + header.length, end);
    offset = end + 1;
    return bytes;
  });
  if (offset !== output.length)
    throw new SetupError("Unexpected Git blob batch bytes");
  return blobs;
}

/** Preserve requested order and exact bytes while bounding each batch's memory. */
export function* readGitBlobs(repo, hashes) {
  if (hashes.length === 0) return;
  let batch = [],
    size = 0;
  for (const entry of blobInfo(repo, hashes)) {
    const cost = entry.size + entry.hash.length + 40;
    if (size + cost > batchBytes && batch.length) {
      yield* readBatch(repo, batch);
      batch = [];
      size = 0;
    }
    if (cost > batchBytes) {
      // Keep the existing per-object limit for large individual files.
      yield git(repo, ["cat-file", "blob", entry.hash], { encoding: null });
    } else {
      batch.push(entry);
      size += cost;
    }
  }
  if (batch.length) yield* readBatch(repo, batch);
}
