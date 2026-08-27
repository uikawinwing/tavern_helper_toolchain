# Shared TavernHelper Toolchain

## Goal

Keep one TavernHelper development toolchain and let multiple script repositories share it without merging template/dependency update branches in every repository.

## Local layout

```text
TavernDev/
├─ Toolchain/
└─ Scripts/
   ├─ worldbook_editor/
   ├─ another_script/
   └─ ...
```

`Toolchain` owns the reusable development environment:

- `node_modules`
- `package.json` / `pnpm-lock.yaml`
- webpack and loaders
- TavernHelper `@types`
- shared `util`
- schema tooling
- browserslist and other template-level build configuration

Each script repository owns only project-specific source/configuration and keeps its own Git history/repository.

## Consumer contract

A consumer repository lives under `TavernDev/Scripts/<repo>` and calls the sibling Toolchain through `../../Toolchain`.

Its `package.json` should stay thin and normally expose only:

- `build`
- `build:dev`
- `watch`
- `typecheck`

Its `tsconfig.json` extends the shared Toolchain config and resolves TavernHelper/global package types from the shared Toolchain.

External projects are intentionally compiled from `src/**` only. Template `示例/` folders belong to the Toolchain and must not participate in consumer builds.

## GitHub layout

The planned central repository name is:

`uikawinwing/tavern_helper_toolchain`

Consumer repositories remain independent GitHub repositories. Their local `bundle.yaml` is only a thin trigger that calls the reusable workflow in the central Toolchain repository.

The reusable workflow reconstructs the same local directory layout inside the runner:

```text
$GITHUB_WORKSPACE/
└─ TavernDev/
   ├─ Toolchain/          <- checkout shared Toolchain repo
   └─ Scripts/project/    <- checkout the calling consumer repo
```

This keeps local and CI path behavior identical while keeping checkout/install/build/tag logic centralized in one workflow.

The shared Toolchain repository should be public unless cross-repository private checkout credentials are intentionally configured. A normal repository `GITHUB_TOKEN` cannot be assumed to read a different private repository.

## Update flow

1. `Toolchain/bump_deps` runs every 3 days.
2. It updates dependencies, TavernHelper types, and `tavern_sync`.
3. It installs the resulting lockfile and runs a full Toolchain build before committing anything.
4. `Toolchain/sync_template` checks StageDog upstream every 3 days.
5. Upstream changes are merged into the runner first and must pass `pnpm build` before a single central sync PR is published.
6. Consumer repos no longer run their own dependency/template sync jobs.
7. Consumer `bundle.yaml` files only call the central reusable `consumer-bundle.yaml` workflow.
8. The reusable workflow installs dependencies only in the checked-out shared Toolchain, then typechecks/builds/commits/tags the calling consumer.
9. Consumer repos may rebuild every 3 days against the latest central Toolchain, but they do not create dependency/template branches.

## Safety boundary

Do not copy shared template files back into consumer repos to fix build errors. Fix the shared Toolchain contract instead.

Files in `.github/workflows`, `project-build.mjs`, and this document are local Toolchain infrastructure and are protected from template-sync replacement via `.github/.templatesyncignore`.

`webpack.config.ts` and `dump_schema.ts` intentionally remain syncable with upstream because they are upstream-owned files with a small shared-project adaptation. Upstream changes touching the same areas may require resolving one central sync conflict, never one conflict per consumer repo.

## Migration checklist for another script repo

1. Place/clone it under `TavernDev/Scripts/<repo>`.
2. Replace duplicated dependency lists with the thin consumer `package.json` pattern.
3. Make its `tsconfig.json` extend `../../Toolchain/tsconfig.json` and resolve shared types/packages from `../../Toolchain`.
4. Disable/remove its legacy `bump_deps` and `sync_template` workflows.
5. Replace its bundle workflow with the tiny caller that uses `uikawinwing/tavern_helper_toolchain/.github/workflows/consumer-bundle.yaml@main`.
6. Verify `typecheck` and `build` locally before removing duplicated template files.
7. Remove old `node_modules`, `@types`, `util`, webpack/template examples, lockfile, and other template-only copies once the migration is verified.
