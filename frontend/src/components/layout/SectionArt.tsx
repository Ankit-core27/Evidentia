import React from 'react';
import { useLocation } from 'react-router-dom';

const rect = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}z`;
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const arc = (cx: number, cy: number, r: number, from: number, to: number) => {
  const p = (a: number) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * 1.25 * Math.sin(a)).toFixed(1)}`;
  return `M${p(from)}A${r} ${r * 1.25} 0 ${to - from > Math.PI ? 1 : 0} 1 ${p(to)}`;
};
const print = (cx: number, cy: number, n: number) =>
  Array.from({ length: n }, (_, i) => arc(cx, cy, 6 + i * 6, Math.PI * (0.75 + (i % 3) * 0.08), Math.PI * (2.2 - (i % 2) * 0.1)));

// Faint line drawings in a 360×220 box, one per agency section. Each string is one stroke.
const ART: Record<string, string[]> = {
  // Dashboard: an incident radar over map contours.
  dashboard: [
    circle(250, 110, 30), circle(250, 110, 60), circle(250, 110, 90),
    'M150 110H350M250 15V205',
    'M10 160c40-22 75-12 105 8s65 18 95-2', 'M20 190c45-18 80-8 110 10s60 14 90-6',
    circle(215, 78, 4), circle(215, 78, 10), circle(292, 142, 4), circle(292, 142, 10), circle(268, 58, 4),
  ],
  // Cases: a case board, cards pinned and linked with string.
  cases: [
    rect(40, 40, 72, 50), rect(150, 18, 72, 50), rect(262, 48, 72, 50), rect(118, 130, 72, 50), rect(240, 150, 72, 50),
    'M52 62h40M52 74h28M162 40h44M162 52h30M274 70h36M274 82h24M130 152h42M130 164h26M252 172h40M252 184h30',
    'M76 40L186 18L298 48M76 40L154 130L276 150M186 18L154 130',
    circle(76, 40, 3.5), circle(186, 18, 3.5), circle(298, 48, 3.5), circle(154, 130, 3.5), circle(276, 150, 3.5),
  ],
  // Evidence: a sealed evidence bag holding a print, and a magnifier.
  evidence: [
    rect(60, 28, 150, 176), 'M60 56H210', 'M60 46l8-6 8 6 8-6 8 6 8-6 8 6 8-6 8 6 8-6 8 6 8-6 8 6 8-6 8 6 8-6 8 6 8-6 6 4',
    rect(80, 146, 110, 42), 'M90 160h60M90 172h86',
    ...print(135, 98, 5),
    circle(272, 112, 44), 'M304 144l34 36', ...print(272, 112, 4),
  ],
  // Reports: a signed report with a chart and a verification seal.
  reports: [
    'M90 14h128l32 32v170H90z', 'M218 14v32h32',
    'M110 44h88M110 58h118M110 72h104',
    rect(112, 120, 14, 30), rect(132, 100, 14, 50), rect(152, 112, 14, 38), rect(172, 90, 14, 60), 'M104 150h130',
    'M110 190c10-12 18 8 26-4s14 6 22-2',
    circle(214, 186, 20), 'M205 186l7 7 13-14',
  ],
};

const SECTION_BY_PATH: Record<string, string> = { '/': 'dashboard', '/cases': 'cases', '/evidence': 'evidence', '/reports': 'reports' };

/** Faint thematic drawing behind an agency page's header. It redraws on every visit, including a click on the active tab. */
export const SectionArt: React.FC = () => {
  const location = useLocation();
  const strokes = ART[SECTION_BY_PATH[location.pathname] ?? ''];
  if (!strokes) return null;

  return (
    <svg
      key={location.key}
      viewBox="0 0 360 220"
      aria-hidden
      className="section-art pointer-events-none absolute -z-[5] top-2 right-4 lg:right-10 w-[360px] h-[220px] hidden md:block"
    >
      <g fill="none" stroke="var(--color-accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.32">
        {strokes.map((d, i) => (
          <path key={i} d={d} pathLength={1} style={{ '--i': i } as React.CSSProperties} />
        ))}
      </g>
    </svg>
  );
};
