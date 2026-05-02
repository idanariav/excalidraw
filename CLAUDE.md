# CLAUDE.md

## Project Structure

Excalidraw is a **monorepo** with a clear separation between the core library and the application:

- **`packages/excalidraw/`** - Main React component library published to npm as `@excalidraw/excalidraw`
- **`excalidraw-app/`** - Full-featured web application (excalidraw.com) that uses the library
- **`packages/`** - Core packages: `@excalidraw/common`, `@excalidraw/element`, `@excalidraw/math`, `@excalidraw/utils`
- **`examples/`** - Integration examples (NextJS, browser script)

## Development Workflow

1. **Package Development**: Work in `packages/*` for editor features
2. **App Development**: Work in `excalidraw-app/` for app-specific features
3. **Testing**: Always run `yarn test:update` before committing
4. **Type Safety**: Use `yarn test:typecheck` to verify TypeScript

## Development Commands

```bash
yarn test:typecheck  # TypeScript type checking
yarn test:update     # Run all tests (with snapshot updates)
yarn fix             # Auto-fix formatting and linting issues
```

## Known Pre-existing Test Errors

`yarn test:typecheck` reports pre-existing errors in upstream test files that predate this fork's work. These are **not regressions** and should be ignored:

- `*.test.tsx` files: `Property 'h' does not exist on type 'Window & typeof globalThis'`
- `*.test.tsx` files: `Parameter 'x' implicitly has an 'any' type`
- `tests/queries/toolQueries.ts`: index-type errors for `'mermaid'` tool type

When running `yarn test:typecheck`, focus only on errors in files you have **modified or created**. Filter the output if needed:

```bash
yarn test:typecheck 2>&1 | grep "error TS" | grep -v "\.test\.tsx\|test-utils\|textWysiwyg"
```

## Fork Convention: `//zsviczian` Markers

Every line added or modified relative to upstream must end with `//zsviczian`. However, **`//zsviczian` inside JSX children context renders as visible text** — JSX treats anything between tags that isn't a `{}` expression as a text node.

**Safe positions** (treated as JS line comments, not rendered):
- End of a line inside a JSX opening tag's attribute area: `<Component //zsviczian`
- End of a line inside a `{}` expression: `{someCondition && //zsviczian`
- End of a plain JS/TS line (outside JSX): `const x = 1; //zsviczian`

**Unsafe positions** (render as visible text — DO NOT use):
- After the closing `>` of an opening tag: `<fieldset> //zsviczian`
- After the closing `/>` of a self-closing tag when inside a JSX parent: `<Foo /> //zsviczian`
- After a closing tag: `</legend> //zsviczian`
- After `<>` or `</>` fragment delimiters: `<> //zsviczian`

**Fix for unsafe positions**: Either omit the marker (the surrounding line already has one), or use a JSX comment: `{/* //zsviczian */}`.

## Architecture Notes

### Package System

- Uses Yarn workspaces for monorepo management
- Internal packages use path aliases (see `vitest.config.mts`)
- Build system uses esbuild for packages, Vite for the app
- TypeScript throughout with strict configuration
