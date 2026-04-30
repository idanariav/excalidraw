# @idan_ariav/excalidraw

This is a fork of `@zsviczian/excalidraw` (itself a fork of the upstream Excalidraw library), customized for the obsidian-excalidraw-plugin. Package name is `@idan_ariav/excalidraw`.

Use **yarn** (not npm) for all package operations inside this repo.

## Key rule: marking fork changes

Every line added or modified relative to upstream must end with `//zsviczian` (the original fork convention). This makes it easy to diff and rebase against upstream.

## Development commands

```bash
# From repo root (monorepo)
yarn install                  # Install all workspace dependencies

# From packages/excalidraw/
yarn build:umd                # Production UMD bundle — what the Obsidian plugin consumes
yarn build:esm                # ESM + TypeScript types — for downstream TS consumers
yarn gen:types                # Regenerate types only (no recompile)
```

**Always use `build:umd`** when updating the plugin. The Obsidian plugin reads
`dist/excalidraw.production.min.js` and `dist/styles.production.css` from the UMD output.
`build:esm` produces `dist/prod/index.js` which the plugin does NOT use.

## After building, update the plugin

```bash
cd /Users/idanariav/GitProjects/obsidian-excalidraw-plugin
npm install          # re-links the local file: dependency
npm run build:all    # rebuilds the plugin
```

## Deploy to test vault

Run these steps in order to push changes from this library all the way to the local Obsidian test vault:

```bash
# 1. Build the excalidraw UMD bundle (from packages/excalidraw/)
yarn build:umd

# 2. Re-link and rebuild the Obsidian plugin
cd /Users/idanariav/GitProjects/obsidian-excalidraw-plugin
npm install
npm run build:all

# 3. Copy plugin output to the test vault
cp dist/main.js dist/manifest.json dist/styles.css \
  "/Users/idanariav/Documents/test_vault/.obsidian/plugins/obsidian-excalidraw-plugin/"
```

Then reload Obsidian (disable/re-enable the plugin or Cmd+R) and verify in the UI.

## Testing

No automated test suite targets the Obsidian-specific fork changes. Testing is manual via the deploy-to-test-vault flow above.

The upstream Excalidraw test suite (vitest) is available from the monorepo root:
```bash
yarn test:update      # run all tests with snapshot updates
yarn test:typecheck   # TypeScript type check only
```

## Publishing

1. Bump version in `packages/excalidraw/package.json`
2. Run `yarn build:umd`
3. `npm publish --access public` from `packages/excalidraw/` (requires npm login as `@idan_ariav`)
4. Update the plugin's `package.json` dependency from `file:` to `npm:@idan_ariav/excalidraw@<version>`

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the module map, package boundaries, key file responsibilities, and where to look for specific subsystems.
