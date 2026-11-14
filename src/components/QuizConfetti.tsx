import { useEffect } from 'react';
import { categoryColor } from '@/lib/tokens';

/** A decorative top-layer canvas keeps confetti above the native modal. */
export function QuizConfetti() {
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'quiz-confetti';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('popover', 'manual');
    document.body.append(canvas);
    canvas.showPopover?.();
    const context = canvas.getContext('2d');
    if (!context) {
      canvas.remove();
      return;
    }

    const colors = Object.values(categoryColor);
    const ribbons = Array.from({ length: 140 }, () => ({
      x: Math.random(),
      y: -0.3 - Math.random() * 0.65,
      drift: (Math.random() - 0.5) * 180,
      speed: 180 + Math.random() * 160,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 10,
      width: 5 + Math.random() * 5,
      length: 12 + Math.random() * 14,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    let width = window.innerWidth;
    let height = window.innerHeight;
    let frame = 0;
    const started = performance.now();

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    function cleanup() {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      preference.removeEventListener('change', cleanup);
      canvas.remove();
    }
    function draw(now: number) {
      if (!context) return;
      const elapsed = (now - started) / 1000;
      if (elapsed >= 3.2) {
        cleanup();
        return;
      }
      context.clearRect(0, 0, width, height);
      context.globalAlpha = Math.min(1, (3.2 - elapsed) / 0.6);
      for (const ribbon of ribbons) {
        const x =
          ribbon.x * width + ribbon.drift * elapsed + Math.sin(elapsed * 4 + ribbon.angle) * 18;
        const y = ribbon.y * height + ribbon.speed * elapsed + 70 * elapsed * elapsed;
        context.save();
        context.translate(x, y);
        context.rotate(ribbon.angle + ribbon.spin * elapsed);
        context.scale(Math.cos(elapsed * 7 + ribbon.angle) * 0.7 + 0.3, 1);
        context.fillStyle = ribbon.color;
        context.fillRect(-ribbon.width / 2, -ribbon.length / 2, ribbon.width, ribbon.length);
        context.restore();
      }
      frame = requestAnimationFrame(draw);
    }
    resize();
    window.addEventListener('resize', resize);
    preference.addEventListener('change', cleanup);
    frame = requestAnimationFrame(draw);
    return cleanup;
  }, []);
  return null;
}
