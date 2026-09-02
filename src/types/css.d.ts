/**
 * CSS is a build input here, not a module.
 *
 * `src/global.css` is imported for its side effect: Metro hands it to Uniwind,
 * which compiles it into the style objects HeroUI Native's components read.
 * Nothing is imported FROM it, so an empty module declaration is the honest
 * shape.
 *
 * Uniwind also emits `src/uniwind.d.ts` when Metro runs, but that file does not
 * exist until the first build - and `tsc --noEmit` has to pass before then, in
 * CI and on a fresh clone.
 */
declare module '*.css';
