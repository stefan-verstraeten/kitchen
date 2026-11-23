import type { Lang, ThermomixMode, ThermomixSetting, ThermomixSpeed } from './types';

/**
 * Parses Thermomix notations as written by Cookidoo and similar sources, in
 * Dutch, English and German, e.g.
 *   "5 sec./snelheid 5"
 *   "3 min/100°C/speed 1"
 *   "10 Min./Varoma/Linkslauf/Sanftrührstufe"
 *   "12 min./100°C/omgekeerde draairichting/snelheid lepel"
 *   "2 min./kneden" , "Dough mode 2 min"
 */

// Cookidoo renders the reverse and knead modes with private-use icon glyphs.
const ICON_GLYPHS = /[-]/g;

const TIME = String.raw`(\d+(?:[.,]\d+)?)\s*(?:-\s*\d+(?:[.,]\d+)?\s*)?(sec|sek|seconden|seconds|s|min|minuten|minutes|minuut|minute|uur|uren|hours?|h|std|stunden?)(?![a-zà-ÿ])\.?`;
const TEMP = String.raw`(\d{2,3})\s*°\s*C?`;
const VAROMA = String.raw`varoma`;
const REVERSE = String.raw`omgekeerde\s+draairichting|tegen\s+de\s+klok\s+in|linksdraaiend|linksdraaien|linkslauf|reverse|counter-?clockwise`;
const SPEED = String.raw`(?:snelheid|speed|stufe|stand)\s*(\d+(?:[.,]5)?(?:\s*-\s*\d+(?:[.,]5)?)?|lepel|spoon|soft|turbo)|sanftrührstufe`;
const MODE = String.raw`deeg\s*kneden|kneden|knead(?:ing)?|dough\s*mode|teigkneten|teigknetstufe|turbo|aanbraden|anbraten|browning|stomen|dämpfen|steaming|slow\s*cook(?:ing)?|langzaam\s*garen|sous[-\s]?vide|fermenteren|fermentation|opwarmen|warm\s*up|rijstkoker|rice\s*cooker|mixen|blend|eierkoker|egg\s*boiler|voorreiniging|pre-?clean`;

const TOKEN = `(?:${TIME}|${TEMP}|${VAROMA}|${REVERSE}|${SPEED}|${MODE})`;
const CHUNK_RE = new RegExp(`${TOKEN}(?:(?:\\s*/\\s*|\\s+)${TOKEN})*`, 'gi');
const TOKEN_RE = new RegExp(TOKEN, 'gi');

const MODE_MAP: [RegExp, ThermomixMode][] = [
  [/kneden|knead|dough|teigkne/i, 'knead'],
  [/turbo/i, 'turbo'],
  [/aanbraden|anbraten|browning/i, 'browning'],
  [/stomen|dämpfen|steaming/i, 'steam'],
  [/slow|langzaam/i, 'slow-cook'],
  [/sous/i, 'sous-vide'],
  [/ferment/i, 'fermentation'],
  [/opwarmen|warm/i, 'warm-up'],
  [/rijst|rice/i, 'rice-cooker'],
  [/mixen|blend/i, 'blend'],
  [/eier|egg/i, 'egg-boiler'],
  [/reiniging|clean/i, 'pre-clean'],
];

function toSeconds(value: string, unit: string): number {
  const n = Number(value.replace(',', '.'));
  const u = unit.toLowerCase();
  if (u.startsWith('s')) return n;
  if (u.startsWith('h') || u.startsWith('u') || u.startsWith('st')) return n * 3600;
  return n * 60;
}

function parseSpeed(raw: string): ThermomixSpeed | undefined {
  const s = raw.toLowerCase();
  if (/lepel|spoon|soft|sanft/.test(s)) return 'spoon';
  if (/turbo/.test(s)) return undefined;
  const m = /(\d+(?:[.,]5)?)(?:\s*-\s*(\d+(?:[.,]5)?))?/.exec(s);
  if (!m) return undefined;
  // For ramps like "speed 5-10" keep the final speed.
  return Number((m[2] ?? m[1]).replace(',', '.'));
}

function parseChunk(chunk: string): ThermomixSetting | undefined {
  const setting: ThermomixSetting = { raw: chunk.trim() };
  for (const [token] of chunk.matchAll(TOKEN_RE)) {
    const part = token.trim();
    let m: RegExpExecArray | null;
    if ((m = new RegExp(`^${TIME}$`, 'i').exec(part))) {
      setting.timeSeconds = toSeconds(m[1], m[2]);
    } else if ((m = new RegExp(`^${TEMP}$`, 'i').exec(part))) {
      setting.temperature = Number(m[1]);
    } else if (/^varoma$/i.test(part)) {
      setting.temperature = 'varoma';
    } else if (new RegExp(`^(?:${REVERSE})$`, 'i').test(part)) {
      setting.reverse = true;
    } else if (new RegExp(`^(?:${SPEED})$`, 'i').test(part)) {
      const speed = parseSpeed(part);
      if (speed !== undefined) setting.speed = speed;
      else if (/turbo/i.test(part)) setting.mode = 'turbo';
    } else {
      const mode = MODE_MAP.find(([re]) => re.test(part));
      if (mode) setting.mode = mode[1];
    }
  }
  const meaningful =
    setting.speed !== undefined || setting.mode !== undefined || (setting.timeSeconds !== undefined && (setting.temperature !== undefined || setting.reverse));
  return meaningful ? setting : undefined;
}

/** Find all Thermomix settings mentioned in a step text. */
export function parseThermomixSettings(text: string): ThermomixSetting[] {
  const clean = text.replace(ICON_GLYPHS, ' omgekeerde draairichting ').replace(/ /g, ' ');
  const results: ThermomixSetting[] = [];
  for (const match of clean.matchAll(CHUNK_RE)) {
    if (!match[0].includes('/') && !/snelheid|speed|stufe|stand|kneden|knead|dough|teigkne|sanft/i.test(match[0])) {
      continue; // a lone "5 min" or "180°C" is ordinary recipe text, not a machine setting
    }
    const s = parseChunk(match[0]);
    if (s) results.push(s);
  }
  return results;
}

export function looksLikeThermomix(texts: string[]): boolean {
  return texts.some((t) => parseThermomixSettings(t).length > 0);
}

// ---- formatting ----------------------------------------------------------

const LABELS: Record<Lang, { speed: string; spoon: string; reverse: string; modes: Record<ThermomixMode, string> }> = {
  nl: {
    speed: 'snelheid',
    spoon: 'lepel',
    reverse: 'omgekeerde draairichting',
    modes: {
      knead: 'kneden',
      turbo: 'turbo',
      browning: 'aanbraden',
      steam: 'stomen',
      'slow-cook': 'langzaam garen',
      'sous-vide': 'sous-vide',
      fermentation: 'fermenteren',
      'warm-up': 'opwarmen',
      'rice-cooker': 'rijstkoker',
      blend: 'mixen',
      'egg-boiler': 'eierkoker',
      'pre-clean': 'voorreinigen',
    },
  },
  en: {
    speed: 'speed',
    spoon: 'spoon',
    reverse: 'reverse',
    modes: {
      knead: 'dough mode',
      turbo: 'turbo',
      browning: 'browning',
      steam: 'steaming',
      'slow-cook': 'slow cook',
      'sous-vide': 'sous-vide',
      fermentation: 'fermentation',
      'warm-up': 'warm up',
      'rice-cooker': 'rice cooker',
      blend: 'blend',
      'egg-boiler': 'egg boiler',
      'pre-clean': 'pre-clean',
    },
  },
};

export function formatDuration(seconds: number, lang: Lang): string {
  if (seconds < 60) return `${seconds} sec`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s ? `${m} min ${s} sec` : `${m} min`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  const hour = lang === 'nl' ? 'u' : 'h';
  return m ? `${h} ${hour} ${m} min` : `${h} ${hour}`;
}

/** Uniform rendering, e.g. "3 min / 100 °C / omgekeerde draairichting / snelheid 1". */
export function formatThermomixSetting(s: ThermomixSetting, lang: Lang): string {
  const L = LABELS[lang];
  const parts: string[] = [];
  if (s.mode) parts.push(L.modes[s.mode]);
  if (s.timeSeconds !== undefined) parts.push(formatDuration(s.timeSeconds, lang));
  if (s.temperature !== undefined) parts.push(s.temperature === 'varoma' ? 'Varoma' : `${s.temperature} °C`);
  if (s.reverse) parts.push(L.reverse);
  if (s.speed !== undefined) parts.push(`${L.speed} ${s.speed === 'spoon' ? L.spoon : String(s.speed).replace('.', lang === 'nl' ? ',' : '.')}`);
  return parts.join(' / ');
}
