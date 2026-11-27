<script lang="ts">
  import { PanelLeftClose, PanelLeftOpen, PawPrint, RotateCw } from '@lucide/svelte'
  import type { ServiceStatus, ShellApi, ShellState } from '../../shared/ipc'
  import { LAYOUT, sidebarWidth } from '../../shared/layout'
  import { serviceIcon } from './lib/icons'
  import SleepyPup from './lib/SleepyPup.svelte'
  import { SERVICES } from '../../shared/services'

  const api = (window as unknown as { pupchat: ShellApi }).pupchat
  let shell = $state<ShellState | null>(null)
  void api.getState().then((s) => (shell = s))
  api.onState((s) => (shell = s))

  const active = $derived(shell?.services.find((s) => s.id === shell?.active))
  const collapsed = $derived(shell?.collapsed ?? false)

  const STATUS_TEXT: Record<ServiceStatus, string> = {
    idle: 'Not opened yet',
    loading: 'Loading…',
    ready: 'Ready',
    error: "Couldn't load"
  }
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
            title={collapsed ? `${s.name} · ${STATUS_TEXT[s.status]}` : undefined}
            onclick={() => api.select(s.id)}
          >
            <span class="marker" aria-hidden="true"><PawPrint size={12} /></span>
            <span class="logo" style:background="#{icon?.hex ?? '555'}">
              {#if icon}
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d={icon.path} fill="#fff" />
                </svg>
              {/if}
            </span>
            {#if !collapsed}
              <span class="text">
                <span class="name">{s.name}</span>
                <span class="status" class:err={s.status === 'error'}>{STATUS_TEXT[s.status]}</span>
              </span>
            {/if}
          </button>
        {/each}
      </nav>
    </aside>

    <section class="main">
      <header class="header">
        <span class="headline">{active?.name ?? ''}</span>
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
    display: grid;
    place-items: center;
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
