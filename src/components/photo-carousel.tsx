"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

export type PhotoCarouselItem = {
  url: string;
  alt: string;
};

type Props = {
  photos: PhotoCarouselItem[];
};

export function PhotoCarousel({ photos }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (photos.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="relative group">
        <div
          ref={emblaRef}
          className="overflow-hidden rounded-lg border border-border bg-muted"
        >
          <div className="flex">
            {photos.map((photo, i) => (
              <div
                key={i}
                className="relative flex-[0_0_100%] aspect-[16/10] min-w-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.alt}
                  className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
                  onClick={() => setLightboxIndex(i)}
                  loading={i === 0 ? "eager" : "lazy"}
                />
              </div>
            ))}
          </div>
        </div>

        {photos.length > 1 ? (
          <>
            <NavButton
              direction="prev"
              onClick={scrollPrev}
              ariaLabel="Previous photo"
            />
            <NavButton
              direction="next"
              onClick={scrollNext}
              ariaLabel="Next photo"
            />
          </>
        ) : null}
      </div>

      {photos.length > 1 ? (
        <p className="text-center text-sm text-muted-foreground mt-2">
          {selectedIndex + 1} / {photos.length}
        </p>
      ) : null}

      <Lightbox
        open={lightboxIndex !== null}
        index={lightboxIndex ?? 0}
        close={() => setLightboxIndex(null)}
        slides={photos.map((p) => ({ src: p.url, alt: p.alt }))}
        carousel={photos.length <= 1 ? { finite: true } : undefined}
        render={
          photos.length <= 1
            ? { buttonPrev: () => null, buttonNext: () => null }
            : undefined
        }
      />
    </div>
  );
}

function NavButton({
  direction,
  onClick,
  ariaLabel,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`absolute top-1/2 -translate-y-1/2 ${direction === "prev" ? "left-3" : "right-3"} bg-black/50 hover:bg-black/70 text-white w-10 h-10 rounded-full flex items-center justify-center text-xl leading-none transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100`}
    >
      {direction === "prev" ? "‹" : "›"}
    </button>
  );
}
