/**
 * Browser half: registers the Canvas report tab with better-sidebar.
 *
 * Registration contract (docs/external-plugin-guide.md §3/§4):
 * - `inject` declares the services we need; Cordis activates us only once
 *   `betterSidebar` is published, so registration order is irrelevant.
 * - Every `register*` call rides `ctx.effect(fn, label)` so the returned
 *   disposer is revoked on fiber teardown (HMR / disable). Without it the
 *   registration survives and the next activation throws `already registered`.
 * - We are a SOFT dependency: when better-sidebar is not installed the
 *   registration is skipped silently and the rest of the plugin is inert.
 *
 * Why a tab and not a file viewer — see spec.md §2.3. In short: `extOf()`
 * only takes the last dot segment (so `exts: ['canvas.tsx']` can never match),
 * the only matching `exts: ['tsx']` would swallow every TSX in the workspace
 * and outrank the built-in `code` viewer, `detect` never fires for text
 * files, there is no delegation API, and `dsh-code-nav` already claims `tsx`
 * at priority 10.
 */
import { createElement } from 'react'
import type {} from 'dsh-better-sidebar/client/service'
import type { BetterSidebarService } from 'dsh-better-sidebar/client/service'
import type { Context } from '@deepseek-ai/cordis'
import { CanvasReportTab } from './CanvasReportTab'
import { CanvasIcon } from './CanvasIcon'
import { dictionaries, NS } from './locales'

/** Tab type id. Package-prefixed so it cannot collide with a built-in type. */
export const TAB_ID = 'dsh-canvas-tsx:report'

/** Services required before `apply` runs. */
export const inject = ['betterSidebar', 'locale']

/**
 * Structural view of the DSH locale service. Kept local on purpose: reaching
 * for `@deepseek-ai/dsh-client-ui-slots` types would pull a second type graph
 * into a browser-only plugin. Only the two members we call are declared.
 */
interface LocaleLike {
  register(ns: string, locale: string, dict: Record<string, string>): () => void
  bind(ns: string): (key: string) => string
}

/** Narrow `ctx.locale` without asserting the whole context. */
function localeOf(ctx: Context): LocaleLike | undefined {
  const locale = (ctx as unknown as { locale?: LocaleLike }).locale
  if (locale === undefined) return undefined
  if (typeof locale.register !== 'function' || typeof locale.bind !== 'function') return undefined
  return locale
}

/**
 * Browser-face apply.
 * @param ctx - the client root context.
 */
export function apply(ctx: Context): void {
  const locale = localeOf(ctx)

  // Plugin-owned dictionaries. Consumer plugins must not depend on
  // better-sidebar's internal `t()` or its `betterSidebar` namespace (§10),
  // so we register our own namespace through the DSH locale service. Our
  // namespace is outside the LocaleNamespaceMap merge table, which is exactly
  // what the documented single-locale overload is for.
  if (locale !== undefined) {
    for (const [tag, dict] of Object.entries(dictionaries)) {
      ctx.effect(
        () => locale.register(NS, tag, dict),
        `dsh-canvas-tsx-sidebar: dictionary ${tag}`,
      )
    }
  }

  /** Translate one of our keys; unknown namespaces/keys fall back to the key. */
  const t = (key: string): string => {
    if (locale === undefined) return key
    try {
      return locale.bind(NS)(key) || key
    } catch {
      return key
    }
  }

  // Soft dependency: absent better-sidebar leaves the plugin fully inert.
  const bar = (ctx as unknown as { betterSidebar?: BetterSidebarService }).betterSidebar
  if (bar === undefined) return

  ctx.effect(
    () =>
      bar.registerTab({
        id: TAB_ID,
        title: () => t('tab.title'),
        description: () => t('tab.desc'),
        icon: (size: number) => CanvasIcon(size),
        order: 60, // built-ins: editor 10, git 20, subagent 30, sidechat 35, terminal 40, browser 50
        single: true, // ≡ dedupeKey: () => id — reopen focuses the existing tab
        component: props =>
          createElement(CanvasReportTab, { t, scope: props.scope, visible: props.visible }),
      }),
    'dsh-canvas-tsx-sidebar: tab',
  )
}
