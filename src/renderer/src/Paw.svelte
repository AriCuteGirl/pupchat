<script lang="ts">
  // Step 2 paw: functional glass pill. Final glass + badge styling comes with the design system.
  const paw = (window as unknown as { paw: { click: () => void } }).paw
</script>

<button class="paw" aria-label="Toggle PupChat" onclick={() => paw.click()}>
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <g fill="currentColor">
      <ellipse cx="12" cy="16" rx="4.6" ry="3.8" />
      <ellipse cx="6" cy="10.5" rx="2" ry="2.5" />
      <ellipse cx="18" cy="10.5" rx="2" ry="2.5" />
      <ellipse cx="9.2" cy="6.2" rx="2" ry="2.6" />
      <ellipse cx="14.8" cy="6.2" rx="2" ry="2.6" />
    </g>
  </svg>
</button>

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
    background: transparent;
    overflow: hidden;
  }
  .paw {
    width: 48px;
    height: 48px;
    margin: 4px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.12);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
    color: rgba(255, 255, 255, 0.92);
    display: grid;
    place-items: center;
    cursor: pointer;
    padding: 0;
  }
  .paw:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
