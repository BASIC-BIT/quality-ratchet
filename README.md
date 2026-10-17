# Quality-ratchet

Shared Git-relative complexity, duplication, and file-size checks with repository-owned policy.

Implementation is in progress. No action, CLI, or release is available yet. The approved [design](docs/superpowers/specs/2026-10-16-quality-ratchet-design.md) and [implementation plan](docs/superpowers/plans/2026-10-16-quality-ratchet.md) define the intended behavior.

Use Node.js 24.15.0 or a newer Node 24 release, then run `npm ci --ignore-scripts`. Runtime scanner dependencies are separate from development formatting tools. No application dependencies are required.

The self-check policy uses shared defaults and excludes only `test/fixtures/**`. Those files are deliberately duplicated or invalid scanner inputs. Actual tests, scripts, and root configuration stay in scope. The schema and executable checks arrive in later implementation tasks.

Source terms and the extraction inventory are in [provenance](docs/provenance.md), [NOTICE](NOTICE), and [LICENSE](LICENSE).
