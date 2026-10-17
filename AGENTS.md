# Quality-ratchet

This repository owns the shared checker and its GitHub Action. Consumer repositories own their policy and release pins.

- For implementation scope and acceptance, read the approved [design](docs/superpowers/specs/2026-10-16-quality-ratchet-design.md) and the current task in the [plan](docs/superpowers/plans/2026-10-16-quality-ratchet.md).
- Before extracting or publishing source, read [provenance](docs/provenance.md), preserve notices, and resolve any file-specific publication question. Keep consumer business data and private operational material in their source repositories.
- Keep scanner dependencies in this tool. Install from its lockfile with lifecycle scripts disabled. Consumer source, index, Git configuration, dependencies, and lifecycle scripts remain untouched.
- Verify the changed behavior before committing. Keep real tests within the quality policy; `test/fixtures/**` contains deliberately duplicated or invalid scanner inputs.
- Obtain explicit human authorization before applying `quality-exception`, including to disposable probes. The label never accepts operational failures.
- A merge-ready claim requires the latest pushed head to be at least 30 minutes old, then a fresh audit of checks, comments, inline threads, reviews, mutable summaries, and mergeability. Each new commit resets the window.
