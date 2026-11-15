import type { ComponentPropsWithoutRef } from 'react';
import type { ItemImage as ImageData } from '@/lib/types';
import { IMAGE_SIZES, variantSrcSet } from '@/lib/images';

type Props = Pick<ComponentPropsWithoutRef<'img'>, 'onError'> & {
  image: ImageData;
  alt: string;
  className?: string;
  sizes?: string;
  eager?: boolean;
};

export function ItemImage({
  image,
  alt,
  className,
  sizes = IMAGE_SIZES,
  eager = false,
  onError,
}: Props) {
  const widths = image.widths?.length ? image.widths : null;
  return (
    <picture className={`item-image${className ? ` ${className}` : ''}`}>
      {widths && (
        <source type="image/avif" srcSet={variantSrcSet(image.src, widths, 'avif')} sizes={sizes} />
      )}
      {widths && (
        <source type="image/webp" srcSet={variantSrcSet(image.src, widths, 'webp')} sizes={sizes} />
      )}
      <img
        src={image.src}
        alt={alt}
        width={image.width}
        height={image.height}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onError={onError}
      />
    </picture>
  );
}
