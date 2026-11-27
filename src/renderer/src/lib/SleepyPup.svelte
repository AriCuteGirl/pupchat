<script lang="ts">
  // Purely decorative; no props.
</script>

<!-- Line-art sleeping pup for loading states. -->
<svg viewBox="0 0 120 90" width="120" height="90" aria-hidden="true" class="pup">
  <g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M30 62c0-17 13-30 30-30s30 13 30 30c0 9-8 14-30 14s-30-5-30-14z" />
    <path d="M36 42c-8 2-14 12-12 22 4-2 9-7 12-13" />
    <path d="M84 42c8 2 14 12 12 22-4-2-9-7-12-13" />
    <path d="M47 56q4 3 8 0" />
    <path d="M65 56q4 3 8 0" />
    <path d="M57 64q3 2 6 0" />
  </g>
  <g fill="currentColor" class="z">
    <text x="94" y="30" font-size="12" font-family="Inter Variable, sans-serif">z</text>
    <text x="102" y="20" font-size="9" font-family="Inter Variable, sans-serif">z</text>
  </g>
</svg>

<style>
  .pup {
    color: var(--c-text-3);
  }
  .z {
    animation: drift 2.4s ease-in-out infinite;
  }
  @keyframes drift {
    50% {
      transform: translateY(-3px);
      opacity: 0.6;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .z {
      animation: none;
    }
  }
</style>
