<script lang="ts" generics="T extends string | number">
  /** Segmented control with a sliding glass highlight behind the chosen option. */
  let {
    options,
    value,
    label,
    onchange
  }: { options: { value: T; label: string }[]; value: T; label: string; onchange: (v: T) => void } = $props()
  const index = $derived(Math.max(0, options.findIndex((o) => o.value === value)))
</script>

<div class="seg" role="radiogroup" aria-label={label} style:--n={options.length} style:--i={index}>
  <span class="thumb" aria-hidden="true"></span>
  {#each options as o (o.value)}
    <button role="radio" aria-checked={o.value === value} onclick={() => onchange(o.value)}>{o.label}</button>
  {/each}
</div>

<style>
  .seg {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--n), 1fr);
    padding: 2px;
    border-radius: var(--r-pill);
    background: rgba(120, 120, 128, 0.24);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
    flex: none;
  }
  .thumb {
    position: absolute;
    top: 2px;
    bottom: 2px;
    left: 2px;
    width: calc((100% - 4px) / var(--n));
    transform: translateX(calc(100% * var(--i)));
    border-radius: var(--r-pill);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0.2));
    box-shadow:
      0 3px 8px rgba(0, 0, 0, 0.22),
      inset 0 1px 0 rgba(255, 255, 255, 0.45);
    transition: transform var(--dur-base) var(--ease-out);
  }
  button {
    position: relative;
    padding: 5px 12px;
    font-size: 13px;
    font-weight: var(--fw-medium);
    color: var(--c-text-2);
    border-radius: var(--r-pill);
    white-space: nowrap;
    transition: color var(--dur-fast);
  }
  button[aria-checked='true'] {
    color: var(--c-text);
  }
</style>
