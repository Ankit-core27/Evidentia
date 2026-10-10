// Small generated files for the seed evidence, so previews work without the backend.

const escapePdfText = (text: string) =>
  text
    .replace(/[^\x20-\x7e]/g, (ch) => ({ '—': '-', '–': '-', '‘': "'", '’': "'", '“': '"', '”': '"' })[ch] ?? '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const wrap = (line: string, width = 88): string[] => {
  if (line.length <= width) return [line];
  const out: string[] = [];
  let current = '';
  for (const word of line.split(' ')) {
    if (current && (current + ' ' + word).length > width) {
      out.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) out.push(current);
  return out;
};

/** A minimal, valid A4 PDF with one Helvetica text block per page. */
export const makePdf = (pages: string[]): Blob => {
  const objects: string[] = [];
  const pageIds: number[] = [];
  const fontId = 3 + pages.length * 2;

  pages.forEach((pageText, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    const lines = pageText.split('\n').flatMap((line) => wrap(line));
    const textOps = lines.map((line) => `(${escapePdfText(line)}) Tj T*`).join('\n');
    const stream = `BT\n/F1 11 Tf\n14 TL\n56 780 Td\n${textOps}\nET`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R ` +
      `/Resources << /Font << /F1 ${fontId} 0 R >> >> >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Blob([pdf], { type: 'application/pdf' });
};

/** A short mono WAV: a two-tone ring followed by a quiet hum, standing in for a call recording. */
export const makeWav = (seconds = 4, sampleRate = 8000): Blob => {
  const samples = seconds * sampleRate;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, text: string) =>
    [...text].forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)));

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples * 2, true);

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const ringing = t < 1.6 && t % 0.8 < 0.4;
    const value = ringing
      ? 0.25 * (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 480 * t))
      : 0.04 * Math.sin(2 * Math.PI * 120 * t);
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, value)) * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
};

/** A schematic stand-in for a scene photograph. */
export const makeScenePhoto = (caption: string): Blob => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
  <rect width="800" height="500" fill="#1f2933"/>
  <rect x="0" y="190" width="800" height="120" fill="#3e4c59"/>
  <rect x="330" y="0" width="140" height="500" fill="#3e4c59"/>
  <g stroke="#e4e7eb" stroke-width="4" stroke-dasharray="24 18">
    <line x1="0" y1="250" x2="330" y2="250"/><line x1="470" y1="250" x2="800" y2="250"/>
    <line x1="400" y1="0" x2="400" y2="190"/><line x1="400" y1="310" x2="400" y2="500"/>
  </g>
  <g transform="translate(520 150) rotate(22)">
    <rect x="-60" y="-28" width="120" height="56" rx="12" fill="#f5f7fa"/>
    <path d="M -10 28 l 18 -16 l 16 18" fill="none" stroke="#cf1124" stroke-width="5"/>
  </g>
  <g transform="translate(385 285)">
    <rect x="-30" y="-55" width="60" height="110" rx="8" fill="#2186eb"/>
  </g>
  <path d="M 110 232 L 470 232" stroke="#9aa5b1" stroke-width="3" stroke-dasharray="4 6"/>
  <text x="24" y="40" fill="#f5f7fa" font-family="monospace" font-size="20">${caption}</text>
  <text x="24" y="470" fill="#9aa5b1" font-family="monospace" font-size="14">Mock evidence photo, generated for the demo case</text>
</svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
};

export const makeText = (text: string, type = 'text/plain'): Blob => new Blob([text], { type });

export const sha256Hex = async (blob: Blob): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};
