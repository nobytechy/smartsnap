import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Home, LogIn } from 'lucide-react';
import { getApiBaseUrl, getBranding } from '@/lib/settings';
import { cn } from '@/lib/cn';

const POLL_MS = 500;

function LivePulse() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
    </span>
  );
}

export default function Live() {
  const apiBase = getApiBaseUrl().replace(/\/$/, '');
  const brand = getBranding();
  const [cameras, setCameras] = useState([]);
  const [idx, setIdx] = useState(0);
  const [connected, setConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [imgSrc, setImgSrc] = useState(null);
  const tickRef = useRef(null);

  useEffect(() => {
    if (!apiBase) {
      setErrorMsg('Backend URL not configured.');
      return;
    }
    fetch(`${apiBase}/frigate/cameras`)
      .then((r) => r.json())
      .then((d) => setCameras((d?.cameras || []).filter((c) => c.enabled)))
      .catch((err) => {
        console.error(err);
        setErrorMsg('Cannot reach the backend.');
      });
  }, [apiBase]);

  const current = cameras[idx];

  useEffect(() => {
    if (!current || !apiBase) return;
    function tick() {
      setImgSrc(`${apiBase}/frigate/snapshot/${current.slug}?t=${Date.now()}`);
    }
    tick();
    tickRef.current = setInterval(tick, POLL_MS);
    return () => clearInterval(tickRef.current);
  }, [current?.slug, apiBase]);

  function prev() { setIdx((i) => (i - 1 + cameras.length) % cameras.length); }
  function next() { setIdx((i) => (i + 1) % cameras.length); }

  return (
    <div className="bg-carbon-hero flex min-h-full flex-col text-white">
      {/* Fixed nav — mirrors landing */}
      <nav className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full
                      bg-ink-900/85 p-1 pl-3 shadow-lg ring-1 ring-white/15 backdrop-blur-md">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-bold uppercase
                     tracking-widest text-white/85 transition hover:text-white sm:text-sm"
        >
          <Home size={14} /> Home
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 rounded-full bg-burgundy-600 px-4 py-2
                     text-xs font-bold uppercase tracking-widest text-white shadow
                     transition hover:bg-burgundy-500 sm:text-sm"
        >
          <LogIn size={14} /> Login
        </Link>
      </nav>

      {/* Page header */}
      <header className="container-page relative pt-12 sm:pt-14">
        <Link to="/" className="text-lg font-bold tracking-tight">
          <span className="text-white">Smart</span>
          <span className="text-burgundy-300">Snap</span>
        </Link>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest text-ink-200">
          <LivePulse />
          Live camera feed
        </div>
      </header>

      {/* Viewer */}
      <main className="container-page flex flex-1 flex-col items-center justify-center pb-12 pt-8">
        {errorMsg && (
          <div className="rounded-xl border border-burgundy-500/40 bg-burgundy-500/10 px-6 py-4 text-center text-sm text-burgundy-200">
            {errorMsg}
          </div>
        )}

        {!errorMsg && cameras.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-8 text-center text-sm text-ink-300 backdrop-blur">
            No live cameras right now. Check back shortly.
          </div>
        )}

        {!errorMsg && current && (
          <div className="w-full max-w-5xl">
            <div className="relative overflow-hidden rounded-2xl bg-black/70 ring-1 ring-white/10 shadow-2xl">
              {imgSrc ? (
                <img
                  key={current.slug}
                  src={imgSrc}
                  alt={`Live feed: ${current.slug}`}
                  className="block w-full"
                  onLoad={() => setConnected(true)}
                  onError={() => setConnected(false)}
                />
              ) : (
                <div className="flex aspect-video items-center justify-center text-sm text-ink-500">
                  Loading feed…
                </div>
              )}

              {cameras.length > 1 && (
                <>
                  <button
                    onClick={prev}
                    aria-label="Previous camera"
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-ink-900/70 p-2 backdrop-blur transition hover:bg-burgundy-600"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={next}
                    aria-label="Next camera"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-ink-900/70 p-2 backdrop-blur transition hover:bg-burgundy-600"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}

              <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-ink-900/75 px-3 py-1 text-xs font-bold uppercase tracking-widest backdrop-blur ring-1 ring-white/10">
                <LivePulse />
                Live
              </div>

              <div className="absolute right-3 top-3 rounded-full bg-ink-900/75 px-3 py-1 text-xs text-ink-200 backdrop-blur ring-1 ring-white/10">
                {connected ? 'Online' : 'Connecting…'}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
              <div className="text-sm">
                <span className="text-ink-400">Camera:</span>{' '}
                <span className="font-semibold capitalize text-white">{current.slug.replace(/_/g, ' ')}</span>
                {cameras.length > 1 && (
                  <span className="ml-2 text-xs text-ink-400">({idx + 1} / {cameras.length})</span>
                )}
              </div>
              <div className="text-xs text-ink-400">Refreshes every {POLL_MS} ms</div>
            </div>
          </div>
        )}
      </main>

      {/* Footer — same as landing */}
      <footer className="border-t border-white/10 bg-ink-950 py-6 text-sm text-ink-400">
        <div className="container-page flex flex-wrap items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} {brand.name}</span>
          <a
            href="https://nobie.netlify.app"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-white"
          >
            Powered by Noby
          </a>
        </div>
      </footer>
    </div>
  );
}
