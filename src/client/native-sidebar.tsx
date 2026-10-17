/**
 * Native right-sidebar path: register the Canvas report tab directly into the
 * DSH host's own sidebar, with NO better-sidebar in sight. Available on host
 * generations that ship `dsh-client-ui-sidebar-right` (0.1.5+; verified by
 * slot-declaration forensics on 0.1.5-rc.3, 0.1.7-rc.2 and 0.2.0-rc.2).
 *
 * The two-stage recipe is copied from better-sidebar's own native bridge —
 * stage one stages the type through `ctx.sidebarRightTabs.register`, stage
 * two keys the body under `sidebar.right.pane.tab` with the definition's id.
 * See dsh-brief-sidebar's `native-sidebar.tsx` for the rationale of each
 * field; the modules are deliberately duplicated because both plugins stay
 * zero-build-coupled to host internals.
 *
 * Scope of this path versus the better-sidebar path, stated plainly:
 * - the REPORT TAB is fully ported (path input, render, code/preview toggle);
 *   file reads go through the plugin's own `/canvas/api` gateway instead of
 *   `/sidebar/api`.
 * - the FILE VIEWER (claiming every `.tsx` open) is NOT ported: the native
 *   seat hands tab bodies navigation through a `tabInfo` slot hook whose
 *   resource-params contract is still under investigation. On a native host
 *   `.tsx` files fall back to whatever viewer the host offers; the canvas is
 *   still reachable by typing its path into the report tab.
 * - no `updateTab` persistence: the picked path and mode live per mount
 *   instead of in the tab's layout record.
 */
import { createElement, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { CanvasReportTab } from './CanvasReportTab'
import { sessionInfo } from './canvas/sidebar-api'
import type { Scope } from './canvas/sidebar-api'

/** The keyed seat a tab body registers under on 0.1.5+ hosts. */
const PANE_TAB_SEAT = 'sidebar.right.pane.tab'

/** Stage-one shape, structural copy of `SidebarRightTabDefinition` (page type). */
interface NativeTabDefinition {
  readonly id: string
  readonly kind: string
  readonly title: (address: string) => string
  readonly guide?: readonly { id: string; order: number; title: () => string; description?: () => string }[]
}

interface NativeTabRegistryLike {
  register(definition: NativeTabDefinition): () => void
}

export type { NativeTabRegistryLike }

interface SlotsLike {
  inject(key: string, callback: () => (() => void) | undefined): () => void
  register(options: Record<string, unknown>, component: (props: unknown) => ReactNode): () => void
}

/** Read a host service without ever throwing on the strict context proxy. */
function softGet(ctx: Context, name: string): unknown {
  try {
    return ctx.get(name as never)
  } catch {
    return undefined
  }
}

/**
 * Whether this host exposes the native right-sidebar tab system at all.
 * @param ctx - the client root context.
 */
export function nativeSidebarAvailable(ctx: Context): boolean {
  const registry = softGet(ctx, 'sidebarRightTabs') as NativeTabRegistryLike | undefined
  const controller = softGet(ctx, 'sidebarRight')
  return (
    registry !== undefined &&
    typeof registry.register === 'function' &&
    controller !== undefined &&
    softGet(ctx, 'slots') !== undefined
  )
}

/**
 * Body shell for the native seat: resolves the session workspace through the
 * plugin's own gateway first, then mounts the real tab with a `/canvas`-based
 * scope. While the lookup is in flight the loading copy shows; when it fails
 * the error copy shows and the tab offers no path input (there is no fence
 * root to type against).
 */
function NativeReportBody(props: { t: (key: string) => string; sessionId: string }): ReactNode {
  const { t, sessionId } = props
  const [scope, setScope] = useState<Scope | undefined>(undefined)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setScope(undefined)
    setFailed(false)
    sessionInfo({ sessionId, apiBase: '/canvas' }, controller.signal)
      .then((info) => setScope({ sessionId, cwd: info.cwd, apiBase: '/canvas' }))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setFailed(true)
      })
    return () => controller.abort()
  }, [sessionId])

  if (failed) {
    return createElement('div', { style: { padding: 16, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, t('state.error'))
  }
  if (scope === undefined) {
    return createElement('div', { style: { padding: 16, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, t('state.loading'))
  }
  return createElement(CanvasReportTab, { t, scope })
}

/**
 * Register the report tab as a native right-sidebar tab type.
 *
 * The registry arrives as a parameter, read from the deferred `ctx.inject`
 * scope in `apply` — the 0.1.7+ strict-proxy ctx refuses a root `ctx.get`
 * of an undeclared service, so reaching for `sidebarRightTabs` from the root
 * context is what made the native seat silently no-op on 0.1.7 (the "cannot
 * register directly" observation). better-sidebar's own native bridge reads
 * it the same way: from the inject callback's scope.
 *
 * @param ctx - the client root context (for the declared `slots` service).
 * @param registry - the host tab-type registry from the injected scope.
 * @param deps - the stable ids and the translator from `apply`.
 * @returns a disposer unwinding seat first, then the type.
 */
export function registerNativeReportTab(
  ctx: Context,
  registry: NativeTabRegistryLike | undefined,
  deps: { id: string; kind: string; order: number; t: (key: string) => string },
): () => void {
  const slots = softGet(ctx, 'slots') as SlotsLike | undefined
  if (registry === undefined || typeof registry.register !== 'function' || slots === undefined) {
    return (): void => {}
  }

  const disposeType = registry.register({
    id: deps.id,
    kind: deps.kind,
    title: () => deps.t('tab.title'),
    guide: [
      {
        id: deps.id,
        order: deps.order,
        title: () => deps.t('tab.title'),
        description: () => deps.t('tab.desc'),
      },
    ],
  })

  const disposeSeat = slots.inject(PANE_TAB_SEAT, () =>
    slots.register(
      {
        name: PANE_TAB_SEAT,
        key: deps.id,
        inject: (sessionId: string) => ({ t: deps.t, sessionId }),
      },
      NativeReportBody as unknown as (props: unknown) => ReactNode,
    ),
  )

  return (): void => {
    try {
      disposeSeat()
    } finally {
      disposeType()
    }
  }
}
