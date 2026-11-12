// google-fonts.ts -- Fetch Google Fonts catalog with category tags.
// Caches at module level (fetch once per session). Falls back to system fonts if API fails.

import { trace } from './debug-trace';
import { CLOUD_ENABLED } from './cloud-flag';

// Both backends serve the catalog without exposing the API key.
declare const __REVYME_LOCAL_GOOGLE_FONTS__: boolean;
const CATALOG_URL = '/api/media/fonts';
const CATALOG_AVAILABLE = CLOUD_ENABLED || (typeof __REVYME_LOCAL_GOOGLE_FONTS__ !== 'undefined' && __REVYME_LOCAL_GOOGLE_FONTS__);

export interface FontItem {
  family: string;
  variants: string[];
  category: string;
  tags: { name: string; weight: number }[];
}

/** Default system fonts — fallback when API is unavailable */
export const DEFAULT_FONTS: FontItem[] = [
  { family: 'Arial', variants: ['regular', '700'], category: 'sans-serif', tags: [] },
  { family: 'Helvetica', variants: ['regular', '700'], category: 'sans-serif', tags: [] },
  { family: 'Times New Roman', variants: ['regular', '700'], category: 'serif', tags: [] },
  { family: 'Georgia', variants: ['regular', '700'], category: 'serif', tags: [] },
  { family: 'Courier New', variants: ['regular', '700'], category: 'monospace', tags: [] },
  { family: 'Verdana', variants: ['regular', '700'], category: 'sans-serif', tags: [] },
  { family: 'Tahoma', variants: ['regular', '700'], category: 'sans-serif', tags: [] },
  { family: 'Trebuchet MS', variants: ['regular', '700'], category: 'sans-serif', tags: [] },
  { family: 'Comic Sans MS', variants: ['regular', '700'], category: 'cursive', tags: [] },
  { family: 'Impact', variants: ['regular'], category: 'fantasy', tags: [] },
  { family: 'Roboto', variants: ['regular', '700'], category: 'sans-serif', tags: [] },
  { family: 'Open Sans', variants: ['regular', '700'], category: 'sans-serif', tags: [] },
  { family: 'Lato', variants: ['regular', '700'], category: 'sans-serif', tags: [] },
  { family: 'Montserrat', variants: ['regular', '700'], category: 'sans-serif', tags: [] },
  { family: 'Poppins', variants: ['regular', '700'], category: 'sans-serif', tags: [] },
];

/** Feeling categories extracted from Google Fonts tags */
export const FEELING_CATEGORIES = [
  'All',
  'Business',
  'Fancy',
  'Calm',
  'Playful',
  'Cute',
  'Artistic',
  'Vintage',
  'Loud',
  'Sophisticated',
  'Futuristic',
  'Active',
  'Stiff',
  'Innovative',
  'Happy',
  'Childlike',
  'Rugged',
  'Awkward',
  'Excited',
] as const;

/** Module-level cache — only fetched once */
let cachedFonts: FontItem[] | null = null;
let fetchPromise: Promise<FontItem[]> | null = null;

/**
 * Fetch the Google Fonts catalog. Returns cached result on subsequent calls.
 * Falls back to DEFAULT_FONTS if API fails.
 */
export function fetchGoogleFonts(): Promise<FontItem[]> {
  if (cachedFonts) return Promise.resolve(cachedFonts);
  if (fetchPromise) return fetchPromise;

  if (!CATALOG_AVAILABLE) return Promise.resolve(DEFAULT_FONTS);

  trace.action('google-fonts:fetch-start', { cloud: CLOUD_ENABLED });

  fetchPromise = fetch(CATALOG_URL, { credentials: 'same-origin' })
    .then(res => {
      if (!CLOUD_ENABLED && res.status === 503) return { items: DEFAULT_FONTS };
      if (!res.ok) throw new Error(`Google Fonts API: ${res.status}`);
      return res.json();
    })
    .then(data => {
      const fonts: FontItem[] = (data.items || []).map((item: Pick<FontItem, 'family'> & Partial<FontItem>) => ({
        family: item.family,
        variants: item.variants || ['regular'],
        category: item.category || 'sans-serif',
        tags: item.tags || [],
      }));

      cachedFonts = fonts;
      trace.action('google-fonts:fetch-done', { count: fonts.length });
      return fonts;
    })
    .catch(err => {
      trace.error('google-fonts:fetch-error', err);
      cachedFonts = DEFAULT_FONTS;
      return DEFAULT_FONTS;
    })
    .finally(() => {
      fetchPromise = null;
    });

  return fetchPromise;
}
