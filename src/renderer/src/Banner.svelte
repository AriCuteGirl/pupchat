<script lang="ts">
  import { X } from '@lucide/svelte'
  import { SERVICES } from '../../shared/services'
  import { serviceIcon } from './lib/icons'

  interface BannerData {
    service: string
    name: string
    title: string
    body: string
    icon: string
    more: number
  }
  const bridge = (window as unknown as {
    banner: {
      onShow: (fn: (b: BannerData) => void) => void
      click: () => void
      dismiss: () => void
      hover: (on: boolean) => void
    }
  }).banner

  let b = $state<BannerData | null>(null)
  let key = $state(0)
  bridge.onShow((data) => {
    b = data
    key++
  })
  const logo = $derived(b ? serviceIcon(SERVICES.find((s) => s.id === b!.service)?.icon ?? '') : undefined)
  let iconFailed = $state(false)
  $effect(() => {
    void key
    iconFailed = false
  })
</script>

{#if b}
  {#key key}
    <div
      class="banner"
      role="button"
      tabindex="0"
      aria-label="{b.name}: {b.title}. Open chat"
      onclick={() => bridge.click()}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && bridge.click()}
      onmouseenter={() => bridge.hover(true)}
      onmouseleave={() => bridge.hover(false)}
    >
      <div class="avatar">
        {#if b.icon && !iconFailed}
          <img src={b.icon} alt="" onerror={() => (iconFailed = true)} />
        {:else if logo}
          <!-- No sender picture (e.g. a count-only banner): the platform's logo. -->
          <span class="initial" style:background="#{logo.hex}">
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d={logo.path} fill="#fff" /></svg>
          </span>
        {:else}
          <span class="initial">{(b.title || b.name).slice(0, 1).toUpperCase()}</span>
        {/if}
        {#if logo && b.icon && !iconFailed}
          <span class="badge" style:background="#{logo.hex}">
            <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path d={logo.path} fill="#fff" /></svg>
          </span>
        {/if}
      </div>
      <div class="text">
        <div class="top">
          <span class="app">{b.name}</span>
          <span class="time">now{b.more ? ` · +${b.more} more` : ''}</span>
        </div>
        <div class="title">{b.title}</div>
        {#if b.body}<div class="body">{b.body}</div>{/if}
      </div>
      <button
        class="close"
        aria-label="Dismiss"
        onclick={(e) => {
          e.stopPropagation()
          bridge.dismiss()
        }}><X size={13} /></button
      >
    </div>
  {/key}
{/if}

<style>
  :global(html, body) {
    background: transparent;
  }
  .banner {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 14px;
    border-radius: 22px;
    background: rgba(40, 40, 46, 0.55);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.4),
      inset 0 0 0 1px rgba(255, 255, 255, 0.14);
    cursor: pointer;
    animation: drop 320ms var(--ease-out);
    outline: none;
  }
  .banner:hover {
    background: rgba(46, 46, 54, 0.62);
  }
  .banner:focus-visible {
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.4),
      var(--focus-ring);
  }
  @keyframes drop {
    from {
      transform: translateY(-10px) scale(0.97);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .banner {
      animation: none;
    }
  }
  .avatar {
    position: relative;
    width: 44px;
    height: 44px;
    flex: none;
  }
  .avatar img,
  .initial {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    display: grid;
    place-items: center;
    background: linear-gradient(180deg, #8e8e93, #636366);
    font-weight: var(--fw-bold);
    font-size: 18px;
    color: #fff;
  }
  .badge {
    position: absolute;
    right: -3px;
    bottom: -3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    box-shadow: 0 0 0 2px rgba(40, 40, 46, 0.9);
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  .top {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 11px;
    color: var(--c-text-2);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .time {
    text-transform: none;
    letter-spacing: 0;
    padding-right: 18px;
  }
  .title {
    font-weight: var(--fw-bold);
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .body {
    font-size: 13px;
    color: var(--c-text);
    opacity: 0.9;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.3;
  }
  .close {
    position: absolute;
    top: 8px;
    right: 10px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: var(--c-text-2);
    background: rgba(120, 120, 128, 0.3);
    opacity: 0;
    transition: opacity var(--dur-fast);
  }
  .banner:hover .close,
  .close:focus-visible {
    opacity: 1;
  }
</style>
