/**
 * Plugin-owned i18n dictionary.
 *
 * Consumer plugins must NOT reach into better-sidebar's internal `t()` or its
 * `betterSidebar` dictionary namespace (guide §10). We therefore register our
 * own namespace through the DSH `locale` service, exactly as the reference
 * consumer plugin `dsh-code-nav` does (`ctx.locale.register(NS, { zh, en })`).
 */
/** Our own namespace, kept short and package-scoped. */
export declare const NS = "dsh-canvas-tsx-sidebar";
/** Locale bundle shape accepted by `ctx.locale.register`. */
export type LocaleBundle = Record<string, Record<string, string>>;
export declare const dictionaries: LocaleBundle;
