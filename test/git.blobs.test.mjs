import test from "node:test";
import assert from "node:assert/strict";
import { readGitBlobs } from "../src/git/blobs.mjs";
import { git, write, commit, withRepo } from "./helpers/repo.mjs";

const hash = (repo, file) => git(repo, "rev-parse", `HEAD:${file}`);

test("batched committed blobs preserve order, empty, repeated and binary bytes", () =>
  withRepo((repo) => {
    const binary = Buffer.from("hello\r\n\u96ea\0done\n", "utf8");
    write(repo, "empty.txt", "");
    write(repo, "unicode space.txt", binary);
    commit(repo);
    const empty = hash(repo, "empty.txt"),
      data = hash(repo, "unicode space.txt");
    assert.deepEqual(
      [...readGitBlobs(repo, [data, empty, data])],
      [binary, Buffer.alloc(0), binary],
    );
    assert.deepEqual([...readGitBlobs(repo, [])], []);
    assert.throws(() => [...readGitBlobs(repo, ["--unsafe"])]);
    assert.throws(() => [...readGitBlobs(repo, ["0".repeat(40)])]);
    assert.throws(() => [
      ...readGitBlobs(repo, [git(repo, "rev-parse", "HEAD")]),
    ]);
  }));

test("batch splitting and the large-object path retain every requested byte", () =>
  withRepo((repo) => {
    const small = Buffer.alloc(9 * 1024 * 1024, 65);
    const large = Buffer.alloc(17 * 1024 * 1024, 66);
    write(repo, "small.txt", small);
    write(repo, "large.txt", large);
    commit(repo);
    const a = hash(repo, "small.txt"),
      b = hash(repo, "large.txt");
    assert.deepEqual(
      [...readGitBlobs(repo, [a, a, b, a])],
      [small, small, large, small],
    );
  }));
