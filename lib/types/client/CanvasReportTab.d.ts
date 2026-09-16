import type { ReactNode } from 'react';
import type { Scope } from './canvas/sidebar-api';
/** The tab fields this component reads. */
export interface CanvasTabHandle {
    readonly id: string;
    readonly path?: string;
    /** Plugin-owned JSON blob persisted with the layout (`SidebarTab.meta`). */
    readonly meta?: unknown;
}
/** The store write face this component uses — `BetterSidebarService`'s tab updater. */
export interface CanvasTabService {
    updateTab(tabId: string, patch: {
        title?: string;
        path?: string;
        meta?: unknown;
    }): void;
}
export interface CanvasReportTabProps {
    /** The DSH locale lookup, passed down from `apply`. */
    t: (key: string) => string;
    /** The session this tab is scoped to. */
    scope: Scope;
    /** The open tab — its `path` seeds the view the first time it mounts. */
    tab?: CanvasTabHandle;
    /**
     * The sidebar service, for writing the picked path back onto the tab.
     *
     * This must be `ctx.betterSidebar` (the `BetterSidebarService`), NOT the
     * `store` in `TabComponentProps`: `SidebarStore` has `getSnapshot` and
     * `subscribeState` but no `updateTab` — that method lives on the service.
     */
    service?: CanvasTabService;
    /** Whether the tab is the active one AND the panel is open (guide §9). */
    visible?: boolean;
}
export declare function CanvasReportTab(props: CanvasReportTabProps): ReactNode;
