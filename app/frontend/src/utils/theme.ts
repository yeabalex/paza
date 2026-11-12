export interface PosterTheme {
  id: string;
  name: string;
  gradient: string;
  accent: string;
  accentSoft: string;
  border: string;
  watermarkColor: string;
}

export const POSTER_THEMES: PosterTheme[] = [
  {
    id: 'sage-forest',
    name: 'Sage Forest',
    gradient: 'radial-gradient(135% 125% at 85% 12%, #2d5538 0%, #152d1d 50%, #09130c 100%)',
    accent: '#a7f3d0',
    accentSoft: 'rgba(167, 243, 208, 0.14)',
    border: 'rgba(167, 243, 208, 0.22)',
    watermarkColor: 'rgba(167, 243, 208, 0.08)',
  },
  {
    id: 'smoked-amber',
    name: 'Smoked Amber',
    gradient: 'radial-gradient(135% 125% at 85% 12%, #854d0e 0%, #451a03 52%, #140702 100%)',
    accent: '#fde047',
    accentSoft: 'rgba(253, 224, 71, 0.14)',
    border: 'rgba(253, 224, 71, 0.22)',
    watermarkColor: 'rgba(253, 224, 71, 0.08)',
  },
  {
    id: 'midnight-indigo',
    name: 'Midnight Indigo',
    gradient: 'radial-gradient(135% 125% at 85% 12%, #4338ca 0%, #1e1b4b 52%, #0a071f 100%)',
    accent: '#a5b4fc',
    accentSoft: 'rgba(165, 180, 252, 0.14)',
    border: 'rgba(165, 180, 252, 0.22)',
    watermarkColor: 'rgba(165, 180, 252, 0.08)',
  },
  {
    id: 'crimson-rose',
    name: 'Crimson Rose',
    gradient: 'radial-gradient(135% 125% at 85% 12%, #9f1239 0%, #4c0519 52%, #180208 100%)',
    accent: '#fecdd3',
    accentSoft: 'rgba(254, 205, 211, 0.14)',
    border: 'rgba(254, 205, 211, 0.22)',
    watermarkColor: 'rgba(254, 205, 211, 0.08)',
  },
  {
    id: 'cobalt-cyan',
    name: 'Cobalt Cyan',
    gradient: 'radial-gradient(135% 125% at 85% 12%, #0284c7 0%, #082f49 52%, #031420 100%)',
    accent: '#7dd3fc',
    accentSoft: 'rgba(125, 211, 252, 0.14)',
    border: 'rgba(125, 211, 252, 0.22)',
    watermarkColor: 'rgba(125, 211, 252, 0.08)',
  },
  {
    id: 'velvet-violet',
    name: 'Velvet Violet',
    gradient: 'radial-gradient(135% 125% at 85% 12%, #7e22ce 0%, #3b0764 52%, #140224 100%)',
    accent: '#e9d5ff',
    accentSoft: 'rgba(233, 213, 255, 0.14)',
    border: 'rgba(233, 213, 255, 0.22)',
    watermarkColor: 'rgba(233, 213, 255, 0.08)',
  },
  {
    id: 'terracotta-rust',
    name: 'Terracotta Rust',
    gradient: 'radial-gradient(135% 125% at 85% 12%, #c2410c 0%, #431407 52%, #180702 100%)',
    accent: '#fed7aa',
    accentSoft: 'rgba(254, 215, 170, 0.14)',
    border: 'rgba(254, 215, 170, 0.22)',
    watermarkColor: 'rgba(254, 215, 170, 0.08)',
  },
  {
    id: 'electric-teal',
    name: 'Electric Teal',
    gradient: 'radial-gradient(135% 125% at 85% 12%, #0f766e 0%, #134e4a 52%, #041b19 100%)',
    accent: '#99f6e4',
    accentSoft: 'rgba(153, 246, 228, 0.14)',
    border: 'rgba(153, 246, 228, 0.22)',
    watermarkColor: 'rgba(153, 246, 228, 0.08)',
  },
  {
    id: 'golden-ochre',
    name: 'Golden Ochre',
    gradient: 'radial-gradient(135% 125% at 85% 12%, #a16207 0%, #422006 52%, #190b02 100%)',
    accent: '#fef08a',
    accentSoft: 'rgba(254, 240, 138, 0.14)',
    border: 'rgba(254, 240, 138, 0.22)',
    watermarkColor: 'rgba(254, 240, 138, 0.08)',
  },
  {
    id: 'deep-wine',
    name: 'Deep Wine',
    gradient: 'radial-gradient(135% 125% at 85% 12%, #881337 0%, #450a0a 52%, #1a0303 100%)',
    accent: '#fca5a5',
    accentSoft: 'rgba(252, 165, 165, 0.14)',
    border: 'rgba(252, 165, 165, 0.22)',
    watermarkColor: 'rgba(252, 165, 165, 0.08)',
  },
  {
    id: 'arctic-slate',
    name: 'Arctic Slate',
    gradient: 'radial-gradient(135% 125% at 85% 12%, #475569 0%, #1e293b 52%, #0b0f17 100%)',
    accent: '#e2e8f0',
    accentSoft: 'rgba(226, 232, 240, 0.14)',
    border: 'rgba(226, 232, 240, 0.22)',
    watermarkColor: 'rgba(226, 232, 240, 0.08)',
  },
  {
    id: 'dusk-magenta',
    name: 'Dusk Magenta',
    gradient: 'radial-gradient(135% 125% at 85% 12%, #86198f 0%, #4a044e 52%, #19011b 100%)',
    accent: '#f5d0fe',
    accentSoft: 'rgba(245, 208, 254, 0.14)',
    border: 'rgba(245, 208, 254, 0.22)',
    watermarkColor: 'rgba(245, 208, 254, 0.08)',
  },
  {
    id: 'nordic-pine',
    name: 'Nordic Pine',
    gradient: 'radial-gradient(135% 125% at 85% 12%, #166534 0%, #052e16 52%, #02140a 100%)',
    accent: '#bbf7d0',
    accentSoft: 'rgba(187, 247, 208, 0.14)',
    border: 'rgba(187, 247, 208, 0.22)',
    watermarkColor: 'rgba(187, 247, 208, 0.08)',
  },
  {
    id: 'copper-bronze',
    name: 'Copper Bronze',
    gradient: 'radial-gradient(135% 125% at 85% 12%, #92400e 0%, #451a03 52%, #170901 100%)',
    accent: '#fde68a',
    accentSoft: 'rgba(253, 230, 138, 0.14)',
    border: 'rgba(253, 230, 138, 0.22)',
    watermarkColor: 'rgba(253, 230, 138, 0.08)',
  },
  {
    id: 'glacial-cyan',
    name: 'Glacial Cyan',
    gradient: 'radial-gradient(135% 125% at 85% 12%, #0e7490 0%, #083344 52%, #02151d 100%)',
    accent: '#a5f3fc',
    accentSoft: 'rgba(165, 243, 252, 0.14)',
    border: 'rgba(165, 243, 252, 0.22)',
    watermarkColor: 'rgba(165, 243, 252, 0.08)',
  },
  {
    id: 'obsidian-bone',
    name: 'Obsidian Bone',
    gradient: 'radial-gradient(135% 125% at 85% 12%, #3f3f46 0%, #18181b 52%, #09090b 100%)',
    accent: '#f4f4f5',
    accentSoft: 'rgba(244, 244, 245, 0.14)',
    border: 'rgba(244, 244, 245, 0.22)',
    watermarkColor: 'rgba(244, 244, 245, 0.08)',
  },
];

/**
 * Deterministically pick an editorial poster theme based on event id and title.
 * This guarantees varied gradients across different cards while staying consistent
 * across re-renders and page navigation.
 */
export function getEventPosterTheme(eventId?: string, title?: string): PosterTheme {
  const seed = `${eventId || ''}_${title || ''}`;
  if (!seed.trim()) {
    return POSTER_THEMES[0];
  }

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  const index = Math.abs(hash) % POSTER_THEMES.length;
  return POSTER_THEMES[index];
}

