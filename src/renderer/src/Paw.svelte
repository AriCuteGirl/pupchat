<script lang="ts">
  import { PawPrint } from '@lucide/svelte'

  const paw = (window as unknown as { paw: { click: () => void } }).paw
</script>

<button class="paw" aria-label="Open PupChat" onclick={() => paw.click()}>
  <PawPrint size={22} strokeWidth={2.2} />
</button>

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
</style>
