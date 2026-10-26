<script lang="ts">
  import MapCanvas from '../lib/components/MapCanvas.svelte';
  import AssetPanel from '../lib/components/AssetPanel.svelte';
</script>

<main>
  <MapCanvas />
  <AssetPanel />
</main>

<style>
  :global(body) { margin: 0; background: #070b12; }
  main { position: fixed; inset: 0; overflow: hidden; }
</style>
