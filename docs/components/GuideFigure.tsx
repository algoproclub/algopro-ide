type GuideFigureProps = {
  src: string;
  caption: string;
};

export function GuideFigure({ src, caption }: GuideFigureProps): JSX.Element {
  return (
    <figure className="guide-figure not-prose mb-8 mt-6 break-inside-avoid">
      <img
        className="block h-auto w-full rounded-lg border border-line shadow-sm"
        src={src}
        alt={caption}
        loading="lazy"
      />
      <figcaption className="mx-auto mt-2 max-w-4xl text-center text-sm leading-5 text-content-muted">
        {caption}
      </figcaption>
    </figure>
  );
}
