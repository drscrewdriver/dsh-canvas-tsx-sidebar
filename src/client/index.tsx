/**
 * Browser half: registers a Canvas report viewer and tab with better-sidebar.
 *
 * We register two entry points:
 *
 * 1. **File viewer** (`exts: ['tsx']`, priority 50): claims every `.tsx` the
 *    user opens. For `.canvas.tsx` it renders a live document with a
 *    code/preview toggle; for other `.tsx` it shows a monospace source view
 *    (a faithful fallback — the source is always available). The user can
 *    disable the viewer in the Side card settings, which restores the
 *    built-in code viewer.
 *
 * 2. **Tab** (`order: 60`, `single: true`): a manual-preview surface with a
 *    path input, useful for inspecting a canvas without opening it in the
 *    editor.
 *
 * Registration contract (docs/external-plugin-guide.md §3/§4):
 * - `inject` declares the services we need; Cordis activates us only once
 *   `betterSidebar` is published, so registration order is irrelevant.
 * - Every `register*` call rides `ctx.effect(fn, label)` so the returned
 *   disposer is revoked on fiber teardown (HMR / disable).
 * - We are a SOFT dependency: when better-sidebar is not installed the tab
 *   registers through the host's own right-sidebar (`native-sidebar.tsx`,
 *   0.1.5+) with the report tab only; on hosts without either surface the
 *   plugin is inert.
 */
import { createElement } from 'react'
import type {} from 'dsh-better-sidebar/client/service'
import type { BetterSidebarService } from 'dsh-better-sidebar/client/service'
import type { Context } from '@deepseek-ai/cordis'
import { CanvasReportTab } from './CanvasReportTab'
import { registerNativeReportTab } from './native-sidebar'
import type { NativeTabRegistryLike } from './native-sidebar'
import { CanvasFileViewer, VIEWER_ID } from './canvas/canvas-viewer'
import { CanvasIcon } from './CanvasIcon'
import { dictionaries, NS } from './locales'

/** Tab type id. Package-prefixed so it cannot collide with a built-in type. */
export const TAB_ID = 'dsh-canvas-tsx:report'

/** Tab kind on the native host-sidebar path (openTab/guide dispatch key). */
export const TAB_KIND = 'canvas-report'

/** Services required before `apply` runs. */
// Host services only — both present on every rc line this plugin claims
// (locale since 0.1.0-rc.2, per dsh-brief-sidebar's generation-neutral list).
// The 0.1.7+ strict-proxy ctx THROWS on `ctx.get` of an undeclared name, so
// `locale` must be declared here or the dictionaries never register (the
// 0.1.5 raw-`tab.title` chip). Third-party services (betterSidebar) and
// generation-specific host services (sidebarRightTabs, absent ≤0.1.2) stay
// OUT of this list and ride the deferred ctx.inject arms in apply — declaring
// those would pend the client entry forever on hosts without them (playbook §1).
export const inject = ['locale', 'slots']

/**
 * Structural view of the DSH locale service. Kept local on purpose: reaching
 * for `@deepseek-ai/dsh-client-ui-slots` types would pull a second type graph
 * into a browser-only plugin. Only the two members we call are declared.
 */
interface LocaleLike {
  register(ns: string, localeOrDicts: string | Record<string, Record<string, string>>, dict?: Record<string, string>): () => void
  bind(ns: string): (key: string) => string
}

/**
 * Narrow the locale service. The 0.1.7+ loader wraps ctx in a strict proxy that
 * THROWS on undeclared property reads (empty inject list), so the property read
 * rides a try/catch with a ctx.get fallback — same discipline as softSvc.
 */
function localeOf(ctx: Context): LocaleLike | undefined {
  let locale: LocaleLike | undefined
  try {
    locale = (ctx as unknown as { locale?: LocaleLike }).locale
  } catch { /* strict proxy: undeclared service read */ }
  if (locale === undefined) {
    try {
      locale = (ctx as unknown as { get?: (n: string) => unknown }).get?.('locale') as LocaleLike | undefined
    } catch { /* ignore */ }
  }
  if (locale === undefined) return undefined
  if (typeof locale.register !== 'function' || typeof locale.bind !== 'function') return undefined
  return locale
}

/** Console prefix for the environment probe and registration attribution. */
const LOG = '[dsh-canvas-tsx-sidebar]'

/**
 * Run a registration thunk, attributing a thrown failure to the console
 * instead of the cordis effect void: a bare throw inside `ctx.effect` leaves
 * the field reader with an empty sidebar and no clue which arm died (the
 * 0.1.5 question this probe exists to answer). Returns a disposer either way.
 */
function guarded(label: string, run: () => (() => void) | undefined | void): () => void {
  try {
    const dispose = run()
    return typeof dispose === 'function' ? (dispose as () => void) : () => {}
  } catch (error) {
    console.error(`${LOG} ${label} failed`, error)
    return () => {}
  }
}

/**
 * Browser-face apply.
 * @param ctx - the client root context.
 */
export function apply(ctx: Context): void {
  const locale = localeOf(ctx)

  // Plugin-owned dictionaries. Consumer plugins must not depend on
  // better-sidebar's internal `t()` or its `betterSidebar` namespace (§10),
  // so we register our own namespace through the DSH locale service.
  // ONE two-arg call. The per-locale three-arg overload was the 0.1.2 field
  // failure: the host's register() THROWS on a locale that is already
  // present, so nine effects turned any re-activation (HMR, fiber teardown)
  // into partial `already has locale` explosions and the tab chips fell back
  // to raw keys. One call, one snapshot — same shape dsh-brief-sidebar ships
  // and that works across every rc line.
  if (locale !== undefined) {
    ctx.effect(
      () => locale.register(NS, dictionaries),
      'dsh-canvas-tsx-sidebar: dictionaries',
    )
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

  // Sidebar surface, acquired DEFERRED. better-sidebar is a third-party
  // plugin with no ordering guarantee against us, and the host tab registry
  // can publish after this apply too — an immediate `ctx.get` misses either
  // one and leaves the plugin inert forever (the 0.1.2 field failure). Both
  // arms ride the deferred optional `ctx.inject`. The host registry usually
  // wins the race on 0.1.5+, so this is NOT a one-shot latch: when
  // better-sidebar arrives after a native seat it HANDS OVER — the native
  // registration is released and the tab re-seats on the bar, the rail and
  // manager the user actually sees (the 0.1.5 "invisible tab" failure was a
  // native seat under a sidebar UI that replaced the official rail).
  let surface: 'none' | 'bar' | 'native' = 'none'
  let nativeDisposer: (() => void) | undefined

  const registerOnBar = (bar: BetterSidebarService): void => {
    if (surface === 'bar') return
    if (surface === 'native') {
      const release = nativeDisposer
      nativeDisposer = undefined
      try {
        release?.()
      } catch { /* a half-torn-down native seat must not block the handover */ }
      console.info(`${LOG} surface=bar (handed over from native)`)
    } else {
      console.info(`${LOG} surface=bar`)
    }
    surface = 'bar'
    // Dictionary self-check: a raw key here means the locale namespace never
    // landed (register threw or locale was absent at apply), which is the
    // `tab.title` chip failure this probe exists to attribute.
    console.info(`${LOG} title=${JSON.stringify(t('tab.title'))}`)
    ctx.effect(
      () =>
        guarded('registerTab', () =>
          bar.registerTab({
          id: TAB_ID,
          title: () => t('tab.title'),
          description: () => t('tab.desc'),
          icon: (size: number) => CanvasIcon(size),
          order: 60, // built-ins: editor 10, git 20, subagent 30, sidechat 35, terminal 40, browser 50
          single: true, // ≡ dedupeKey: () => id — reopen focuses the existing tab
          component: props =>
            createElement(CanvasReportTab, {
              t,
              scope: props.scope,
              tab: props.tab,
              // `bar`, not `props.store` — updateTab lives on the service.
              service: bar,
              visible: props.visible,
            }),
          }),
        ),
      'dsh-canvas-tsx-sidebar: tab',
    )

    // File viewer: claims every .tsx; a canvas file renders as a live document,
    // anything else shows the raw source. The Side card settings page gets an
    // enable/disable switch so the user can restore the built-in code viewer.
    ctx.effect(
      () =>
        guarded('registerFileViewer', () =>
          bar.registerFileViewer({
          id: VIEWER_ID,
          title: () => t('viewer.title'),
          icon: (size: number) => CanvasIcon(size),
          exts: ['tsx'],
          priority: 50, // above default 0; built-in `code` viewer sits at -100
          fetchStrategy: 'fsRead',
          component: props =>
            createElement(CanvasFileViewer, {
              scope: props.scope,
              path: props.path,
              title: props.title,
            }),
        }),
        ),
      'dsh-canvas-tsx-sidebar: viewer',
    )
  }

  const registerOnNative = (registry: NativeTabRegistryLike | undefined): void => {
    if (surface !== 'none') return
    surface = 'native'
    console.info(`${LOG} surface=native`)
    // Native host, no better-sidebar: the report tab registers straight into
    // the official right sidebar; the file-viewer seat is not ported (see
    // native-sidebar.tsx scope notes) and `.tsx` opens keep their host viewer.
    ctx.effect(
      () => {
        nativeDisposer = guarded('native tab', () => registerNativeReportTab(ctx, registry, { id: TAB_ID, kind: TAB_KIND, order: 60, t }))
        return () => {
          nativeDisposer = undefined
        }
      },
      'dsh-canvas-tsx-sidebar: native tab',
    )
  }

  // Arm 1: better-sidebar, immediate read first, deferred retry otherwise.
  let bar: BetterSidebarService | undefined
  try {
    bar = (ctx as unknown as { betterSidebar?: BetterSidebarService }).betterSidebar
  } catch { /* strict proxy: undeclared service read */ }
  if (bar === undefined) {
    try {
      bar = (ctx as unknown as { get?: (n: string) => unknown }).get?.('betterSidebar') as BetterSidebarService | undefined
    } catch { /* ignore */ }
  }
  if (bar !== undefined) {
    registerOnBar(bar)
  } else {
    ;(ctx as unknown as {
      inject: (deps: string[], cb: (scope: { betterSidebar?: BetterSidebarService }) => void) => void
    }).inject(['betterSidebar'], (scope) => {
      const svc = scope.betterSidebar ?? (scope as unknown as { get?: (n: string) => unknown }).get?.('betterSidebar')
      if (svc !== undefined) registerOnBar(svc as BetterSidebarService)
    })
  }

  // Arm 2: the host's own tab registry (0.1.5+). Never fires on ≤0.1.2. The
  // registry is read from the INJECTED scope — a root ctx.get of this
  // undeclared service is denied by the strict proxy (the 0.1.7 silent no-op).
  ;(ctx as unknown as {
    inject: (deps: string[], cb: (scope: { sidebarRightTabs?: NativeTabRegistryLike }) => void) => void
  }).inject(['sidebarRightTabs'], (scope) => {
    registerOnNative(scope.sidebarRightTabs)
  })

  // One-line environment snapshot: what this apply could see at mount time.
  // Cross-reference with the `surface=` line to tell "arm never fired" from
  // "arm fired and registration threw" (guarded logs that part).
  try {
    let nativeTabsAtApply = false
    try {
      nativeTabsAtApply =
        (ctx as unknown as { get?: (n: string) => unknown }).get?.('sidebarRightTabs') !== undefined
    } catch {
      nativeTabsAtApply = false /* strict proxy denies the undeclared read */
    }
    const env = {
      locale: locale !== undefined,
      barAtApply: bar !== undefined,
      nativeTabsAtApply,
    }
    console.info(`${LOG} env ${JSON.stringify(env)}`)
    // localStorage breadcrumb: the console listener is unreliable across
    // navigations in the farm probe harness, this key survives reloads.
    try {
      localStorage.setItem('dsh-canvas-env', JSON.stringify(env))
    } catch { /* private mode */ }
  } catch { /* console may be absent in a stripped host */ }
}
