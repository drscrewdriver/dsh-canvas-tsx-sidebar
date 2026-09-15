/**
 * Node half of the Canvas report plugin.
 *
 * The Cordis loader needs an entry point for the profile row; the plugin's
 * behaviour is entirely in the browser half, which `dsh-client-modules` serves
 * from `./client`. This half therefore installs nothing and owns no state —
 * in particular it adds no HTTP route and no tool.
 */

/** Profile row identity. */
export const name = 'dsh-canvas-tsx-sidebar'

/**
 * Node-face apply. Intentionally empty: parsing and rendering are static and
 * run in the browser half over content fetched from better-sidebar's own
 * `/sidebar/api/fs.read` (which owns the workspace-root path fence).
 */
export function apply(): void {}
