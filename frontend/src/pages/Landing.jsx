import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Camera, Bell, Users, ShieldCheck, MessageCircle, BrainCircuit,
  Zap, MapPin, Plug,
} from 'lucide-react';
import { getBranding } from '@/lib/settings';
import { cn } from '@/lib/cn';

const features = [
  { icon: Users,       title: 'Crowd density',     body: 'Know the moment your entrance gets too tight.' },
  { icon: ShieldCheck, title: 'Restricted zones',  body: "Get pinged when someone steps where they shouldn't." },
  { icon: Bell,        title: 'After-hours alerts',body: "Sleep easy — we watch the camera so you don't." },
  { icon: Camera,      title: 'Works with your CCTV', body: 'Plug into your existing cameras. No rip-and-replace.' },
];

function PulseDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500 ring-1 ring-white/20" />
    </span>
  );
}

/* ── Animated pipeline diagram ─────────────────────────────────────────── */

function FlowingLine() {
  return (
    <div className="flex items-center gap-1.5 px-1 sm:gap-2 sm:px-3">
      {[0, 1, 2, 3].map((d) => (
        <motion.span
          key={d}
          className="block h-1.5 w-1.5 rounded-full bg-burgundy-500"
          animate={{ opacity: [0.15, 1, 0.15], scale: [0.7, 1.25, 0.7] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: d * 0.25, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

function Stage({ icon: Icon, label, sub, accent, ringColor, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
      className="flex max-w-[180px] flex-col items-center text-center"
    >
      <div className={cn(
        'relative flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg sm:h-28 sm:w-28',
        'bg-gradient-to-br',
        accent,
      )}>
        <Icon size={40} strokeWidth={1.6} />
        {/* Continuous outer pulse ring */}
        <motion.span
          className={cn('absolute inset-0 rounded-full border-2', ringColor)}
          animate={{ scale: [1, 1.35, 1.35], opacity: [0.6, 0, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, delay, ease: 'easeOut' }}
        />
        <motion.span
          className={cn('absolute inset-0 rounded-full border-2', ringColor)}
          animate={{ scale: [1, 1.5, 1.5], opacity: [0.35, 0, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, delay: delay + 0.6, ease: 'easeOut' }}
        />
      </div>
      <div className="mt-5 text-base font-semibold text-ink-900">{label}</div>
      <div className="mt-1 text-sm text-ink-500">{sub}</div>
    </motion.div>
  );
}

function PipelineDiagram() {
  const stages = [
    { icon: Camera,        label: 'Watches your cameras', sub: 'RTSP · IP · phone',         accent: 'from-burgundy-500 to-burgundy-700', ringColor: 'border-burgundy-400', delay: 0 },
    { icon: BrainCircuit,  label: 'AI spots what matters', sub: 'YOLO · zones · rules',      accent: 'from-burgundy-600 to-burgundy-800', ringColor: 'border-burgundy-400', delay: 0.25 },
    { icon: MessageCircle, label: 'Alerts the right person', sub: 'WhatsApp · dashboard',    accent: 'from-gold-500 to-gold-700',         ringColor: 'border-gold-400',     delay: 0.5 },
  ];

  return (
    <div className="mt-12 flex flex-wrap items-center justify-center gap-y-10">
      {stages.flatMap((s, i) => {
        const out = [<Stage key={`s${i}`} {...s} />];
        if (i < stages.length - 1) out.push(<FlowingLine key={`f${i}`} />);
        return out;
      })}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function Landing() {
  const brand = getBranding();

  return (
    <div className="min-h-full bg-white text-ink-900">
      {/* Fixed nav — top right, always visible */}
      <nav className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full
                      bg-ink-900/85 p-1 pl-3 shadow-lg ring-1 ring-white/15 backdrop-blur-md">
        <a
          href="/live"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-2 py-1.5 text-xs font-bold uppercase
                     tracking-widest text-white/85 transition hover:text-white sm:text-sm"
        >
          <PulseDot />
          Live
        </a>
        <Link
          to="/login"
          className="inline-flex items-center rounded-full bg-burgundy-600 px-4 py-2
                     text-xs font-bold uppercase tracking-widest text-white shadow
                     transition hover:bg-burgundy-500 sm:text-sm"
        >
          Login
        </Link>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="bg-carbon-hero relative overflow-hidden pb-40 text-white">
        <div className="container-page relative pt-12 sm:pt-16">
          <div className="text-lg font-bold tracking-tight">
            <span className="text-white">Smart</span>
            <span className="text-burgundy-300">Snap</span>
          </div>

          <div className="mt-14 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest text-ink-200">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
              AI CCTV Alerting
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">
              Turn your existing CCTV<br />
              into a <span className="text-gold-400">smart alerting platform</span>.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-ink-200">
              {brand.name} watches the camera feeds you already have, learns the rules that matter to your
              site, and pings the right person the moment something goes wrong.
            </p>
          </div>
        </div>
        {/* Soft fade-out into the next (white) section */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent via-white/30 to-white" />
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section className="container-page py-20">
        <h2 className="text-3xl font-bold tracking-tight">What it watches for</h2>
        <p className="mt-2 max-w-2xl text-ink-600">
          Rules that work reliably with off-the-shelf computer vision — no false-positive theatre.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="card p-6">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-burgundy-50 text-burgundy-600">
                <f.icon size={20} />
              </div>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-ink-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works — animated pipeline ──────────────────────────── */}
      <section className="bg-gradient-to-b from-white via-ink-50 to-white py-24">
        <div className="container-page text-center">
          <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
          <p className="mx-auto mt-2 max-w-xl text-ink-600">
            From your camera to your phone — three steps, milliseconds apart.
          </p>
          <PipelineDiagram />
        </div>
      </section>

      {/* ── Highlights strip (fades from white into the dark hero gradient) */}
      <section id="contact" className="bg-carbon-hero relative pb-12 pt-28 text-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white via-white/30 to-transparent" />
        <div className="container-page relative">
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {[
              { icon: Plug,          title: 'Works with your CCTV',  body: 'RTSP · IP · MJPEG · phone' },
              { icon: Zap,           title: 'Sub-second alerts',     body: 'Detected → pinged in <1 s' },
              { icon: MessageCircle, title: 'WhatsApp + dashboard',  body: 'Snapshot attached to every alert' },
              { icon: MapPin,        title: 'Built in Harare',       body: 'Same tech anywhere on the continent' },
            ].map((h) => (
              <div key={h.title}>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-gold-400 ring-1 ring-white/10">
                  <h.icon size={18} />
                </div>
                <div className="mt-3 text-sm font-semibold text-white">{h.title}</div>
                <div className="mt-0.5 text-xs text-ink-300">{h.body}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-start gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-300">
              Run a trial on your own cameras — no commitment, no hardware swap.
            </p>
            <a
              href="https://wa.me/263774603865?text=Hi%20Noby%2C%20I%20saw%20SmartSnap%20%E2%80%94%20can%20we%20chat%3F"
              className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-5 py-2.5 text-sm font-semibold text-ink-950 hover:bg-gold-400"
            >
              <MessageCircle size={16} /> WhatsApp us
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="bg-ink-950 py-8 text-ink-400">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 text-sm">
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
