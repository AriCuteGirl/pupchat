<script lang="ts">
  import type { Snippet } from 'svelte'

  /** Small on/off pill with an icon; lights up when on. */
  let {
    on,
    label,
    tone = 'accent',
    onchange,
    icon
  }: {
    on: boolean
    label: string
    tone?: 'accent' | 'warn'
    onchange: (v: boolean) => void
    icon: Snippet
  } = $props()
</script>

<button class="pill {tone}" aria-pressed={on} onclick={() => onchange(!on)}>
  {@render icon()}
  <span>{label}</span>
</button>

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 11px 5px 9px;
    border-radius: var(--r-pill);
    font-size: 12.5px;
    font-weight: var(--fw-medium);
    color: var(--c-text-2);
    background: rgba(120, 120, 128, 0.18);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
    transition:
      background var(--dur-fast),
      color var(--dur-fast),
      box-shadow var(--dur-fast);
  }
  .pill:hover {
    background: rgba(120, 120, 128, 0.28);
  }
  .pill[aria-pressed='true'].accent {
    color: #fff;
    background: rgba(10, 132, 255, 0.85);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.25),
      0 0 10px rgba(10, 132, 255, 0.3);
  }
  .pill[aria-pressed='true'].warn {
    color: #2b1a10;
    background: var(--c-collar);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
  }
</style>
