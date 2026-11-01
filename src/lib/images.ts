import { mq } from './tokens';

/** Rendered width of the drawer photo: full-bleed sheet on mobile, ~400px in the side drawer. */
export const IMAGE_SIZES = `${mq.mobile} 100vw, 400px`;

/** srcset for the variants written by scripts/build-images.ts (public/images/opt/<name>-<w>.<ext>). */
export function variantSrcSet(src: string, widths: readonly number[], ext: 'avif' | 'webp') {
  const base = src.replace(/^\/images\//, '/images/opt/').replace(/\.[^.]+$/, '');
  return widths.map((w) => `${base}-${w}.${ext} ${w}w`).join(', ');
}
