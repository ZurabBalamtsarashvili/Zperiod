// =============================================================================
// Theme colour engine — derives dark-theme overrides from light CSS
// =============================================================================
// Shared by scripts/build_dark_theme.mjs (static stylesheets, build time) and
// themeController.js (styles injected by JS at runtime). Every colour in a
// colour-bearing declaration is remapped according to the role it plays
// (background, text, border, shadow) and the rule is re-emitted under
// `html.dark-theme`, so each override outranks the rule it replaces.

const NAMED = {
  white: [255, 255, 255], black: [0, 0, 0], red: [255, 0, 0], green: [0, 128, 0],
  blue: [0, 0, 255], gray: [128, 128, 128], grey: [128, 128, 128], silver: [192, 192, 192],
  orange: [255, 165, 0], yellow: [255, 255, 0], purple: [128, 0, 128], pink: [255, 192, 203],
  gold: [255, 215, 0], navy: [0, 0, 128], teal: [0, 128, 128], crimson: [220, 20, 60],
  whitesmoke: [245, 245, 245], gainsboro: [220, 220, 220], lightgray: [211, 211, 211],
  lightgrey: [211, 211, 211], darkgray: [169, 169, 169], dimgray: [105, 105, 105],
  ghostwhite: [248, 248, 255], snow: [255, 250, 250], ivory: [255, 255, 240],
  aliceblue: [240, 248, 255], linen: [250, 240, 230], beige: [245, 245, 220],
  lime: [0, 255, 0], cyan: [0, 255, 255], magenta: [255, 0, 255], brown: [165, 42, 42],
  tomato: [255, 99, 71], coral: [255, 127, 80], salmon: [250, 128, 114],
  skyblue: [135, 206, 235], royalblue: [65, 105, 225], dodgerblue: [30, 144, 255],
  darkblue: [0, 0, 139], darkgreen: [0, 100, 0], darkred: [139, 0, 0],
  lightblue: [173, 216, 230], lightgreen: [144, 238, 144], indigo: [75, 0, 130],
  violet: [238, 130, 238], maroon: [128, 0, 0], olive: [128, 128, 0],
};

const COLOR_RE = new RegExp(
  "#[0-9a-fA-F]{3,8}\\b|(?:rgba?|hsla?)\\([^()]*\\)|\\b(?:" + Object.keys(NAMED).join("|") + ")\\b",
  "gi",
);

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// Greys are re-tinted towards one cool hue so every surface shares the palette.
const NEUTRAL_HUE = 220 / 360;

function parseColor(token) {
  const t = token.toLowerCase();
  if (NAMED[t]) return [...NAMED[t], 1];
  if (t[0] === "#") {
    let h = t.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  const m = t.match(/^(rgba?|hsla?)\((.*)\)$/);
  if (!m) return null;
  if (/var\(|calc\(/.test(m[2])) return null;
  const parts = m[2].replace(/\s*\/\s*/, ",").split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const num = (p, scale) => (p.endsWith("%") ? (parseFloat(p) / 100) * scale : parseFloat(p));
  const alpha = parts[3] !== undefined ? num(parts[3], 1) : 1;
  if (m[1].startsWith("rgb")) {
    return [num(parts[0], 255), num(parts[1], 255), num(parts[2], 255), alpha];
  }
  const [r, g, b] = hslToRgb(parseFloat(parts[0]) / 360, num(parts[1], 1), num(parts[2], 1));
  return [r, g, b, alpha];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

function format(h, s, l, a) {
  const [r, g, b] = hslToRgb(h, clamp(s), clamp(l)).map((v) => Math.round(v));
  const alpha = Math.round(clamp(a) * 1000) / 1000;
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Role mappings. Light surfaces become dark and dark text becomes light;
// surfaces that are already dark (and the light text drawn on them) keep
// their polarity, so light-on-dark pairs stay readable.
const ROLE = {
  bg(h, s, l, a) {
    if (l < 0.18 && a < 0.14) return format(0, 0, 1, Math.min(a * 1.4, 0.16)); // hover tint
    if (l < 0.18 && a < 0.9) return format(h, s, l, a); // backdrop / overlay
    if (l < 0.3) return format(h, s * 0.8, 0.16 + l * 0.5, a); // dark surfaces stay dark
    if (s < 0.22 || l > 0.96) return format(NEUTRAL_HUE, 0.14, 0.105 + (1 - l) * 0.6, a);
    if (l > 0.7) return format(h, s * 0.5, 0.15 + (1 - l) * 0.45, a); // pastel tint
    return format(h, s * 0.88, l * 0.9, a); // vivid accents stay vivid
  },
  text(h, s, l, a) {
    if (l > 0.85) return format(h, s * 0.6, Math.max(l * 0.96, 0.9), a); // light text stays light
    if (s < 0.22) return format(NEUTRAL_HUE, 0.06, 0.95 - l * 0.62, a);
    if (l < 0.55) return format(h, Math.min(s, 0.85), 0.62 + (0.55 - l) * 0.45, a);
    return format(h, s, Math.min(l, 0.82), a);
  },
  border(h, s, l, a) {
    if (l < 0.18 && a < 0.6) return format(0, 0, 1, Math.min(a * 1.1, 0.2));
    if (s < 0.22 || l > 0.96) return format(NEUTRAL_HUE, 0.1, 0.2 + (1 - l) * 0.62, a);
    if (l > 0.7) return format(h, s * 0.55, 0.28 + (1 - l) * 0.5, a);
    return format(h, s, clamp(l, 0.35, 0.7), a);
  },
  shadow(h, s, l, a) {
    if (l > 0.9) return format(h, s, l, a * 0.12); // white highlight → faint
    if (l < 0.2) return format(0, 0, 0, Math.min(a * 1.8, 0.7));
    return format(h, s, l, a * 0.8);
  },
};

function roleForProperty(prop) {
  const p = prop.toLowerCase();
  if (p.startsWith("--")) {
    if (/shadow/.test(p)) return "shadow";
    if (/border|outline|stroke|divider|line/.test(p)) return "border";
    if (/text|fg|foreground|ink|font/.test(p)) return "text";
    return "bg";
  }
  if (p === "color" || p === "fill" || p === "caret-color" || p === "-webkit-text-fill-color"
    || p === "text-decoration-color" || p === "text-emphasis-color" || p === "column-rule-color"
    || p === "stroke" || p === "accent-color") return "text";
  if (p === "background" || p === "background-color" || p === "background-image"
    || p === "-webkit-mask" || p === "border-image") return "bg";
  if (p.startsWith("border") || p.startsWith("outline")) return "border";
  if (p === "box-shadow" || p === "text-shadow" || p === "filter" || p === "-webkit-box-shadow") return "shadow";
  return null;
}

export function convertValue(prop, value, roleOverride = null) {
  const role = roleOverride || roleForProperty(prop);
  if (!role) return null;
  let changed = false;
  const out = value.replace(COLOR_RE, (token) => {
    const rgba = parseColor(token);
    if (!rgba) return token;
    const [h, s, l] = rgbToHsl(rgba[0], rgba[1], rgba[2]);
    changed = true;
    return ROLE[role](h, s, l, rgba[3]);
  });
  return changed ? out : null;
}

// ---- Minimal CSS parser -----------------------------------------------------

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function parseBlocks(css) {
  const nodes = [];
  let i = 0;
  const n = css.length;
  while (i < n) {
    while (i < n && /\s/.test(css[i])) i++;
    if (i >= n) break;
    let start = i;
    let quote = null;
    while (i < n) {
      const c = css[i];
      if (quote) { if (c === quote && css[i - 1] !== "\\") quote = null; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === "{" || c === ";" || c === "}") break;
      i++;
    }
    const prelude = css.slice(start, i).trim();
    if (css[i] === ";" || css[i] === "}") { i++; continue; } // stray statement (@import etc.)
    // find matching brace
    let depth = 1;
    const bodyStart = ++i;
    quote = null;
    while (i < n && depth > 0) {
      const c = css[i];
      if (quote) { if (c === quote && css[i - 1] !== "\\") quote = null; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
      i++;
    }
    const body = css.slice(bodyStart, i - 1);
    nodes.push({ prelude, body });
  }
  return nodes;
}

function splitTopLevel(str, sep) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let cur = "";
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (quote) { if (c === quote) quote = null; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === sep && depth === 0) { parts.push(cur); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function prefixSelector(sel, scope) {
  const s = sel.trim();
  if (!s) return null;
  if (s.startsWith(":root")) return scope + s.slice(5);
  if (/^html(?![\w-])/.test(s)) return scope + s.slice(4);
  return `${scope} ${s}`;
}

// Re-emitting the `background` shorthand would reset background-clip (and
// break gradient text), so plain colours and pure gradient lists are written
// to the matching longhand instead.
const PURE_COLOR_RE = /^(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?)\([^()]*\)|[a-z]+)$/i;
const PURE_GRADIENTS_RE = /^(?:\s*(?:repeating-)?(?:linear|radial|conic)-gradient\((?:[^()]|\([^()]*\))*\)\s*,?)+$/i;

function longhandFor(prop, value) {
  if (prop.toLowerCase() !== "background") return prop;
  const v = value.trim();
  if (PURE_COLOR_RE.test(v)) return "background-color";
  if (PURE_GRADIENTS_RE.test(v)) return "background-image";
  return prop;
}

function convertRule(prelude, body, scope) {
  if (/dark-theme|light-theme/.test(prelude)) return "";
  const decls = splitTopLevel(body, ";");
  const out = [];
  // Gradient text paints its background through the glyphs, so those colours
  // behave like text colours.
  const clipsToText = /(?:^|;)\s*(?:-webkit-)?background-clip\s*:\s*text/i.test(body);
  for (const d of decls) {
    const idx = d.indexOf(":");
    if (idx < 0) continue;
    const prop = d.slice(0, idx).trim();
    let value = d.slice(idx + 1).trim();
    const important = /!important\s*$/i.test(value);
    if (important) value = value.replace(/!important\s*$/i, "").trim();
    const isBackground = /^background(?:-image|-color)?$/i.test(prop);
    const converted = convertValue(prop, value, clipsToText && isBackground ? "text" : null);
    if (converted) out.push(`${longhandFor(prop, converted)}: ${converted}${important ? " !important" : ""}`);
  }
  if (!out.length) return "";
  const selectors = splitTopLevel(prelude, ",").map((s) => prefixSelector(s, scope)).filter(Boolean);
  if (!selectors.length) return "";
  return `${selectors.join(",\n")} {\n  ${out.join(";\n  ")};\n}\n`;
}

function convertNodes(nodes, scope) {
  let out = "";
  for (const { prelude, body } of nodes) {
    if (prelude.startsWith("@")) {
      if (/^@(media|supports|layer|container)/i.test(prelude)) {
        const inner = convertNodes(parseBlocks(body), scope);
        if (inner) out += `${prelude} {\n${inner}}\n`;
      }
      // @keyframes, @font-face, @page: left as-is
      continue;
    }
    out += convertRule(prelude, body, scope);
  }
  return out;
}

/** Returns dark-theme override CSS for the given light stylesheet text. */
export function buildDarkOverrides(cssText, scope = "html.dark-theme") {
  return convertNodes(parseBlocks(stripComments(cssText)), scope);
}
