# `.github/` — workflows for this pack

This repository calls pinned reusable workflows from `jpe-cribl/.github`.
Pins use a 40-hex commit and a comment such as `# main`.

Caller workflows in this repo (`test.yml`, `release.yml`, `release-please.yml`,
and `e2e.yml`) wire them up to GitHub events.

## Installation

The caller workflows in this repository reference shared workflows from
`jpe-cribl/.github`. The shared test workflow checks the shared scripts out to
`.gh-shared` for both its validate and test jobs. The shared release workflow
uses those scripts from its own checkout.

## Usage

The workflows trigger automatically:

- Open a PR touching `default/`, `data/samples/`, `tests/`, `scripts/`, or
  `package.json` → `test.yml` runs validate + Vitest.
- Push to `main` → `release-please.yml` opens or updates the release PR.
- Merge a release PR → release-please tags the version, which triggers
  `release.yml` → builds the `.crbl` and publishes to GitHub Releases.
- Manually dispatch `e2e.yml` or open a PR touching `e2e/**` → the shared E2E
  workflow runs the scenario.

No manual invocation is needed. Override defaults by editing the caller
workflow's `with:` block (e.g., pass a custom `cribl_versions` JSON array to
test specific upstream Cribl releases).

## Shared workflows

The pack test, release, and E2E workflows are hosted in
[`jpe-cribl/.github`](https://github.com/jpe-cribl/.github). Their inputs and
jobs are documented there.

## Caller workflows in this repo

- `workflows/test.yml` — PRs and paths-filtered pushes to `main`; calls the
  shared `cribl-pack-test.yml` workflow.
- `workflows/release.yml` — pushes to `main` and pull requests; calls
  `_release.yml`, then the shared `cribl-pack-release.yml` workflow before
  publishing.
- `workflows/e2e.yml` — manual dispatch and E2E-related pull requests; calls
  the shared `cribl-pack-e2e.yml` workflow.

## Updating reusable workflow inputs

Adding/renaming an input is a breaking change for every consumer pack. Use the
`workflow_call.inputs.<name>.default` field to keep the change backward
compatible whenever possible. Bump major version of the workflow only if you
absolutely cannot.

## Pinning external actions

Per [`SECURITY.md`](https://github.com/JacobPEvans/.github/blob/main/SECURITY.md):

- Trusted (`actions/*`, `pnpm/action-setup`, `softprops/action-gh-release`):
  semver tag pins (`@v4`, etc.)
- Untrusted (everything else): SHA pins. Renovate (per the org's
  `renovate.json`) auto-converts version tags to SHA on first run.
