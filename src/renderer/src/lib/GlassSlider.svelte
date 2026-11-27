<script lang="ts">
  /** Range slider: glass track, blue fill up to the knob, glass knob. */
  let {
    value,
    min,
    max,
    step = 0.01,
    label,
    oninput
  }: { value: number; min: number; max: number; step?: number; label: string; oninput: (v: number) => void } =
    $props()
  const pct = $derived(((value - min) / (max - min)) * 100)
</script>

<input
  class="slider"
  type="range"
  aria-label={label}
  {min}
  {max}
  {step}
  {value}
  style:--pct="{pct}%"
  oninput={(e) => oninput(Number((e.currentTarget as HTMLInputElement).value))}
/>

<style>
  .slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 28px;
    background: transparent;
    margin: 0;
    cursor: pointer;
  }
  .slider::-webkit-slider-runnable-track {
    height: 8px;
    border-radius: var(--r-pill);
    background: linear-gradient(
      90deg,
      var(--c-accent) 0%,
      #5eb1ff var(--pct),
      rgba(120, 120, 128, 0.32) var(--pct)
    );
    box-shadow:
      inset 0 1px 2px rgba(0, 0, 0, 0.25),
      inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 26px;
    height: 26px;
    margin-top: -9px;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 30%, #ffffff 0%, #f1f1f5 60%, #dcdce2 100%);
    box-shadow:
      0 4px 10px rgba(0, 0, 0, 0.3),
      0 0 0 0.5px rgba(0, 0, 0, 0.12);
    transition: transform var(--dur-fast) var(--ease-out);
  }
  .slider:active::-webkit-slider-thumb {
    transform: scale(1.12);
  }
  .slider:focus-visible {
    box-shadow: none;
  }
  .slider:focus-visible::-webkit-slider-thumb {
    box-shadow:
      0 4px 10px rgba(0, 0, 0, 0.3),
      var(--focus-ring);
  }
</style>
