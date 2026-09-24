// =============================================================================
// Theme Controller — light / dark / auto
// =============================================================================
// index.html applies the saved theme before first paint (inline script in
// <head>); this module keeps it in sync with the settings control and the OS
// preference, and derives dark overrides for <style> blocks injected by JS.

import { buildDarkOverrides, convertValue } from "./themeColors.js";

const STORAGE_KEY = "zperiod_theme";
const THEMES = ["light", "dark", "auto"];
const DEFAULT_THEME = "auto";
const DARK_CLASS = "dark-theme";
const GENERATED_ATTR = "data-dark-overrides";

const media = window.matchMedia("(prefers-color-scheme: dark)");

export function getThemePreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function isDarkTheme() {
  return document.documentElement.classList.contains(DARK_CLASS);
}

let switchTimer = null;

// Cross-fade colours briefly when the user flips the theme (not on load).
function animateThemeSwitch() {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  clearTimeout(switchTimer);
  switchTimer = setTimeout(() => root.classList.remove("theme-switching"), 400);
}

function applyTheme(pref = getThemePreference()) {
  const dark = pref === "dark" || (pref === "auto" && media.matches);
  const root = document.documentElement;
  const changed = root.classList.contains(DARK_CLASS) !== dark;
  root.classList.toggle(DARK_CLASS, dark);
  root.style.colorScheme = dark ? "dark" : "light";
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute("content", dark ? "#0f1115" : "#fdfbf7");
  syncThemeButtons(pref);
  if (changed) {
    document.querySelectorAll("[data-dark-style]").forEach((el) => applyInlineTheme(el, dark));
    window.dispatchEvent(new CustomEvent("zperiod:themechange", { detail: { dark } }));
  }
}

export function setThemePreference(pref) {
  if (!THEMES.includes(pref)) return;
  animateThemeSwitch();
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Storage may be unavailable (private mode); the choice still applies for this visit.
  }
  applyTheme(pref);
}

function syncThemeButtons(pref) {
  document.querySelectorAll(".sv-theme-btn").forEach((btn) => {
    const active = btn.dataset.themeValue === pref;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", String(active));
  });
}

// ---- Inline style attributes -------------------------------------------------
// Markup built in JS (and a few spots in index.html) carries colours in
// style="" attributes, which no stylesheet can outrank. When such an element
// enters the DOM its colour declarations are converted once; both variants
// are kept on the element and swapped whenever the theme changes.

const COLOR_HINT = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\b(white|black)\b/i;

function prepareInlineTheme(el) {
  if (el.dataset.darkStyle !== undefined) return;
  const style = el.getAttribute("style");
  if (!style || !COLOR_HINT.test(style)) return;
  const light = {};
  const dark = {};
  for (let i = 0; i < el.style.length; i++) {
    const prop = el.style[i];
    if (prop.startsWith("--")) continue; // custom properties carry their own theme variants
    const value = el.style.getPropertyValue(prop);
    const converted = convertValue(prop, value);
    if (converted) {
      light[prop] = value;
      dark[prop] = converted;
    }
  }
  if (!Object.keys(dark).length) return;
  el.dataset.lightStyle = JSON.stringify(light);
  el.dataset.darkStyle = JSON.stringify(dark);
  if (isDarkTheme()) applyInlineTheme(el, true);
}

function applyInlineTheme(el, dark) {
  try {
    const values = JSON.parse(dark ? el.dataset.darkStyle : el.dataset.lightStyle);
    for (const [prop, value] of Object.entries(values)) {
      el.style.setProperty(prop, value, el.style.getPropertyPriority(prop));
    }
  } catch {
    // Malformed data attributes are ignored; the element keeps its current colours.
  }
}

function prepareSubtree(root) {
  if (root.nodeType !== 1) return;
  if (root.hasAttribute("style")) prepareInlineTheme(root);
  root.querySelectorAll("[style]").forEach(prepareInlineTheme);
}

// ---- Runtime overrides for styles injected by JS ----------------------------

function processStyleElement(el) {
  if (!(el instanceof HTMLStyleElement) || el.hasAttribute(GENERATED_ATTR) || el.dataset.darkDone) return;
  el.dataset.darkDone = "1";
  const css = buildDarkOverrides(el.textContent || "");
  if (!css) return;
  const overrides = document.createElement("style");
  overrides.setAttribute(GENERATED_ATTR, "");
  overrides.media = "screen";
  overrides.textContent = css;
  el.after(overrides);
}

function watchInjectedStyles() {
  document.querySelectorAll("body style, head style:not([" + GENERATED_ATTR + "])").forEach(processStyleElement);
  prepareSubtree(document.body);
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === "STYLE") processStyleElement(node);
        else {
          node.querySelectorAll("style").forEach(processStyleElement);
          prepareSubtree(node);
        }
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
}

export function initThemeController() {
  applyTheme();
  watchInjectedStyles();
  media.addEventListener("change", () => {
    if (getThemePreference() === "auto") {
      animateThemeSwitch();
      applyTheme("auto");
    }
  });
  document.querySelectorAll(".sv-theme-btn").forEach((btn) => {
    btn.addEventListener("click", () => setThemePreference(btn.dataset.themeValue));
  });
}
