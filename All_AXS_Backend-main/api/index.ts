// Use Nest's compiled output so path aliases (`src/...`) are resolved to relative requires.
// Vercel's TS compile of `src/` leaves bare `src/*` imports that fail at runtime.
export { default } from '../dist/src/vercel/nest-serverless.entry';
