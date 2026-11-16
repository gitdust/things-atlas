import { useCallback, useRef, useState } from 'react';
import type { ItemImage as ImageData } from '@/lib/types';
import { IMAGE_SIZES, variantSrcSet } from '@/lib/images';
import { t, type Lang } from '@/lib/i18n';

type Props = {
  onFailure?: () => void;
  image: ImageData;
  alt: string;
  lang: Lang;
  className?: string;
  sizes?: string;
  eager?: boolean;
};

type ImageState = 'pending' | 'loading' | 'loaded' | 'failed';

export function ItemImage(props: Props) {
  // A fresh image node prevents the previous entry's pixels and late load events
  // from carrying over when entries change before the request finishes.
  return <ImageContent key={props.image.src} {...props} />;
}

function ImageContent({
  image,
  alt,
  lang,
  className,
  sizes = IMAGE_SIZES,
  eager = false,
  onFailure,
}: Props) {
  const [state, setState] = useState<ImageState>('pending');
  const imageRef = useRef<HTMLImageElement | null>(null);
  const failureReported = useRef(false);
  const fail = useCallback(() => {
    if (failureReported.current) return;
    failureReported.current = true;
    setState('failed');
    onFailure?.();
  }, [onFailure]);
  const widths = image.widths?.length ? image.widths : null;
  const reveal = useCallback(async (element: HTMLImageElement) => {
    try {
      await element.decode();
    } catch {
      // A decoded image may still be usable when decode() is interrupted.
      if (!element.naturalWidth) return;
    }
    if (imageRef.current === element) setState('loaded');
  }, []);
  const attachImage = useCallback(
    (element: HTMLImageElement | null) => {
      imageRef.current = element;
      if (!element) return;
      if (element.complete && element.naturalWidth) void reveal(element);
      else if (element.complete) fail();
      else setState('loading');
    },
    [reveal, fail],
  );
  const message = state === 'failed' ? t(lang, 'imageFailed') : t(lang, 'imageLoading');

  return (
    <span
      className={`item-image${className ? ` ${className}` : ''}`}
      data-state={state}
      aria-busy={state === 'loading'}
    >
      <picture>
        {widths && (
          <source
            type="image/avif"
            srcSet={variantSrcSet(image.src, widths, 'avif')}
            sizes={sizes}
          />
        )}
        {widths && (
          <source
            type="image/webp"
            srcSet={variantSrcSet(image.src, widths, 'webp')}
            sizes={sizes}
          />
        )}
        <img
          ref={attachImage}
          src={image.src}
          alt={alt}
          width={image.width}
          height={image.height}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={(event) => void reveal(event.currentTarget)}
          onError={(event) => {
            if (imageRef.current === event.currentTarget) fail();
          }}
        />
      </picture>
      {(state === 'loading' || state === 'failed') && (
        <span className="item-image-status" role="status" aria-label={message}>
          {state === 'loading' && <span className="map-spinner" aria-hidden="true" />}
          <span className="item-image-message">{message}</span>
        </span>
      )}
    </span>
  );
}
