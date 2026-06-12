// §5 /athena:loop terminal replay — typewriter over 19 seconds

let timers = [];
let tickInterval = null;
let paused = false;
let startTime = 0;

export function initLoopDemo(slideEl) {
  timers.forEach(clearTimeout);
  timers = [];
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  paused = false;
  startTime = performance.now();

  const lines = slideEl.querySelectorAll('.terminal .line');
  const progressFill = slideEl.querySelector('#loop-progress .fill');
  const progressPct = slideEl.querySelector('#loop-progress .pct');
  const TOTAL_MS = 18800;

  lines.forEach(l => l.classList.remove('shown'));

  lines.forEach(line => {
    const ms = parseInt(line.getAttribute('data-ms') || '0', 10);
    const t = setTimeout(() => line.classList.add('shown'), ms);
    timers.push(t);
  });

  tickInterval = setInterval(() => {
    if (paused) return;
    const elapsed = performance.now() - startTime;
    const pct = Math.min(100, Math.round((elapsed / TOTAL_MS) * 100));
    const filled = Math.round(pct / 10);
    if (progressFill) progressFill.textContent = '█'.repeat(filled) + '░'.repeat(10 - filled);
    if (progressPct) progressPct.textContent = pct + '%';
    if (elapsed >= TOTAL_MS) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  }, 100);

  const toggleHandler = () => { paused = !paused; };
  window.removeEventListener('demo:toggle', toggleHandler);
  window.addEventListener('demo:toggle', toggleHandler);

  const replayHandler = () => initLoopDemo(slideEl);
  window.removeEventListener('demo:replay', replayHandler);
  window.addEventListener('demo:replay', replayHandler, { once: true });
}
