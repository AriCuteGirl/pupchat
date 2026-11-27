<script lang="ts">
  /** iOS-style switch on glass: glossy knob that stretches a little while pressed. */
  let { checked, label, onchange }: { checked: boolean; label: string; onchange: (v: boolean) => void } =
    $props()
</script>

<button class="switch" role="switch" aria-checked={checked} aria-label={label} onclick={() => onchange(!checked)}>
  <span class="knob"></span>
</button>

<style>
  .switch {
    --w: 46px;
    --h: 28px;
    --pad: 2px;
    --knob: calc(var(--h) - var(--pad) * 2);
    width: var(--w);
    height: var(--h);
    flex: none;
    position: relative;
    border-radius: var(--r-pill);
    background: rgba(120, 120, 128, 0.32);
    box-shadow:
      inset 0 1px 2px rgba(0, 0, 0, 0.25),
      inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    transition: background var(--dur-base) var(--ease-out);
  }
  .switch[aria-checked='true'] {
    background: var(--c-accent);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.25),
      0 0 12px rgba(10, 132, 255, 0.35);
  }
  .knob {
    position: absolute;
    top: var(--pad);
    left: var(--pad);
    width: var(--knob);
    height: var(--knob);
    border-radius: var(--r-pill);
    background: linear-gradient(180deg, #ffffff 0%, #ececf0 100%);
    box-shadow:
      0 3px 8px rgba(0, 0, 0, 0.28),
      0 1px 1px rgba(0, 0, 0, 0.16),
      inset 0 -1px 0 rgba(0, 0, 0, 0.06);
    transition:
      transform var(--dur-base) var(--ease-out),
      width var(--dur-fast) var(--ease-out);
  }
  .switch[aria-checked='true'] .knob {
    transform: translateX(calc(var(--w) - var(--knob) - var(--pad) * 2));
  }
  /* Press: the knob stretches toward the other side, like iOS. */
  .switch:active .knob {
    width: calc(var(--knob) + 6px);
  }
  .switch[aria-checked='true']:active .knob {
    transform: translateX(calc(var(--w) - var(--knob) - 6px - var(--pad) * 2));
  }
</style>
