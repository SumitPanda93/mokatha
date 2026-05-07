# mo-katha

## Development

- Install dependencies from the workspace root:
  - `pnpm install`
- Run this app in dev mode:
  - `pnpm --filter ./artifacts/mo-katha run dev`

## Troubleshooting

### Rollup native module missing on Windows

If you see an error like `Cannot find module '@rollup/rollup-win32-x64-msvc'`, run:

`pnpm install --filter ./artifacts/mo-katha`

If the error still persists, run a full reinstall from the workspace root:

`pnpm install`
