<script lang="ts">
  import { ArrowDown, ArrowUp, Bell, Bone, MessageCircle, Mic, PawPrint, Power, VolumeX, X } from '@lucide/svelte'
  import type { ShellApi, ShellState } from '../../shared/ipc'
  import { SERVICES } from '../../shared/services'
  import { LIMITS, SLEEP_CHOICES, type ServicePrefs, type Settings } from '../../shared/settings'
  import GlassSlider from './lib/GlassSlider.svelte'
  import { serviceIcon } from './lib/icons'
  import PillToggle from './lib/PillToggle.svelte'
  import Segmented from './lib/Segmented.svelte'
  import Switch from './lib/Switch.svelte'

  let { shell, api }: { shell: ShellState; api: ShellApi } = $props()
  const s = $derived(shell.settings)

  // Svelte state is a proxy that can't be cloned or sent over IPC: send a plain snapshot.
  const update = (patch: Partial<Settings>): void => api.updateSettings($state.snapshot(patch) as Partial<Settings>)
  function setPref(id: string, patch: Partial<ServicePrefs>): void {
    const services = $state.snapshot(s.services) as Settings['services']
    services[id] = { ...services[id]!, ...patch }
    update({ services })
  }
  function move(id: string, by: -1 | 1): void {
    const order = [...s.order]
    const i = order.indexOf(id)
    const j = i + by
    if (i < 0 || j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j]!, order[i]!]
    update({ order })
  }
  const def = (id: string) => SERVICES.find((x) => x.id === id)
  const enabledCount = $derived(s.order.filter((id) => s.services[id]?.enabled).length)
  const sleepOptions = SLEEP_CHOICES.map((m) => ({
    value: m as number,
    label: m === 0 ? 'Never' : m < 60 ? `${m} min` : `${m / 60} h`
  }))
  const chatGlassPct = $derived(
    Math.round(((s.chatGlass - LIMITS.minChatGlass) / (LIMITS.maxChatGlass - LIMITS.minChatGlass)) * 100)
  )
  const anySkin = $derived(s.order.some((id) => s.services[id]?.enabled && s.services[id]?.skin))
  const glassPct = $derived(
    Math.round(((s.glassOpacity - LIMITS.minGlass) / (LIMITS.maxGlass - LIMITS.minGlass)) * 100)
  )

  let hotkeyDraft = $state('')
  let hotkeyError = $state('')
  $effect(() => {
    hotkeyDraft = s.windowsHotkey
  })
  function saveHotkey(): void {
    const ok = /^((Ctrl|Control|Alt|Shift|Super|Meta|CommandOrControl|CmdOrCtrl)\+){1,3}[A-Za-z0-9]{1,9}$/.test(
      hotkeyDraft.trim()
    )
    hotkeyError = ok ? '' : 'Use modifiers and a key, like Ctrl+Shift+Space'
    if (ok) update({ windowsHotkey: hotkeyDraft.trim() })
  }
</script>

<div class="settings" role="region" aria-label="Settings">
  <header>
    <h2>Settings</h2>
    <button class="close" aria-label="Close settings" onclick={() => api.setSettingsOpen(false)}><X size={18} /></button>
  </header>

  <h3>While gaming</h3>
  <div class="group">
    <div class="row">
      <span class="ico" style:background="#e8a87c"><Bone size={16} /></span>
      <div class="label">
        <span class="title">Game mode</span>
        <span class="desc">No banners or platform sounds while PupChat is hidden. Badges keep counting.</span>
      </div>
      <Switch label="Game mode" checked={s.gameMode} onchange={(v) => update({ gameMode: v })} />
    </div>
    <div class="row">
      <span class="ico" style:background="#5e5ce6"><PawPrint size={16} /></span>
      <div class="label">
        <span class="title">Hide when you click another window</span>
        <span class="desc">Clicking back into your game closes the panel.</span>
      </div>
      <Switch label="Hide when you click another window" checked={s.hideOnBlur} onchange={(v) => update({ hideOnBlur: v })} />
    </div>
    <div class="row stacked">
      <div class="line">
        <span class="ico" style:background="#30b0c7"><Power size={16} /></span>
        <div class="label">
          <span class="title">Put unused platforms to sleep</span>
          <span class="desc">Frees RAM. A sleeping platform shows no badges until you open it again.</span>
        </div>
      </div>
      <div class="control-line">
        <Segmented
          label="Put unused platforms to sleep after"
          options={sleepOptions}
          value={s.sleepAfterMinutes}
          onchange={(v) => update({ sleepAfterMinutes: v })}
        />
      </div>
    </div>
  </div>

  <h3>Look</h3>
  <div class="group">
    <div class="row">
      <div class="label"><span class="title">Dock to</span></div>
      <Segmented
        label="Dock to"
        options={[
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' }
        ]}
        value={s.side}
        onchange={(v) => update({ side: v as 'left' | 'right' })}
      />
    </div>
    <div class="row stacked">
      <div class="line">
        <div class="label">
          <span class="title">Glass</span>
          <span class="desc">How much of your game shows through.</span>
        </div>
        <span class="value">{glassPct} %</span>
      </div>
      <div class="control-line slider-line">
        <span class="end">Clear</span>
        <GlassSlider
          label="Glass opacity"
          min={LIMITS.minGlass}
          max={LIMITS.maxGlass}
          value={s.glassOpacity}
          oninput={(v) => update({ glassOpacity: v })}
        />
        <span class="end">Solid</span>
      </div>
    </div>
    <div class="row stacked">
      <div class="line">
        <div class="label">
          <span class="title">Chat glass</span>
          <span class="desc">
            {anySkin
              ? 'How see-through the chats are, for platforms with the iMessage look.'
              : 'Turn on the iMessage look for a platform below to make its chats see-through.'}
          </span>
        </div>
        <span class="value">{chatGlassPct} %</span>
      </div>
      <div class="control-line slider-line" class:dim={!anySkin}>
        <span class="end">Clear</span>
        <GlassSlider
          label="Chat glass"
          min={LIMITS.minChatGlass}
          max={LIMITS.maxChatGlass}
          value={s.chatGlass}
          oninput={(v) => update({ chatGlass: v })}
        />
        <span class="end">Solid</span>
      </div>
    </div>
    <div class="row">
      <div class="label">
        <span class="title">Width</span>
        <span class="desc">Drag the panel's edge to change it.</span>
      </div>
      <span class="value">{s.panelWidth} px</span>
      {#if s.panelWidth !== 1000}
        <button class="text-btn" onclick={() => update({ panelWidth: 1000 })}>Reset</button>
      {/if}
    </div>
  </div>

  <h3>Platforms</h3>
  <div class="group">
    {#each s.order as id, i (id)}
      {@const d = def(id)}
      {@const icon = serviceIcon(d?.icon ?? '')}
      {@const p = s.services[id]!}
      <div class="row stacked platform" class:off={!p.enabled}>
        <div class="line">
          <span class="logo" style:background="#{icon?.hex ?? '555'}">
            {#if icon}<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d={icon.path} fill="#fff" /></svg>{/if}
          </span>
          <span class="pname">{d?.name ?? id}</span>
          <div class="reorder">
            <button class="mini" aria-label="Move {d?.name} up" disabled={i === 0} onclick={() => move(id, -1)}><ArrowUp size={15} /></button>
            <button class="mini" aria-label="Move {d?.name} down" disabled={i === s.order.length - 1} onclick={() => move(id, 1)}><ArrowDown size={15} /></button>
          </div>
          <Switch
            label="Show {d?.name}"
            checked={p.enabled}
            onchange={(v) => {
              if (!v && enabledCount <= 1) return
              setPref(id, { enabled: v })
            }}
          />
        </div>
        {#if p.enabled}
          <div class="pills">
            <PillToggle label="Banners" on={p.notifications} onchange={(v) => setPref(id, { notifications: v })}>
              {#snippet icon()}<Bell size={13} />{/snippet}
            </PillToggle>
            <PillToggle label="Muted" tone="warn" on={p.muted} onchange={(v) => setPref(id, { muted: v })}>
              {#snippet icon()}<VolumeX size={13} />{/snippet}
            </PillToggle>
            <PillToggle label="Mic and camera" on={p.media} onchange={(v) => setPref(id, { media: v })}>
              {#snippet icon()}<Mic size={13} />{/snippet}
            </PillToggle>
            <PillToggle label={id === 'discord' ? 'iMessage colors' : 'iMessage look'} on={p.skin} onchange={(v) => setPref(id, { skin: v })}>
              {#snippet icon()}<MessageCircle size={13} />{/snippet}
            </PillToggle>
          </div>
        {/if}
      </div>
    {/each}
  </div>
  {#if enabledCount <= 1}<p class="note">At least one platform stays on.</p>{/if}
  <p class="note">
    iMessage look: blue and gray bubbles, see-through glass chats, pill inputs and round blue
    send buttons where the site allows. It's optional and may partly stop working when a site
    updates its design.
  </p>

  <h3>Startup</h3>
  <div class="group">
    <div class="row">
      <div class="label">
        <span class="title">Launch at login</span>
        <span class="desc">Starts hidden; the paw opens it.</span>
      </div>
      <Switch label="Launch at login" checked={s.launchAtLogin} onchange={(v) => update({ launchAtLogin: v })} />
    </div>
    {#if shell.platform === 'win32'}
      <div class="row">
        <div class="label">
          <span class="title">Show/hide shortcut</span>
          {#if hotkeyError}<span class="desc err">{hotkeyError}</span>{:else}<span class="desc">Works everywhere in Windows.</span>{/if}
        </div>
        <input class="hotkey" aria-label="Show/hide shortcut" bind:value={hotkeyDraft} onchange={saveHotkey} oninput={() => (hotkeyError = '')} />
      </div>
    {/if}
  </div>
</div>

<style>
  .settings {
    height: 100%;
    overflow-y: auto;
    padding: var(--sp-5) var(--sp-6) var(--sp-6);
    box-sizing: border-box;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
  }
  .settings::-webkit-scrollbar {
    width: 10px;
  }
  .settings::-webkit-scrollbar-track {
    background: transparent;
  }
  .settings::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.16);
    border: 3px solid transparent;
    background-clip: padding-box;
    border-radius: var(--r-pill);
  }
  .settings::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
    background-clip: padding-box;
  }
  header,
  h3,
  .group,
  .note {
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h2 {
    margin: 0;
    font-size: 26px;
    font-weight: var(--fw-bold);
    letter-spacing: -0.02em;
  }
  h3 {
    margin-top: var(--sp-5);
    margin-bottom: var(--sp-2);
    padding-left: var(--sp-4);
    font-size: var(--fs-caption);
    font-weight: var(--fw-medium);
    color: var(--c-text-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .close {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: var(--c-text-2);
    background: rgba(120, 120, 128, 0.2);
  }
  .close:hover {
    background: rgba(120, 120, 128, 0.32);
    color: var(--c-text);
  }

  /* iOS-style inset group: one glass card, rows split by hairlines. */
  .group {
    border-radius: var(--r-lg);
    background: rgba(255, 255, 255, 0.06);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.12),
      inset 0 0 0 1px rgba(255, 255, 255, 0.05);
    overflow: hidden;
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: 12px var(--sp-4);
    min-height: 52px;
    box-sizing: border-box;
    position: relative;
  }
  .row + .row::before {
    content: '';
    position: absolute;
    top: 0;
    left: var(--sp-4);
    right: 0;
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
  }
  .row.stacked {
    flex-direction: column;
    align-items: stretch;
    gap: var(--sp-3);
  }
  .line {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .control-line {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding-left: 40px;
  }
  .slider-line {
    padding-left: 0;
  }
  .dim {
    opacity: 0.45;
  }
  .end {
    font-size: var(--fs-caption);
    color: var(--c-text-3);
    flex: none;
  }
  .ico {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    color: #fff;
    flex: none;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  .label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .title {
    font-weight: var(--fw-medium);
  }
  .desc {
    font-size: var(--fs-caption);
    color: var(--c-text-2);
    line-height: 1.35;
  }
  .desc.err {
    color: var(--c-danger);
  }
  .value {
    font-size: 13px;
    color: var(--c-text-2);
    font-variant-numeric: tabular-nums;
  }
  .text-btn {
    color: var(--c-accent);
    font-weight: var(--fw-medium);
    font-size: 13px;
  }
  .hotkey {
    font: inherit;
    font-size: 13px;
    color: var(--c-text);
    width: 150px;
    padding: 6px 10px;
    border-radius: var(--r-sm);
    background: rgba(120, 120, 128, 0.24);
    border: none;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.25);
  }

  /* Platforms */
  .logo {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex: none;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  .pname {
    flex: 1;
    font-weight: var(--fw-medium);
  }
  .platform.off .logo,
  .platform.off .pname {
    opacity: 0.45;
  }
  .reorder {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity var(--dur-fast);
  }
  .platform:hover .reorder,
  .platform:focus-within .reorder {
    opacity: 1;
  }
  .mini {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: var(--c-text-2);
  }
  .mini:hover:not(:disabled) {
    background: rgba(120, 120, 128, 0.24);
    color: var(--c-text);
  }
  .mini:disabled {
    opacity: 0.25;
    cursor: default;
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    padding-left: 40px;
  }
  .note {
    font-size: var(--fs-caption);
    color: var(--c-text-3);
    margin-top: 6px;
    padding-left: var(--sp-4);
  }
</style>
