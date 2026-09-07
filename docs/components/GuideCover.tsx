export function GuideCover() {
  return (
    <header className="guide-cover not-prose flex min-h-[min(38rem,calc(100vh-8rem))] flex-col items-center justify-center rounded-lg border border-line border-b-[5px] border-b-accent bg-panel text-center shadow-sm">
      <div
        className="guide-cover__logos mb-10 flex items-center gap-7"
        aria-label="Algo Pro és MATFIN"
      >
        <img
          className="m-0 h-[4.3rem] w-auto max-w-44 object-contain"
          src="/logo.png"
          alt="Algo Pro"
        />
        <span className="h-12 w-px bg-line-strong" aria-hidden="true" />
        <img
          className="m-0 h-[4.3rem] w-auto max-w-44 object-contain"
          src="/logo-matfin.png"
          alt="MATFIN"
        />
      </div>
      <p className="guide-cover__eyebrow m-0 text-sm font-bold uppercase tracking-[0.14em] text-accent-hover">
        Algo Pro × MATFIN
      </p>
      <p className="guide-cover__title my-1 text-[clamp(2.5rem,6vw,4rem)] font-extrabold leading-none tracking-[-0.05em] text-content">
        Online IDE
      </p>
      <p className="guide-cover__subtitle m-0 text-xl font-bold text-content">
        felhasználói útmutató
      </p>
      <p className="guide-cover__audience mb-0 mt-9 text-content-muted">
        Tanulóknak és tanároknak
      </p>
    </header>
  );
}
