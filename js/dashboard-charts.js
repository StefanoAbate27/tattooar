// dashboard-charts.js — Gráficas y "targets" del panel admin con React + GSAP.
// Se monta como isla. admin.js calcula los datos y llama window.TADash.render(data).
import React, { useEffect, useRef } from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';

const h = React.createElement;
const gsap = window.gsap;
const REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Tarjeta KPI con contador animado (GSAP) ---------- */
function StatCard({ label, value, prefix, suffix, foot, accent, icon, delay }) {
  const numRef = useRef(null);
  const cardRef = useRef(null);
  useEffect(() => {
    const el = numRef.current;
    const fmt = (n) => (prefix || '') + Math.round(n).toLocaleString('es') + (suffix || '');
    if (REDUCE || !gsap) { if (el) el.textContent = fmt(value); return; }
    const obj = { v: 0 };
    const tw = gsap.to(obj, { v: value, duration: 1.1, delay: delay || 0, ease: 'power2.out', onUpdate: () => { if (el) el.textContent = fmt(obj.v); } });
    return () => tw.kill();
  }, [value]);
  const onMove = (e) => {
    if (REDUCE || !gsap || !cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    gsap.to(cardRef.current, { rotateX: ((e.clientY - r.top) / r.height - 0.5) * -5, rotateY: ((e.clientX - r.left) / r.width - 0.5) * 5, duration: 0.4, ease: 'power2.out', transformPerspective: 800 });
  };
  const onLeave = () => { if (gsap && cardRef.current) gsap.to(cardRef.current, { rotateX: 0, rotateY: 0, duration: 0.5, ease: 'power3.out' }); };
  return h('div', { className: 'stat-card' + (accent ? ' accent' : ''), ref: cardRef, onMouseMove: onMove, onMouseLeave: onLeave },
    icon ? h('span', { className: 'stat-ico' }, icon) : null,
    h('span', { className: 'stat-num', ref: numRef }, '0'),
    h('span', { className: 'stat-label' }, label),
    foot ? h('span', { className: 'stat-foot' }, foot) : null
  );
}

/* ---------- Gráfica de área animada ---------- */
function AreaChart({ points }) {
  const ref = useRef(null);
  const W = 520, H = 190, P = 26;
  const max = Math.max(1, ...points.map((p) => p.value));
  const stepX = (W - P * 2) / Math.max(1, points.length - 1);
  const xy = points.map((p, i) => [P + i * stepX, H - P - (p.value / max) * (H - P * 2)]);
  const line = xy.map((c, i) => (i ? 'L' : 'M') + c[0].toFixed(1) + ' ' + c[1].toFixed(1)).join(' ');
  const area = line + ` L ${xy[xy.length - 1][0].toFixed(1)} ${H - P} L ${xy[0][0].toFixed(1)} ${H - P} Z`;
  useEffect(() => {
    if (!ref.current) return;
    const path = ref.current.querySelector('.area-line');
    const fill = ref.current.querySelector('.area-fill');
    const dots = ref.current.querySelectorAll('.area-dot');
    if (REDUCE || !gsap) { if (fill) fill.style.opacity = 1; return; }
    const len = path.getTotalLength();
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
    gsap.set(fill, { opacity: 0 });
    gsap.set(dots, { scale: 0, transformOrigin: 'center' });
    const tl = gsap.timeline();
    tl.to(path, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut' })
      .to(fill, { opacity: 1, duration: 0.8, ease: 'power2.out' }, '-=0.9')
      .to(dots, { scale: 1, duration: 0.4, stagger: 0.06, ease: 'back.out(2)' }, '-=0.55');
    return () => tl.kill();
  }, [points.map((p) => p.value).join(',')]);
  return h('div', { className: 'chart-svg', ref },
    h('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', style: { width: '100%', height: 'auto', display: 'block' } },
      h('defs', null, h('linearGradient', { id: 'areaGrad', x1: 0, y1: 0, x2: 0, y2: 1 },
        h('stop', { offset: '0%', style: { stopColor: 'var(--green)', stopOpacity: 0.4 } }),
        h('stop', { offset: '100%', style: { stopColor: 'var(--green)', stopOpacity: 0 } }))),
      h('path', { className: 'area-fill', d: area, fill: 'url(#areaGrad)' }),
      h('path', { className: 'area-line', d: line, fill: 'none', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', style: { stroke: 'var(--green)' } }),
      xy.map((c, i) => h('circle', { key: i, className: 'area-dot', cx: c[0], cy: c[1], r: 4, strokeWidth: 2, style: { fill: 'var(--bg2)', stroke: 'var(--green)' } }))
    ),
    h('div', { className: 'chart-xlabels' }, points.map((p, i) => h('span', { key: i }, p.label)))
  );
}

/* ---------- Donut animado ---------- */
function Donut({ segments, centerTop, centerSub }) {
  const ref = useRef(null);
  const R = 62, C = 2 * Math.PI * R, total = Math.max(1, segments.reduce((a, s) => a + s.value, 0));
  let acc = 0;
  const arcs = segments.map((s) => { const frac = s.value / total; const seg = { ...s, len: frac * C, off: acc * C }; acc += frac; return seg; });
  useEffect(() => {
    if (!ref.current || REDUCE || !gsap) return;
    ref.current.querySelectorAll('.donut-arc').forEach((c) => {
      gsap.fromTo(c, { strokeDasharray: `0 ${C}` }, { strokeDasharray: `${parseFloat(c.dataset.len)} ${C}`, duration: 1, ease: 'power2.out', delay: 0.15 });
    });
    const cen = ref.current.querySelector('.donut-center');
    if (cen) gsap.from(cen, { opacity: 0, scale: 0.8, duration: 0.6, delay: 0.5, ease: 'back.out(1.8)' });
  }, [segments.map((s) => s.value).join(',')]);
  return h('div', { className: 'donut', ref },
    h('svg', { viewBox: '0 0 160 160' },
      h('circle', { cx: 80, cy: 80, r: R, fill: 'none', strokeWidth: 15, style: { stroke: 'var(--line)', opacity: 0.55 } }),
      arcs.map((s, i) => h('circle', { key: i, className: 'donut-arc', cx: 80, cy: 80, r: R, fill: 'none', strokeWidth: 15, 'data-len': s.len, strokeDasharray: `${s.len} ${C}`, strokeDashoffset: -s.off, transform: 'rotate(-90 80 80)', style: { stroke: s.color } }))
    ),
    (centerTop != null) ? h('div', { className: 'donut-center' }, h('b', null, centerTop), h('span', null, centerSub)) : null
  );
}

function Legend({ segments }) {
  return h('div', { className: 'donut-legend' }, segments.map((s, i) =>
    h('div', { key: i, className: 'legend-row' },
      h('span', { className: 'legend-dot', style: { background: s.color } }),
      h('span', { className: 'legend-name' }, s.label),
      h('b', null, s.valueLabel))));
}

/* ---------- Composición Resumen ---------- */
function Overview({ data }) {
  return h(React.Fragment, null,
    h('div', { className: 'stat-grid' }, data.kpis.map((k, i) => h(StatCard, Object.assign({ key: i, delay: i * 0.08 }, k)))),
    h('div', { className: 'grid-2' },
      h('div', { className: 'panel-card' },
        h('div', { className: 'card-head' }, h('h2', null, 'Diseños publicados'), h('span', { className: 'hint' }, 'últimos 6 meses')),
        h(AreaChart, { points: data.trend })),
      h('div', { className: 'panel-card' },
        h('div', { className: 'card-head' }, h('h2', null, 'Ingresos por plan'), h('span', { className: 'hint' }, 'MRR')),
        h('div', { className: 'donut-row' },
          h(Donut, { segments: data.revenue.segments, centerTop: data.revenue.mrrLabel, centerSub: '/ mes' }),
          h(Legend, { segments: data.revenue.segments }))))
  );
}

/* ---------- API pública ---------- */
let ovRoot = null, revRoot = null, legRoot = null;
function render(data) {
  const ov = document.getElementById('ov-react');
  if (ov) { ovRoot = ovRoot || createRoot(ov); ovRoot.render(h(Overview, { data })); }
  const rev = document.getElementById('rev-react');
  if (rev && data.revenue) { revRoot = revRoot || createRoot(rev); revRoot.render(h(Donut, { segments: data.revenue.segments, centerTop: data.revenue.mrrLabel, centerSub: 'MRR' })); }
  const leg = document.getElementById('rev-legend');
  if (leg && data.revenue) { legRoot = legRoot || createRoot(leg); legRoot.render(h(Legend, { segments: data.revenue.segments })); }
}
window.TADash = { render };
if (window.__dashPending) render(window.__dashPending);
