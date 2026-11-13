// split-flap.js — SplitFlapText (React Bits) portado a isla React (sin build).
// Expone window.TASplitFlap.mount(el, props).
import React, { useEffect, useMemo, useRef, useState } from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';

const h = React.createElement;
const DEFAULT_WORDS = ['LAUNCH READY', 'SYNC ONLINE', 'SIGNAL LIVE'];
const CHARSETS = { alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', numeric: '0123456789' };
const toCssUnit = (v) => (typeof v === 'number' ? v + 'px' : v);
const resolveCharset = (cs) => CHARSETS[cs] || (typeof cs === 'string' && cs.length ? cs : CHARSETS.alphanumeric);
const normalizePhrase = (p, w) => String(p ?? '').padEnd(w, ' ').slice(0, w);
const createTiles = (p) => p.split('').map((c) => ({ current: c, next: c, flipping: false, tick: 0 }));
const sampleChar = (cs) => cs.charAt(Math.floor(Math.random() * cs.length)) || ' ';
const buildSequence = (t, flips, cs) => { const s = []; for (let i = 0; i < flips; i++) s.push(sampleChar(cs)); s.push(t); return s; };

function usePrefersReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(mq.matches); on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

function SplitFlapText(props) {
  const {
    words = DEFAULT_WORDS, text, flipDuration = 0.12, stagger = 0.06, cycleDelay = 2400,
    charset = 'alphanumeric', flipsPerChar = 8, tileColor = '#1a1a19', textColor = '#f2f0eb',
    tileRadius = 8, gap = 6, fontSize = 52, loop = true, padTo = 12, className = '', style = {}
  } = props;
  const prefersReduced = usePrefersReducedMotion();
  const rafRef = useRef(null), cycleTimerRef = useRef(null), currentTextRef = useRef('');
  const src = Array.isArray(words) && words.length ? words : DEFAULT_WORDS;
  const key = typeof text === 'string' ? text : src.map((w) => String(w ?? '')).join('');
  const phrases = useMemo(() => key.split(''), [key]);
  const width = useMemo(() => Math.max(1, Math.ceil(Number(padTo) || 0), phrases.reduce((m, p) => Math.max(m, p.length), 1)), [padTo, phrases]);
  const normalized = useMemo(() => phrases.map((p) => normalizePhrase(p, width)), [phrases, width]);
  const [tiles, setTiles] = useState(() => createTiles(normalized[0] || ''));

  useEffect(() => {
    const clear = () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current); rafRef.current = null; cycleTimerRef.current = null; };
    clear();
    const first = normalized[0] || ''; currentTextRef.current = first; setTiles(createTiles(first));
    if (normalized.length <= 1) return clear;
    let idx = 0, cancelled = false;
    const flipMs = Math.max(40, (Number(flipDuration) || 0.12) * 1000);
    const staggerMs = Math.max(0, (Number(stagger) || 0) * 1000);
    const cyc = Math.max(400, Number(cycleDelay) || 2400);
    const flips = Math.max(0, Math.floor(Number(flipsPerChar) || 0));
    const cs = resolveCharset(charset);
    const animateTo = (target) => {
      if (prefersReduced) { currentTextRef.current = target; setTiles(createTiles(target)); return 0; }
      const from = normalizePhrase(currentTextRef.current, width);
      const plans = target.split('').map((tc, i) => {
        const fc = from[i] || ' '; if (fc === tc) return null;
        return { index: i, from: fc, target: tc, sequence: buildSequence(tc, flips, cs), start: i * staggerMs, step: -1, done: false };
      }).filter(Boolean);
      if (!plans.length) { currentTextRef.current = target; setTiles(createTiles(target)); return 0; }
      const startedAt = performance.now();
      const apply = (updates) => setTiles((prev) => { const n = [...prev]; updates.forEach((u) => { const t = n[u.index]; if (!t) return; n[u.index] = { current: u.current, next: u.next, flipping: !u.done, tick: t.tick + 1 }; }); return n; });
      const tick = (now) => {
        if (cancelled) return;
        const el = now - startedAt, updates = []; let go = false;
        plans.forEach((pl) => {
          const le = el - pl.start; if (le < 0) { go = true; return; }
          const step = Math.floor(le / flipMs);
          if (step < pl.sequence.length) { go = true; if (step !== pl.step) { pl.step = step; updates.push({ index: pl.index, current: step === 0 ? pl.from : pl.sequence[step - 1], next: pl.sequence[step], done: false }); } }
          else if (!pl.done) { pl.done = true; updates.push({ index: pl.index, current: pl.target, next: pl.target, done: true }); }
        });
        if (updates.length) apply(updates);
        if (go) rafRef.current = requestAnimationFrame(tick); else { currentTextRef.current = target; rafRef.current = null; }
      };
      rafRef.current = requestAnimationFrame(tick);
      return plans.reduce((m, pl) => Math.max(m, pl.start + pl.sequence.length * flipMs), 0);
    };
    const schedule = (delay) => { cycleTimerRef.current = setTimeout(() => { if (cancelled) return; const ni = idx + 1; if (ni >= normalized.length && !loop) return; idx = ni % normalized.length; const dur = animateTo(normalized[idx]); schedule(cyc + dur); }, delay); };
    schedule(cyc);
    return () => { cancelled = true; clear(); };
  }, [normalized, width, loop, cycleDelay, flipDuration, stagger, flipsPerChar, charset, prefersReduced]);

  const settled = tiles.map((t) => t.current).join('').trimEnd();
  const cstyle = Object.assign({
    '--split-flap-tile-color': tileColor, '--split-flap-text-color': textColor,
    '--split-flap-radius': toCssUnit(tileRadius), '--split-flap-gap': toCssUnit(gap),
    '--split-flap-font-size': toCssUnit(fontSize), '--split-flap-flip-duration': Math.max(0.04, Number(flipDuration) || 0.12) + 's'
  }, style);
  const charSpan = (v) => h('span', { className: 'split-flap-text__char' }, v === ' ' ? ' ' : v);
  return h('div', { className: ('split-flap-text ' + className).trim(), style: cstyle, role: 'text', 'aria-label': settled || undefined },
    tiles.map((tile, i) => h('span', { className: 'split-flap-text__tile', 'aria-hidden': 'true', key: i + '-' + tiles.length },
      h('span', { className: 'split-flap-text__half split-flap-text__half--top' }, charSpan(tile.current)),
      h('span', { className: 'split-flap-text__half split-flap-text__half--bottom' }, charSpan(tile.flipping ? tile.next : tile.current)),
      tile.flipping ? h(React.Fragment, null,
        h('span', { className: 'split-flap-text__flap split-flap-text__flap--front', key: 'f-' + i + '-' + tile.tick }, charSpan(tile.current)),
        h('span', { className: 'split-flap-text__flap split-flap-text__flap--back', key: 'b-' + i + '-' + tile.tick }, charSpan(tile.next))
      ) : null
    ))
  );
}

const roots = new WeakMap();
window.TASplitFlap = {
  mount(el, props) {
    if (!el) return;
    let root = roots.get(el);
    if (!root) { root = createRoot(el); roots.set(el, root); }
    root.render(h(SplitFlapText, props || {}));
  }
};
window.dispatchEvent(new Event('ta-splitflap-ready'));
