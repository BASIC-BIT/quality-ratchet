import { SetupError } from "../git/commands.mjs";
export const shaPattern = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u;
export function identity({ owner, repo, number }) {
  if (
    ![owner, repo].every(
      (value) =>
        typeof value === "string" &&
        /^[A-Za-z0-9_.-]+$/u.test(value) &&
        !value.startsWith("."),
    ) ||
    !Number.isSafeInteger(number) ||
    number < 1
  )
    throw new SetupError("Invalid GitHub repository or PR identity");
  return `/repos/${owner}/${repo}`;
}
export function validRef(ref) {
  return (
    typeof ref === "string" &&
    ref.length > 0 &&
    ref.length <= 1024 &&
    !ref.startsWith("-") &&
    !/[\x00-\x20\x7f~^:?*\[\\]/u.test(ref) &&
    !ref.includes("..") &&
    !ref.includes("@{") &&
    !ref.endsWith(".") &&
    ref
      .split("/")
      .every((part) => part && !part.startsWith(".") && !part.endsWith(".lock"))
  );
}
export async function githubRequest(path, { token }) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new SetupError("GitHub metadata request failed");
  const text = await response.text();
  if (text.length > 2_000_000)
    throw new SetupError("GitHub metadata response exceeds limit");
  return JSON.parse(text);
}
export async function readCurrentPr({
  token,
  owner,
  repo,
  number,
  transport = githubRequest,
}) {
  try {
    const root = identity({ owner, repo, number });
    const pr = await transport(`${root}/pulls/${number}`, { token });
    if (
      !shaPattern.test(pr.head?.sha) ||
      !validRef(pr.base?.ref) ||
      !Array.isArray(pr.labels) ||
      !pr.labels.every((label) => typeof label.name === "string") ||
      !(pr.body === null || typeof pr.body === "string")
    )
      throw new Error();
    const branch = await transport(
      `${root}/branches/${encodeURIComponent(pr.base.ref)}`,
      { token },
    );
    if (!shaPattern.test(branch.commit?.sha)) throw new Error();
    return {
      headSha: pr.head.sha,
      baseRef: pr.base.ref,
      baseSha: branch.commit.sha,
      labels: pr.labels.map((label) => label.name),
      body: pr.body ?? "",
    };
  } catch {
    throw new SetupError(
      "Unable to read current PR and target branch metadata. Rerun the quality check.",
    );
  }
}
export function eventIdentity(event) {
  const owner = event.repository.owner.login,
    repo = event.repository.name,
    number = event.number;
  identity({ owner, repo, number });
  const headSha = event.pull_request.head.sha,
    baseRef = event.pull_request.base.ref;
  if (
    !shaPattern.test(headSha) ||
    !validRef(baseRef) ||
    event.pull_request.base.repo.full_name !== `${owner}/${repo}`
  )
    throw new SetupError("Invalid pull request event");
  return { owner, repo, number, headSha, baseRef };
}
