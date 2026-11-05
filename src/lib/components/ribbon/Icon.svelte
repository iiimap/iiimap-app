<script lang="ts">
  // ไอคอนเส้น 24×24 ใช้สีตามตัวอักษร (currentColor)
  let { name, size = 20 }: { name: string; size?: number } = $props();

  const P: Record<string, string> = {
    paste: 'M9 3h6v3H9z M7 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1',
    cut: 'M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M8.2 16.4 19 3 M15.8 16.4 5 3',
    copy: 'M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4',
    undo: 'M9 14 4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
    redo: 'M15 14l5-5-5-5 M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
    rotateCw: 'M21 12a9 9 0 1 1-2.6-6.4 M21 3v6h-6',
    rotateCcw: 'M3 12a9 9 0 1 0 2.6-6.4 M3 3v6h6',
    trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6',
    zoomIn: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M16 16l5 5 M8 11h6 M11 8v6',
    zoomOut: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M16 16l5 5 M8 11h6',
    home: 'M3 11l9-8 9 8 M5 9.5V20h14V9.5',
    grid: 'M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18',
    zone: 'M3 3h4 M10 3h4 M17 3h4v4 M21 10v4 M21 17v4h-4 M14 21h-4 M7 21H3v-4 M3 14v-4 M3 7V3',
    deselect: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M15 9l-6 6 M9 9l6 6',
    eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    edit: 'M4 20h4L19 9l-4-4L4 16v4z M13 7l4 4',
    check: 'M4 12.5l5 5L20 6.5',
    label: 'M3 7a2 2 0 0 1 2-2h9l6 7-6 7H5a2 2 0 0 1-2-2z M8 12h5',
    close: 'M6 6l12 12 M18 6L6 18'
  };
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d={P[name] ?? ''} />
</svg>
