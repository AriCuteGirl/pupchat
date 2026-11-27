<script lang="ts">
  import { ChevronDown, Plus } from '@lucide/svelte'
  import { onMount } from 'svelte'
  import type { ShellApi, ShellState } from '../../../shared/ipc'
  import type { Pin } from '../../../shared/pins'
  import { SERVICES } from '../../../shared/services'
  import { serviceIcon } from './icons'

  /** Pinned chats of the active platform, in colored collapsible categories (PinDMs-style). */
  let { shell, api, collapsed }: { shell: ShellState; api: ShellApi; collapsed: boolean } = $props()

  const service = $derived(shell.active)
  const cats = $derived(shell.pins.categories.filter((c) => c.service === service))
  const items = $derived(shell.pins.items.filter((p) => p.service === service))
  const groups = $derived([
    ...(items.some((p) => p.category === '')
      ? [{ id: '', name: 'Pinned', color: '#cad3f5', collapsed: false, pins: items.filter((p) => p.category === '') }]
      : []),
    ...cats.map((c) => ({ ...c, pins: items.filter((p) => p.category === c.id) }))
  ])
  const currentUrlPinId = $derived(shell.current.pinnedId)
  const pinnable = $derived(shell.pinPlatforms.includes(service))
  const logo = $derived(serviceIcon(SERVICES.find((x) => x.id === service)?.icon ?? ''))

  // Inline rename (started from the right-click menu).
  let renaming = $state<{ kind: 'pin' | 'category'; id: string } | null>(null)
  let draft = $state('')
  onMount(() =>
    api.onStartRename((r) => {
      renaming = r
      const src =
        r.kind === 'pin'
          ? shell.pins.items.find((p) => p.id === r.id)?.name
          : shell.pins.categories.find((c) => c.id === r.id)?.name
      draft = src ?? ''
    })
  )
  function commit(): void {
    if (!renaming) return
    if (draft.trim()) {
      if (renaming.kind === 'pin') api.renamePin(renaming.id, draft)
      else api.renameCategory(renaming.id, draft)
    }
    renaming = null
  }
  function focusSelect(el: HTMLInputElement): void {
    el.focus()
    el.select()
  }
  const initial = (p: Pin): string => (p.name.replace(/^[#@]/, '') || '?').slice(0, 1).toUpperCase()
</script>

{#if pinnable}
  <div class="pins" class:collapsed aria-label="Pinned chats">
    {#if !groups.length && !collapsed}
      <p class="hint">Open a chat and press 📌 to pin it here.</p>
    {/if}
    {#each groups as g (g.id)}
      {#if !collapsed}
        <div class="cat" style:--cat={g.color}>
          {#if renaming?.kind === 'category' && renaming.id === g.id}
            <input
              class="rename cat-rename"
              bind:value={draft}
              use:focusSelect
              onkeydown={(e) => (e.key === 'Enter' ? commit() : e.key === 'Escape' && (renaming = null))}
              onblur={commit}
              aria-label="Category name"
            />
          {:else}
            <button
              class="cat-btn"
              aria-expanded={!g.collapsed}
              onclick={() => g.id && api.toggleCategory(g.id)}
              oncontextmenu={(e) => {
                e.preventDefault()
                if (g.id) api.categoryMenu(g.id)
              }}
            >
              <span class="cat-name">{g.name}</span>
              {#if g.id}<span class="chev" class:shut={g.collapsed}><ChevronDown size={14} /></span>{/if}
            </button>
          {/if}
        </div>
      {:else}
        <span class="rail-sep" style:background={g.color}></span>
      {/if}
      {#if !g.collapsed}
        {#each g.pins as p (p.id)}
          {#if renaming?.kind === 'pin' && renaming.id === p.id && !collapsed}
            <div class="pin">
              <span class="av">{#if p.avatar}<img src={p.avatar} alt="" />{:else}<span class="ini" style:background={g.color}>{initial(p)}</span>{/if}</span>
              <input
                class="rename"
                bind:value={draft}
                use:focusSelect
                onkeydown={(e) => (e.key === 'Enter' ? commit() : e.key === 'Escape' && (renaming = null))}
                onblur={commit}
                aria-label="Chat name"
              />
            </div>
          {:else}
            <button
              class="pin"
              class:on={p.id === currentUrlPinId}
              title={collapsed ? p.name : undefined}
              onclick={() => api.openPin(p.id)}
              oncontextmenu={(e) => {
                e.preventDefault()
                api.pinMenu(p.id)
              }}
            >
              <span class="av-wrap">
                <span class="av">
                  {#if p.avatar}<img src={p.avatar} alt="" />{:else}<span class="ini" style:background={g.color}>{initial(p)}</span>{/if}
                </span>
                {#if logo}
                  <span class="badge" style:background="#{logo.hex}" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="9" height="9"><path d={logo.path} fill="#fff" /></svg>
                  </span>
                {/if}
              </span>
              {#if !collapsed}<span class="pname">{p.name}</span>{/if}
            </button>
          {/if}
        {/each}
      {/if}
    {/each}
    {#if !collapsed}
      <button class="add-cat" onclick={() => api.addCategory(service)}>
        <Plus size={13} /> New category
      </button>
    {/if}
  </div>
{/if}

<style>
  .pins {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin-top: var(--sp-3);
    padding-top: var(--sp-2);
    border-top: 1px solid var(--glass-divider);
    overflow-y: auto;
    flex: 0 1 auto;
    min-height: 0;
    scrollbar-width: none;
  }
  .cat {
    margin-top: var(--sp-2);
  }
  .cat-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px var(--sp-2);
    border-radius: var(--r-sm);
    color: var(--cat);
  }
  .cat-btn:hover {
    background: var(--glass-hover);
  }
  .cat-name {
    font-size: 12px;
    font-weight: var(--fw-bold);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .chev {
    display: grid;
    color: var(--c-text-3);
    transition: transform var(--dur-base) var(--ease-out);
  }
  .chev.shut {
    transform: rotate(-90deg);
  }
  .pin {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px var(--sp-2);
    border-radius: var(--r-md);
    text-align: left;
    min-width: 0;
    transition: background var(--dur-fast);
  }
  .collapsed .pin {
    justify-content: center;
    padding: 4px 0;
  }
  .pin:hover {
    background: var(--glass-hover);
  }
  .pin.on {
    background: var(--glass-selected);
  }
  .av-wrap {
    position: relative;
    display: block;
    flex: none;
    width: 32px;
    height: 32px;
  }
  .badge {
    position: absolute;
    right: -3px;
    bottom: -3px;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    box-shadow: 0 0 0 2px rgba(30, 30, 36, 0.95);
  }
  .av {
    display: block;
    width: 32px;
    height: 32px;
    flex: none;
    border-radius: 50%;
    overflow: hidden;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
  }
  .av img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .ini {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    font-weight: var(--fw-bold);
    font-size: 14px;
    color: #1e1e24;
  }
  .pname {
    font-size: var(--fs-body);
    color: var(--c-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rename {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-size: var(--fs-body);
    color: var(--c-text);
    background: rgba(120, 120, 128, 0.28);
    border: none;
    border-radius: var(--r-sm);
    padding: 4px 8px;
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .cat-rename {
    width: 100%;
    font-size: 12px;
    font-weight: var(--fw-bold);
    text-transform: uppercase;
  }
  .hint {
    margin: var(--sp-2) var(--sp-2) 0;
    font-size: var(--fs-caption);
    color: var(--c-text-3);
    line-height: 1.4;
  }
  .add-cat {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin: var(--sp-2) var(--sp-2) 0;
    padding: 3px 8px;
    align-self: flex-start;
    border-radius: var(--r-pill);
    font-size: var(--fs-caption);
    color: var(--c-text-3);
  }
  .add-cat:hover {
    background: var(--glass-hover);
    color: var(--c-text-2);
  }
  .rail-sep {
    width: 22px;
    height: 3px;
    border-radius: 2px;
    margin: 8px auto 4px;
    opacity: 0.85;
  }
</style>
