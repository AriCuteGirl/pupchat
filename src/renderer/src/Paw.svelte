<script lang="ts">
  import { PawPrint } from '@lucide/svelte'

  const paw = (window as unknown as {
    paw: { click: () => void; onUnread: (fn: (n: number) => void) => void }
  }).paw
  let unread = $state(0)
  paw.onUnread((n) => {
    unread = n
  })
  const label = $derived(unread > 99 ? '99+' : String(unread))
</script>

<button
  class="paw"
  aria-label={unread ? `Open PupChat, ${unread} unread` : 'Open PupChat'}
  onclick={() => paw.click()}
>
  <PawPrint size={22} strokeWidth={2.2} />
</button>
{#if unread > 0}
  {#key unread}<span class="badge wag" aria-hidden="true">{label}</span>{/key}
{/if}

<style>
  .paw {
    width: 48px;
    height: 48px;
    margin: 4px;
    border-radius: var(--r-pill);
    background: rgba(255, 255, 255, 0.1);
    box-shadow:
      var(--edge-glass),
      inset 0 -1px 0 rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.92);
    display: grid;
    place-items: center;
    transition:
      background var(--dur-fast),
      transform var(--dur-base) var(--ease-out);
  }
  .paw:hover {
    background: rgba(255, 255, 255, 0.18);
    transform: scale(1.06);
  }
  .paw:active {
    transform: scale(0.96);
  }
  /* The paw window is clipped to a circle (Hyprland rounding 28 on a 56 px window), so the
     badge sits inside that circle: centered at (40, 16), 18 px tall. */
  .badge {
    position: absolute;
    top: 7px;
    right: 7px;
    box-shadow: 0 0 0 1.5px rgba(30, 30, 36, 0.85);
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    box-sizing: border-box;
    border-radius: var(--r-pill);
    background: var(--c-danger);
    color: #fff;
    font-size: 11px;
    font-weight: var(--fw-medium);
    font-variant-numeric: tabular-nums;
    display: grid;
    place-items: center;
    pointer-events: none;
  }
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
</style>
