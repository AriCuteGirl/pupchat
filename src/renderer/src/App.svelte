<script lang="ts">
  import { House, PanelLeftClose, PanelLeftOpen, PawPrint, RotateCw } from '@lucide/svelte'
  import type { ServiceState, ShellApi, ShellState } from '../../shared/ipc'
  import { LAYOUT, sidebarWidth } from '../../shared/layout'
  import { serviceIcon } from './lib/icons'
  import SleepyPup from './lib/SleepyPup.svelte'
  import { SERVICES } from '../../shared/services'

  const api = (window as unknown as { pupchat: ShellApi }).pupchat
  let shell = $state<ShellState | null>(null)
  void api.getState().then((s) => (shell = s))
  // Block body: returning the (proxied) value across the preload bridge would fail to clone.
  api.onState((s) => {
    shell = s
  })

  const active = $derived(shell?.services.find((s) => s.id === shell?.active))
  const collapsed = $derived(shell?.collapsed ?? false)

  function statusText(s: ServiceState): string {
    switch (s.status) {
      case 'idle':
        return 'Not opened yet'
      case 'loading':
        return 'Loading…'
      case 'asleep':
        return 'Asleep (saving RAM)'
      case 'offline':
        return "You're offline"
      case 'error':
        return "Couldn't load"
      case 'ready':
        if (s.needsLogin) return 'Not logged in'
        if (s.unread === 'dot') return 'New activity'
        return s.unread > 0 ? `${s.unread} unread` : 'Up to date'
    }
  }
  // Drag the left edge to resize. Wayland doesn't tell a window where it is on screen, so
  // we add up relative pointer movement; dragging left makes the panel wider.
  let dragging = $state(false)
  let dragStart = 0
  let moved = 0
  let frame = 0
  function startDrag(e: PointerEvent): void {
    if (!shell) return
    dragging = true
    dragStart = shell.panelWidth
    moved = 0
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onDrag(e: PointerEvent): void {
    if (!dragging) return
    moved += e.movementX
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      api.setPanelWidth(dragStart - moved)
    })
  }
  function endDrag(): void {
    dragging = false
  }
  function resizeKey(e: KeyboardEvent): void {
    if (!shell) return
    if (e.key === 'ArrowLeft') api.setPanelWidth(shell.panelWidth + 20)
    else if (e.key === 'ArrowRight') api.setPanelWidth(shell.panelWidth - 20)
  }

  const label = (u: number | 'dot'): string => (u === 'dot' ? '' : u > 99 ? '99+' : String(u))
  const iconFor = (id: string) => serviceIcon(SERVICES.find((s) => s.id === id)?.icon ?? '')
</script>

{#if shell}
  <div
    class="panel"
    class:collapsed
    style:--sidebar-w="{sidebarWidth(collapsed)}px"
    style:--header-h="{LAYOUT.headerHeight}px"
    style:--inset="{LAYOUT.inset}px"
    style:--view-r="{LAYOUT.viewRadius}px"
  >
    <!-- A focusable separator moved with arrow keys is the ARIA "window splitter" pattern. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class="grip"
      class:dragging
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      aria-valuenow={shell.panelWidth}
      tabindex="0"
      onpointerdown={startDrag}
      onpointermove={onDrag}
      onpointerup={endDrag}
      onpointercancel={endDrag}
      onkeydown={resizeKey}
    ></div>
    <aside class="sidebar" aria-label="Platforms">
      <div class="top">
        {#if !collapsed}<h1 class="title">PupChat</h1>{/if}
        <button
          class="icon-btn"
          aria-label={collapsed ? 'Show platform list' : 'Collapse platform list'}
          title={collapsed ? 'Show list (Ctrl+Shift+B)' : 'Collapse list (Ctrl+Shift+B)'}
          onclick={() => api.setCollapsed(!collapsed)}
        >
          {#if collapsed}<PanelLeftOpen size={18} />{:else}<PanelLeftClose size={18} />{/if}
        </button>
      </div>

      <nav class="list">
        {#each shell.services as s (s.id)}
          {@const icon = iconFor(s.id)}
          <button
            class="row"
            class:on={s.id === shell.active}
            aria-current={s.id === shell.active ? 'page' : undefined}
            title={collapsed ? `${s.name} · ${statusText(s)}` : undefined}
            onclick={() => api.select(s.id)}
          >
            <span class="marker" aria-hidden="true"><PawPrint size={12} /></span>
            <span class="logo" style:background="#{icon?.hex ?? '555'}">
              {#if icon}
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d={icon.path} fill="#fff" />
                </svg>
              {/if}
              {#if collapsed && s.unread !== 0}
                {#key s.unread}<span class="badge wag" class:dot={s.unread === 'dot'}>{label(s.unread)}</span>{/key}
              {/if}
            </span>
            {#if !collapsed}
              <span class="text">
                <span class="name">{s.name}</span>
                <span
                  class="status"
                  class:err={s.status === 'error' || s.status === 'offline'}
                  class:warn={s.needsLogin}>{statusText(s)}</span
                >
              </span>
              {#if s.unread !== 0}
                {#key s.unread}<span class="count wag" class:dot={s.unread === 'dot'}>{label(s.unread)}</span>{/key}
              {/if}
            {/if}
          </button>
        {/each}
      </nav>
    </aside>

    <section class="main">
      <header class="header">
        <span class="headline">
          {active?.name ?? ''}
          {#if shell.activeZoom !== 1}
            <button class="zoom" title="Reset zoom (Ctrl+0)" onclick={() => api.resetZoom()}
              >{Math.round(shell.activeZoom * 100)} %</button
            >
          {/if}
        </span>
        {#if active?.needsLogin}<span class="hint">Log in below to start chatting</span>{/if}
        {#if active && active.status !== 'idle' && active.status !== 'asleep'}
          <div class="tools">
            <button class="icon-btn" aria-label="Back to {active.name} start page" title="Start page" onclick={() => api.home(active.id)}>
              <House size={17} />
            </button>
            <button class="icon-btn" aria-label="Reload {active.name}" title="Reload" onclick={() => api.reload(active.id)}>
              <RotateCw size={16} />
            </button>
          </div>
        {/if}
      </header>
      <div class="stage">
        {#if active?.status === 'loading' || active?.status === 'idle'}
          <div class="state" role="status">
            <SleepyPup />
            <div class="skeleton" aria-hidden="true">
              <span style:width="62%"></span><span style:width="44%"></span><span style:width="70%"></span>
            </div>
            <p>Waking up {active.name}…</p>
          </div>
        {:else if active?.status === 'offline'}
          <div class="state" role="alert">
            <p class="err-title">You're offline</p>
            <p>PupChat tries again by itself every 15 seconds.</p>
            <button class="retry" onclick={() => api.retry(active.id)}><RotateCw size={15} /> Try now</button>
          </div>
        {:else if active?.status === 'error'}
          <div class="state" role="alert">
            <p class="err-title">{active.name} couldn't load</p>
            <p>Check your connection, then try again.</p>
            <button class="retry" onclick={() => api.retry(active.id)}><RotateCw size={15} /> Try again</button>
          </div>
        {/if}
      </div>
    </section>
  </div>
{/if}

<style>
  .panel {
    position: fixed;
    inset: 0;
    display: flex;
    border-radius: var(--r-xl);
    background: var(--glass-fill);
    box-shadow: var(--edge-glass);
    overflow: hidden;
  }

  /* Resize grip on the left edge */
  .grip {
    position: absolute;
    left: 0;
    top: var(--r-xl);
    bottom: var(--r-xl);
    width: 14px;
    cursor: ew-resize;
    z-index: 2;
    border-radius: var(--r-pill);
  }
  .grip::after {
    content: '';
    position: absolute;
    left: 6px;
    top: 50%;
    width: 4px;
    height: 44px;
    margin-top: -22px;
    border-radius: var(--r-pill);
    background: var(--glass-highlight);
    opacity: 0;
    transition: opacity var(--dur-fast);
  }
  .grip:hover::after,
  .grip.dragging::after,
  .grip:focus-visible::after {
    opacity: 0.8;
  }
  .zoom {
    margin-left: var(--sp-2);
    padding: 1px var(--sp-2);
    border-radius: var(--r-pill);
    background: var(--glass-hover);
    color: var(--c-text-2);
    font-size: var(--fs-caption);
    font-variant-numeric: tabular-nums;
  }
  .zoom:hover {
    background: var(--glass-selected);
    color: var(--c-text);
  }

  /* Sidebar */
  .sidebar {
    width: var(--sidebar-w);
    flex: none;
    display: flex;
    flex-direction: column;
    padding: var(--sp-3) var(--sp-2);
    box-sizing: border-box;
    border-right: 1px solid var(--glass-divider);
    transition: width var(--dur-base) var(--ease-out);
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 36px;
    padding: 0 var(--sp-2) var(--sp-2);
  }
  .collapsed .top {
    justify-content: center;
    padding: 0 0 var(--sp-2);
  }
  .title {
    margin: 0;
    font-size: var(--fs-title);
    font-weight: var(--fw-bold);
    letter-spacing: -0.02em;
  }
  .icon-btn {
    width: 32px;
    height: 32px;
    border-radius: var(--r-pill);
    display: grid;
    place-items: center;
    color: var(--c-accent);
    transition: background var(--dur-fast);
  }
  .icon-btn:hover {
    background: var(--glass-hover);
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-2);
    border-radius: var(--r-md);
    text-align: left;
    transition: background var(--dur-fast);
  }
  .collapsed .row {
    justify-content: center;
  }
  .row:hover {
    background: var(--glass-hover);
  }
  .row.on {
    background: var(--glass-selected);
  }
  .marker {
    position: absolute;
    left: -2px;
    color: var(--c-collar);
    opacity: 0;
    transform: scale(0.6);
    transition:
      opacity var(--dur-fast),
      transform var(--dur-base) var(--ease-out);
  }
  .collapsed .marker {
    left: -4px;
  }
  .row.on .marker {
    opacity: 1;
    transform: none;
  }
  .logo {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex: none;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name {
    font-size: var(--fs-headline);
    font-weight: var(--fw-medium);
    line-height: var(--lh-tight);
  }
  .status {
    font-size: var(--fs-caption);
    color: var(--c-text-2);
  }
  .status.err {
    color: var(--c-danger);
  }
  .status.warn {
    color: var(--c-collar);
  }
  .logo {
    position: relative;
  }
  .count,
  .badge {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    box-sizing: border-box;
    border-radius: var(--r-pill);
    background: var(--c-accent);
    color: #fff;
    font-size: var(--fs-caption);
    font-weight: var(--fw-medium);
    font-variant-numeric: tabular-nums;
    display: grid;
    place-items: center;
  }
  .count {
    margin-left: auto;
  }
  .badge {
    position: absolute;
    top: -5px;
    right: -7px;
    min-width: 18px;
    height: 18px;
    font-size: 11px;
    background: var(--c-danger);
    box-shadow: 0 0 0 2px rgba(30, 30, 36, 0.9);
  }
  .count.dot,
  .badge.dot {
    min-width: 10px;
    width: 10px;
    height: 10px;
    padding: 0;
  }
  .badge.dot {
    top: -1px;
    right: -1px;
  }
  /* Tail-wag: a little wiggle when the count changes. */
  .wag {
    animation: wag 520ms var(--ease-out);
    transform-origin: 50% 90%;
  }
  @keyframes wag {
    20% {
      transform: rotate(-14deg) scale(1.12);
    }
    45% {
      transform: rotate(11deg);
    }
    70% {
      transform: rotate(-5deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .wag {
      animation: none;
    }
  }

  /* Main */
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .header {
    height: var(--header-h);
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
  }
  .header {
    position: relative;
  }
  .tools {
    position: absolute;
    right: var(--sp-3);
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: var(--sp-1);
  }
  .tools .icon-btn {
    color: var(--c-text-2);
  }
  .tools .icon-btn:hover {
    color: var(--c-text);
  }
  .hint {
    font-size: var(--fs-caption);
    color: var(--c-collar);
  }
  .headline {
    font-size: var(--fs-headline);
    font-weight: var(--fw-medium);
  }
  .stage {
    flex: 1;
    margin: 0 var(--inset) var(--inset) 0;
    border-radius: var(--view-r);
    background: var(--glass-fill-strong);
    box-shadow: inset 0 0 0 1px var(--glass-divider);
    display: grid;
    place-items: center;
  }
  .state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-3);
    color: var(--c-text-2);
    text-align: center;
  }
  .state p {
    margin: 0;
  }
  .err-title {
    color: var(--c-text);
    font-weight: var(--fw-medium);
  }
  .skeleton {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-2);
    width: 220px;
  }
  .skeleton span {
    height: 10px;
    border-radius: var(--r-pill);
    background: linear-gradient(90deg, var(--glass-hover), var(--glass-selected), var(--glass-hover));
    background-size: 200% 100%;
    animation: shimmer 1.4s linear infinite;
  }
  @keyframes shimmer {
    to {
      background-position: -200% 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .skeleton span {
      animation: none;
    }
  }
  .retry {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-4);
    border-radius: var(--r-pill);
    background: var(--c-accent);
    color: #fff;
    font-weight: var(--fw-medium);
  }
  .retry:hover {
    background: var(--c-accent-strong);
  }
</style>
