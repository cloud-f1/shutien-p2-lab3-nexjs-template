// §4 Memory flow demo — SVG ball travels 3 segments

let animationFrame = null;

export function initLearningDemo(slideEl) {
  const ball = slideEl.querySelector('#memory-ball');
  const tooltip = slideEl.querySelector('#memory-tooltip');
  if (!ball || !tooltip) return;

  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  const KEYFRAMES = [
    { x0: 200, x1: 350, tooltip: 'Chronos 踩到 GUID TypeDecorator 坑', duration: 1500 },
    { x0: 350, x1: 550, tooltip: '→ /athena:promote 提升到 Tier 0', duration: 1500 },
    { x0: 550, x1: 700, tooltip: '→ EventFlow 新 session 自動繼承', duration: 1500 },
  ];

  let phase = 0;
  let phaseStart = performance.now();

  ball.classList.add('active');
  tooltip.classList.add('shown');

  function step(now) {
    const kf = KEYFRAMES[phase];
    const t = Math.min(1, (now - phaseStart) / kf.duration);
    const x = kf.x0 + (kf.x1 - kf.x0) * easeInOut(t);
    ball.setAttribute('cx', x);
    tooltip.textContent = kf.tooltip;

    if (t >= 1) {
      phase++;
      phaseStart = now;
      if (phase >= KEYFRAMES.length) {
        tooltip.textContent = '完成。按 r 重播。';
        return;
      }
    }
    animationFrame = requestAnimationFrame(step);
  }

  animationFrame = requestAnimationFrame(step);

  const replayHandler = () => initLearningDemo(slideEl);
  window.removeEventListener('demo:replay', replayHandler);
  window.addEventListener('demo:replay', replayHandler, { once: true });
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
