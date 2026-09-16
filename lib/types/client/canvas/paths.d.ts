/**
 * Path helpers for the canvas renderer.
 *
 * These are deliberate mirrors of better-sidebar's own client-side helpers —
 * `src/client/paths.ts` and the media-destination logic in
 * `src/client/markdown-images.ts` — kept local because we consume that package
 * over the wire instead of importing it (see `sidebar-api.ts` for why).
 *
 * Mirroring matters more than it looks. `isAbsolutePath` must agree with the
 * host's notion of absolute, or a path the host would resolve verbatim gets
 * silently joined onto the cwd here. `isWithinWorkspace` mirrors the host's
 * `isWithin` (`fs-tree.ts`) so our containment decision matches the one the
 * media route makes.
 *
 * The one thing NOT copied is better-sidebar's willingness to serve absolute
 * paths outside the workspace: that is behind its `workspaceFence` setting,
 * which ships as `true` but is user-disableable, and its own docs warn that
 * while it is off "any same-origin script (including third-party consumer
 * plugins) can read/write outside the workspace through those routes". We are
 * such a plugin, so `isInsideWorkspace` below holds unconditionally.
 */
/**
 * Mirror of the host's absolute-path notion: POSIX roots, Windows drive
 * letters, and UNC shares in both `\\server\share` and `//server/share` form.
 * Deliberately a superset, exactly as the host's own client mirror is.
 */
export declare function isAbsolutePath(path: string): boolean;
/** True for a remote URL (`http:`, `data:`, …) but NOT a Windows drive path. */
export declare function isRemoteUrl(dest: string): boolean;
/** Last path segment of a '/'- or '\'-separated path. */
export declare function baseName(path: string): string;
/**
 * Collapse `.`/`..` segments while PRESERVING the root form — a POSIX `/`,
 * a Windows drive (`C:\`), or a UNC `\\server\share` prefix.
 *
 * Preserving the root is the whole point: a naive join turns `C:/x.png` into
 * the harmless-looking relative `dir/C:/x.png`, which sails past any
 * containment check that only looks for a leading drive letter.
 */
export declare function normalizeLocalPath(path: string): string;
/**
 * Whether `target` lies under `base` (or equals it), tolerant of separator
 * style and letter case. Mirrors the host's `isWithin`.
 *
 * Case-insensitivity is unconditional here, matching better-sidebar's own
 * client mirror: the client cannot reliably know the host's platform, and
 * over-matching only ever makes us MORE permissive about calling something
 * "inside", which the caller then re-checks against the real fence.
 */
export declare function isWithinWorkspace(base: string, target: string): boolean;
/**
 * Our containment policy: a relative path is fine (the host resolves it under
 * the session cwd), an absolute one must sit inside the workspace.
 *
 * Held unconditionally — see the module comment — so the tab cannot be turned
 * into an arbitrary-file reader by a host setting we do not control.
 */
export declare function isInsideWorkspace(cwd: string | undefined, path: string): boolean;
/**
 * Resolve one `canvasImage()` reference against the canvas file's directory,
 * mirroring `resolveLocalMediaDest`'s local branch.
 *
 * @param dest - the reference literal from the source.
 * @param filePath - the canvas file's own path (relative or absolute).
 * @returns a canonical local path, the remote URL unchanged, or `undefined`
 *   when the reference is empty, an anchor, or unresolvable.
 */
export declare function resolveMediaRef(dest: string, filePath: string): string | undefined;
