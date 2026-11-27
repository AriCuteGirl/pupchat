<script lang="ts">
  import { Check, Plus } from '@lucide/svelte'

  /** Preset swatches plus a custom color, as #rrggbb. */
  let {
    value,
    presets,
    label,
    compact = false,
    onchange
  }: {
    value: string
    presets: { color: string; name: string }[]
    label: string
    compact?: boolean
    onchange: (c: string) => void
  } = $props()
  const isPreset = $derived(presets.some((p) => p.color === value))
</script>

<div class="picker" class:compact role="radiogroup" aria-label={label}>
  {#each presets as p (p.color)}
    <button
      class="swatch"
      role="radio"
      aria-checked={p.color === value}
      aria-label={p.name}
      title={p.name}
      style:--c={p.color}
      onclick={() => onchange(p.color)}
    >
      {#if p.color === value}<Check size={compact ? 11 : 13} strokeWidth={3} />{/if}
    </button>
  {/each}
  <label class="swatch custom" class:on={!isPreset} style:--c={isPreset ? 'transparent' : value} title="Custom color">
    <input
      type="color"
      aria-label="{label}: custom color"
      {value}
      oninput={(e) => onchange((e.currentTarget as HTMLInputElement).value)}
    />
    {#if isPreset}<Plus size={compact ? 11 : 13} />{:else}<Check size={compact ? 11 : 13} strokeWidth={3} />{/if}
  </label>
</div>

<style>
  .picker {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .swatch {
    --size: 28px;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    background: var(--c);
    display: grid;
    place-items: center;
    color: #fff;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.1);
    transition:
      transform var(--dur-fast) var(--ease-out),
      box-shadow var(--dur-fast);
    cursor: pointer;
    position: relative;
  }
  .compact .swatch {
    --size: 22px;
  }
  .swatch:hover {
    transform: scale(1.08);
  }
  .swatch[aria-checked='true'],
  .custom.on {
    box-shadow:
      0 0 0 2px rgba(30, 30, 36, 0.9),
      0 0 0 4px rgba(255, 255, 255, 0.85);
  }
  .custom {
    background: conic-gradient(from 0deg, #ff375f, #ff9f0a, #ffd60a, #30d158, #40c8e0, #0a84ff, #bf5af2, #ff375f);
  }
  .custom.on {
    background: var(--c);
  }
  .custom input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    width: 100%;
    height: 100%;
  }
</style>
