<script lang="ts">
  // Step 1 placeholder rail; the glass design system lands in step 3.
</script>

<nav class="rail" aria-label="Services">
  <div class="dot" title="WhatsApp">W</div>
</nav>

<style>
  :global(html, body) {
    margin: 0;
    height: 100%;
    background: #1c1c1e;
    color: #f2f2f7;
    font-family: system-ui, sans-serif;
  }
  .rail {
    width: 56px;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 12px;
    box-sizing: border-box;
  }
  .dot {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #0a84ff;
    display: grid;
    place-items: center;
    font-weight: 600;
  }
</style>
