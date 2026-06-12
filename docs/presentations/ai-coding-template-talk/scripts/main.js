// AI Coding Template Talk — main script
import { initLearningDemo } from './demo-learning.js';
import { initLoopDemo } from './demo-loop.js';

function main() {
  // eslint-disable-next-line no-undef
  const deck = new Reveal({
    hash: true,
    slideNumber: 'c/t',
    transition: 'fade',
    backgroundTransition: 'none',
    width: 1920,
    height: 1080,
    margin: 0.08,
    // eslint-disable-next-line no-undef
    plugins: [RevealMarkdown, RevealNotes],
    keyboard: {
      82: () => window.dispatchEvent(new CustomEvent('demo:replay')),
      32: (event) => {
        const loopSlide = document.getElementById('loop-demo-slide');
        if (loopSlide && loopSlide.classList.contains('present')) {
          event.preventDefault();
          window.dispatchEvent(new CustomEvent('demo:toggle'));
        }
      },
      66: () => { // 'b' → jump to appendix (last top-level section)
        const appendix = document.getElementById('appendix');
        if (appendix) {
          const indices = deck.getIndices(appendix);
          deck.slide(indices.h, indices.v || 0);
        }
      },
    },
  });

  deck.initialize().then(() => {
    deck.on('slidechanged', (ev) => {
      const slide = ev.currentSlide;
      if (slide.id === 'memory-demo-slide') {
        initLearningDemo(slide);
      }
      if (slide.id === 'loop-demo-slide') {
        initLoopDemo(slide);
      }
    });
  });
}

main();
