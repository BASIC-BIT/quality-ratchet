import { supportedFormats } from "../duplication/formats.mjs";

export const HARD_EXCLUDES = [
  "**/.git/**",
  "**/node_modules/**",
  "**/bower_components/**",
  "**/.yarn/**",
  "**/.pnpm-store/**",
  "**/.worktrees/**",
  "**/worktrees/**",
  "**/.quality-ratchet/**",
  "**/.quality-ratchet-tool/**",
  "**/.venv/**",
  "**/venv/**",
  "**/.terraform/**",
];
export const GENERATED_EXCLUDES = [
  "**/{build,dist,out,coverage,generated,_generated,__pycache__}/**",
  "**/{.next,.nuxt,.output,.svelte-kit,.turbo,.cache}/**",
  "**/*.d.{ts,mts,cts}",
];

export const DEFAULTS = {
  schemaVersion: 1,
  scope: { include: ["**/*"], exclude: [...GENERATED_EXCLUDES] },
  checks: {
    complexity: {
      mode: "ratchet",
      reason: null,
      cyclomatic: 15,
      cognitive: 15,
      include: ["**/*"],
      exclude: [],
    },
    fileSize: {
      mode: "ratchet",
      reason: null,
      maxLines: 1000,
      include: ["**/*"],
      exclude: [],
    },
    duplication: {
      mode: "ratchet",
      reason: null,
      minLines: 8,
      minTokens: 50,
      include: ["**/*"],
      exclude: [],
      formats: [...supportedFormats],
    },
  },
  overrides: [],
  reports: {
    testDebt: true,
    testSize: { enabled: true, oversizedLines: 1000 },
  },
};

export const CHECK_KEYS = {
  complexity: "complexity",
  "file-size": "fileSize",
  duplication: "duplication",
};
export const THRESHOLD_KEYS = {
  complexity: ["cyclomatic", "cognitive"],
  "file-size": ["maxLines"],
  duplication: ["minLines", "minTokens"],
};
