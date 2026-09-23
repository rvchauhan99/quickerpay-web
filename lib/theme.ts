/** Browser-only appearance (localStorage + CSS vars). No API. */

export const COLOR_THEME_STORAGE_KEY = 'qp.ui.colorTheme'
export const PRIMARY_HEX_STORAGE_KEY = 'qp.ui.primaryHex'
export const PANEL_STYLE_STORAGE_KEY = 'qp.ui.panelStyle'
export const PANEL_HEX_STORAGE_KEY = 'qp.ui.panelHex'
export const SURFACE_STYLE_STORAGE_KEY = 'qp.ui.surfaceStyle'
export const SURFACE_HEX_STORAGE_KEY = 'qp.ui.surfaceHex'

export const COLOR_THEME_IDS = [
  'blue',
  'teal',
  'indigo',
  'emerald',
  'rose',
  'amber',
  'violet',
  'cyan',
  'custom',
] as const

export type ColorThemeId = (typeof COLOR_THEME_IDS)[number]

export const PANEL_STYLE_IDS = ['slate', 'ink', 'brand', 'light', 'custom'] as const
export type PanelStyleId = (typeof PANEL_STYLE_IDS)[number]

export const SURFACE_STYLE_IDS = ['light', 'soft', 'contrast', 'custom'] as const
export type SurfaceStyleId = (typeof SURFACE_STYLE_IDS)[number]

export const DEFAULT_COLOR_THEME: ColorThemeId = 'blue'
export const DEFAULT_PANEL_STYLE: PanelStyleId = 'slate'
export const DEFAULT_SURFACE_STYLE: SurfaceStyleId = 'light'
export const DEFAULT_CUSTOM_HEX = '#2563eb'
export const DEFAULT_PANEL_HEX = '#0f172a'
export const DEFAULT_SURFACE_HEX = '#f8fafc'

export const COLOR_THEME_OPTIONS: ReadonlyArray<{
  id: Exclude<ColorThemeId, 'custom'>
  label: string
  swatch: string
}> = [
  { id: 'blue', label: 'Blue', swatch: '#2563eb' },
  { id: 'teal', label: 'Teal', swatch: '#0d9488' },
  { id: 'indigo', label: 'Indigo', swatch: '#4f46e5' },
  { id: 'emerald', label: 'Emerald', swatch: '#059669' },
  { id: 'rose', label: 'Rose', swatch: '#e11d48' },
  { id: 'amber', label: 'Amber', swatch: '#d97706' },
  { id: 'violet', label: 'Violet', swatch: '#7c3aed' },
  { id: 'cyan', label: 'Cyan', swatch: '#0891b2' },
]

export const PANEL_STYLE_OPTIONS: ReadonlyArray<{
  id: Exclude<PanelStyleId, 'custom'>
  label: string
  previewBg: string
  previewActive: string
}> = [
  { id: 'slate', label: 'Slate', previewBg: '#0f172a', previewActive: '#1e40af' },
  { id: 'ink', label: 'Ink', previewBg: '#09090b', previewActive: '#3f3f46' },
  { id: 'brand', label: 'Brand', previewBg: '#1e3a5f', previewActive: '#2563eb' },
  { id: 'light', label: 'Light', previewBg: '#f1f5f9', previewActive: '#2563eb' },
]

export const SURFACE_STYLE_OPTIONS: ReadonlyArray<{
  id: Exclude<SurfaceStyleId, 'custom'>
  label: string
}> = [
  { id: 'light', label: 'Light' },
  { id: 'soft', label: 'Soft tint' },
  { id: 'contrast', label: 'Contrast' },
]

export interface AppearanceState {
  theme: ColorThemeId
  primaryHex: string
  panel: PanelStyleId
  panelHex: string
  surface: SurfaceStyleId
  surfaceHex: string
}

export function isColorThemeId(value: string | null | undefined): value is ColorThemeId {
  return COLOR_THEME_IDS.includes(value as ColorThemeId)
}

export function isPanelStyleId(value: string | null | undefined): value is PanelStyleId {
  return PANEL_STYLE_IDS.includes(value as PanelStyleId)
}

export function isSurfaceStyleId(value: string | null | undefined): value is SurfaceStyleId {
  return SURFACE_STYLE_IDS.includes(value as SurfaceStyleId)
}

export function normalizeHex(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (!/^#[0-9a-fA-F]{6}$/.test(withHash)) return null
  return withHash.toLowerCase()
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function parseRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHex(hex)
  if (!n) return null
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  }
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => clampByte(c).toString(16).padStart(2, '0')).join('')}`
}

function mix(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
): string {
  return toHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t)
}

/** Relative luminance 0–1 (sRGB). */
function luminance(rgb: { r: number; g: number; b: number }): number {
  const lin = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!
}

function isLight(rgb: { r: number; g: number; b: number }): boolean {
  return luminance(rgb) > 0.45
}

/** Derive brand CSS vars from a single primary hex. */
export function deriveAccentVars(hex: string): Record<string, string> {
  const rgb = parseRgb(hex) ?? parseRgb(DEFAULT_CUSTOM_HEX)!
  const white = { r: 255, g: 255, b: 255 }
  const black = { r: 0, g: 0, b: 0 }
  const primary = toHex(rgb.r, rgb.g, rgb.b)
  const primaryDark = mix(rgb, black, 0.22)
  const primaryLight = mix(rgb, white, 0.9)
  const accent = mix(rgb, white, 0.12)
  return {
    '--qp-primary': primary,
    '--qp-primary-dark': primaryDark,
    '--qp-primary-light': primaryLight,
    '--qp-primary-ring': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`,
    '--qp-accent': accent,
    '--qp-accent-bg': primaryLight,
  }
}

export function deriveBrandPanelVars(hex: string): Record<string, string> {
  const rgb = parseRgb(hex) ?? parseRgb(DEFAULT_CUSTOM_HEX)!
  const white = { r: 255, g: 255, b: 255 }
  const black = { r: 0, g: 0, b: 0 }
  const bg = mix(rgb, black, 0.72)
  const hover = mix(rgb, black, 0.58)
  const active = mix(rgb, black, 0.28)
  const text = mix(rgb, white, 0.78)
  const muted = mix(rgb, white, 0.55)
  const borderRgb = parseRgb(text)!
  return {
    '--qp-sidebar-bg': bg,
    '--qp-sidebar-hover': hover,
    '--qp-sidebar-active': active,
    '--qp-sidebar-text': text,
    '--qp-sidebar-muted': muted,
    '--qp-sidebar-border': `rgba(${borderRgb.r}, ${borderRgb.g}, ${borderRgb.b}, 0.14)`,
    '--qp-sidebar-active-text': '#ffffff',
  }
}

/** Panel custom: picker color is the sidebar base. */
export function deriveCustomPanelVars(hex: string): Record<string, string> {
  const rgb = parseRgb(hex) ?? parseRgb(DEFAULT_PANEL_HEX)!
  const white = { r: 255, g: 255, b: 255 }
  const black = { r: 0, g: 0, b: 0 }
  const lightBg = isLight(rgb)
  const bg = toHex(rgb.r, rgb.g, rgb.b)
  const hover = lightBg ? mix(rgb, black, 0.08) : mix(rgb, white, 0.1)
  const active = lightBg ? mix(rgb, black, 0.22) : mix(rgb, white, 0.22)
  const text = lightBg ? mix(rgb, black, 0.72) : mix(rgb, white, 0.82)
  const muted = lightBg ? mix(rgb, black, 0.45) : mix(rgb, white, 0.55)
  const borderRgb = parseRgb(text)!
  const activeText = isLight(parseRgb(active)!) ? '#0f172a' : '#ffffff'
  return {
    '--qp-sidebar-bg': bg,
    '--qp-sidebar-hover': hover,
    '--qp-sidebar-active': active,
    '--qp-sidebar-text': text,
    '--qp-sidebar-muted': muted,
    '--qp-sidebar-border': `rgba(${borderRgb.r}, ${borderRgb.g}, ${borderRgb.b}, ${lightBg ? 0.12 : 0.14})`,
    '--qp-sidebar-active-text': activeText,
  }
}

/** Surface custom: picker color is the content canvas. */
export function deriveCustomSurfaceVars(hex: string): Record<string, string> {
  const rgb = parseRgb(hex) ?? parseRgb(DEFAULT_SURFACE_HEX)!
  const white = { r: 255, g: 255, b: 255 }
  const slateBorder = { r: 226, g: 232, b: 240 }
  const surface = toHex(rgb.r, rgb.g, rgb.b)
  const card = isLight(rgb) ? '#ffffff' : mix(rgb, white, 0.88)
  const border = mix(rgb, slateBorder, 0.55)
  return {
    '--qp-surface': surface,
    '--qp-card': card,
    '--qp-border': border,
  }
}

const PRESET_HEX: Record<Exclude<ColorThemeId, 'custom'>, string> = {
  blue: '#2563eb',
  teal: '#0d9488',
  indigo: '#4f46e5',
  emerald: '#059669',
  rose: '#e11d48',
  amber: '#d97706',
  violet: '#7c3aed',
  cyan: '#0891b2',
}

export function accentHexForTheme(theme: ColorThemeId, primaryHex: string): string {
  if (theme === 'custom') return normalizeHex(primaryHex) ?? DEFAULT_CUSTOM_HEX
  return PRESET_HEX[theme]
}

const CUSTOM_VAR_KEYS = [
  '--qp-primary',
  '--qp-primary-dark',
  '--qp-primary-light',
  '--qp-primary-ring',
  '--qp-accent',
  '--qp-accent-bg',
  '--qp-sidebar-bg',
  '--qp-sidebar-hover',
  '--qp-sidebar-active',
  '--qp-sidebar-text',
  '--qp-sidebar-muted',
  '--qp-sidebar-border',
  '--qp-sidebar-active-text',
  '--qp-surface',
  '--qp-card',
  '--qp-border',
] as const

function clearInlineVars(el: HTMLElement) {
  for (const key of CUSTOM_VAR_KEYS) {
    el.style.removeProperty(key)
  }
}

function setVars(el: HTMLElement, vars: Record<string, string>) {
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value)
  }
}

function defaultAppearance(): AppearanceState {
  return {
    theme: DEFAULT_COLOR_THEME,
    primaryHex: DEFAULT_CUSTOM_HEX,
    panel: DEFAULT_PANEL_STYLE,
    panelHex: DEFAULT_PANEL_HEX,
    surface: DEFAULT_SURFACE_STYLE,
    surfaceHex: DEFAULT_SURFACE_HEX,
  }
}

export function readAppearance(): AppearanceState {
  if (typeof window === 'undefined') return defaultAppearance()
  try {
    const themeRaw = window.localStorage.getItem(COLOR_THEME_STORAGE_KEY)
    const theme = isColorThemeId(themeRaw) ? themeRaw : DEFAULT_COLOR_THEME
    const primaryHex =
      normalizeHex(window.localStorage.getItem(PRIMARY_HEX_STORAGE_KEY)) ?? DEFAULT_CUSTOM_HEX
    const panelRaw = window.localStorage.getItem(PANEL_STYLE_STORAGE_KEY)
    const panel = isPanelStyleId(panelRaw) ? panelRaw : DEFAULT_PANEL_STYLE
    const panelHex =
      normalizeHex(window.localStorage.getItem(PANEL_HEX_STORAGE_KEY)) ?? DEFAULT_PANEL_HEX
    const surfaceRaw = window.localStorage.getItem(SURFACE_STYLE_STORAGE_KEY)
    const surface = isSurfaceStyleId(surfaceRaw) ? surfaceRaw : DEFAULT_SURFACE_STYLE
    const surfaceHex =
      normalizeHex(window.localStorage.getItem(SURFACE_HEX_STORAGE_KEY)) ?? DEFAULT_SURFACE_HEX
    return { theme, primaryHex, panel, panelHex, surface, surfaceHex }
  } catch {
    return defaultAppearance()
  }
}

/** Apply full appearance to <html>. Does not write localStorage. */
export function applyAppearance(state?: Partial<AppearanceState>): AppearanceState {
  const current = typeof window !== 'undefined' ? readAppearance() : defaultAppearance()
  const next: AppearanceState = {
    theme: state?.theme ?? current.theme,
    primaryHex: normalizeHex(state?.primaryHex ?? current.primaryHex) ?? DEFAULT_CUSTOM_HEX,
    panel: state?.panel ?? current.panel,
    panelHex: normalizeHex(state?.panelHex ?? current.panelHex) ?? DEFAULT_PANEL_HEX,
    surface: state?.surface ?? current.surface,
    surfaceHex: normalizeHex(state?.surfaceHex ?? current.surfaceHex) ?? DEFAULT_SURFACE_HEX,
  }

  if (typeof document === 'undefined') return next

  const root = document.documentElement
  clearInlineVars(root)
  root.dataset.theme = next.theme
  root.dataset.panel = next.panel
  root.dataset.surface = next.surface

  const accentHex = accentHexForTheme(next.theme, next.primaryHex)

  if (next.theme === 'custom') {
    setVars(root, deriveAccentVars(accentHex))
  }

  if (next.panel === 'brand') {
    setVars(root, deriveBrandPanelVars(accentHex))
  } else if (next.panel === 'custom') {
    setVars(root, deriveCustomPanelVars(next.panelHex))
  }

  if (next.surface === 'soft') {
    const accent = deriveAccentVars(accentHex)
    const softSurface = accent['--qp-primary-light'] ?? '#eff6ff'
    setVars(root, {
      '--qp-surface': softSurface,
      '--qp-card': '#ffffff',
      '--qp-border': mix(
        parseRgb(accentHex) ?? { r: 37, g: 99, b: 235 },
        { r: 226, g: 232, b: 240 },
        0.65,
      ),
    })
  } else if (next.surface === 'custom') {
    setVars(root, deriveCustomSurfaceVars(next.surfaceHex))
  }

  return next
}

export function persistAppearance(partial: Partial<AppearanceState>): AppearanceState {
  const base = readAppearance()
  const next: AppearanceState = {
    theme: partial.theme ?? base.theme,
    primaryHex: normalizeHex(partial.primaryHex ?? base.primaryHex) ?? DEFAULT_CUSTOM_HEX,
    panel: partial.panel ?? base.panel,
    panelHex: normalizeHex(partial.panelHex ?? base.panelHex) ?? DEFAULT_PANEL_HEX,
    surface: partial.surface ?? base.surface,
    surfaceHex: normalizeHex(partial.surfaceHex ?? base.surfaceHex) ?? DEFAULT_SURFACE_HEX,
  }
  try {
    window.localStorage.setItem(COLOR_THEME_STORAGE_KEY, next.theme)
    window.localStorage.setItem(PRIMARY_HEX_STORAGE_KEY, next.primaryHex)
    window.localStorage.setItem(PANEL_STYLE_STORAGE_KEY, next.panel)
    window.localStorage.setItem(PANEL_HEX_STORAGE_KEY, next.panelHex)
    window.localStorage.setItem(SURFACE_STYLE_STORAGE_KEY, next.surface)
    window.localStorage.setItem(SURFACE_HEX_STORAGE_KEY, next.surfaceHex)
  } catch {
    // Private mode — still apply for this session.
  }
  return applyAppearance(next)
}

export function resetAppearance(): AppearanceState {
  try {
    window.localStorage.removeItem(COLOR_THEME_STORAGE_KEY)
    window.localStorage.removeItem(PRIMARY_HEX_STORAGE_KEY)
    window.localStorage.removeItem(PANEL_STYLE_STORAGE_KEY)
    window.localStorage.removeItem(PANEL_HEX_STORAGE_KEY)
    window.localStorage.removeItem(SURFACE_STYLE_STORAGE_KEY)
    window.localStorage.removeItem(SURFACE_HEX_STORAGE_KEY)
  } catch {
    // ignore
  }
  return applyAppearance(defaultAppearance())
}

/** @deprecated Prefer persistAppearance — kept for any callers of the first theme pass. */
export function persistAndApplyTheme(themeId: ColorThemeId): ColorThemeId {
  return persistAppearance({ theme: themeId }).theme
}

/** @deprecated Prefer applyAppearance */
export function applyTheme(themeId?: ColorThemeId): ColorThemeId {
  return applyAppearance(themeId ? { theme: themeId } : undefined).theme
}

/** @deprecated Prefer readAppearance */
export function readStoredColorTheme(): ColorThemeId {
  return readAppearance().theme
}

/**
 * Inline boot script for root layout — restores theme / panel / surface / custom hex before paint.
 * Keep logic self-contained (no imports).
 */
export const THEME_BOOT_SCRIPT = `(function(){
  try {
    var themeKey=${JSON.stringify(COLOR_THEME_STORAGE_KEY)};
    var hexKey=${JSON.stringify(PRIMARY_HEX_STORAGE_KEY)};
    var panelKey=${JSON.stringify(PANEL_STYLE_STORAGE_KEY)};
    var panelHexKey=${JSON.stringify(PANEL_HEX_STORAGE_KEY)};
    var surfaceKey=${JSON.stringify(SURFACE_STYLE_STORAGE_KEY)};
    var surfaceHexKey=${JSON.stringify(SURFACE_HEX_STORAGE_KEY)};
    var themes=${JSON.stringify([...COLOR_THEME_IDS])};
    var panels=${JSON.stringify([...PANEL_STYLE_IDS])};
    var surfaces=${JSON.stringify([...SURFACE_STYLE_IDS])};
    var defTheme=${JSON.stringify(DEFAULT_COLOR_THEME)};
    var defPanel=${JSON.stringify(DEFAULT_PANEL_STYLE)};
    var defSurface=${JSON.stringify(DEFAULT_SURFACE_STYLE)};
    var defHex=${JSON.stringify(DEFAULT_CUSTOM_HEX)};
    var defPanelHex=${JSON.stringify(DEFAULT_PANEL_HEX)};
    var defSurfaceHex=${JSON.stringify(DEFAULT_SURFACE_HEX)};
    var preset={blue:"#2563eb",teal:"#0d9488",indigo:"#4f46e5",emerald:"#059669",rose:"#e11d48",amber:"#d97706",violet:"#7c3aed",cyan:"#0891b2"};
    var root=document.documentElement;
    var theme=localStorage.getItem(themeKey); if(themes.indexOf(theme)<0) theme=defTheme;
    var panel=localStorage.getItem(panelKey); if(panels.indexOf(panel)<0) panel=defPanel;
    var surface=localStorage.getItem(surfaceKey); if(surfaces.indexOf(surface)<0) surface=defSurface;
    function okHex(h){return /^#[0-9a-fA-F]{6}$/.test(h||"");}
    var hex=localStorage.getItem(hexKey)||""; if(!okHex(hex)) hex=defHex; hex=hex.toLowerCase();
    var panelHex=localStorage.getItem(panelHexKey)||""; if(!okHex(panelHex)) panelHex=defPanelHex; panelHex=panelHex.toLowerCase();
    var surfaceHex=localStorage.getItem(surfaceHexKey)||""; if(!okHex(surfaceHex)) surfaceHex=defSurfaceHex; surfaceHex=surfaceHex.toLowerCase();
    root.dataset.theme=theme;
    root.dataset.panel=panel;
    root.dataset.surface=surface;
    function parse(h){return{r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)};}
    function toH(r,g,b){return "#"+[r,g,b].map(function(c){c=Math.max(0,Math.min(255,Math.round(c)));return c.toString(16).padStart(2,"0");}).join("");}
    function mix(a,b,t){return toH(a.r+(b.r-a.r)*t,a.g+(b.g-a.g)*t,a.b+(b.b-a.b)*t);}
    function lum(c){var L=[c.r,c.g,c.b].map(function(v){var s=v/255;return s<=0.03928?s/12.92:Math.pow((s+0.055)/1.055,2.4);});return 0.2126*L[0]+0.7152*L[1]+0.0722*L[2];}
    function isLight(c){return lum(c)>0.45;}
    function set(k,v){root.style.setProperty(k,v);}
    var accentHex=theme==="custom"?hex:(preset[theme]||defHex);
    var rgb=parse(accentHex);
    var white={r:255,g:255,b:255}, black={r:0,g:0,b:0};
    if(theme==="custom"){
      var light=mix(rgb,white,0.9);
      set("--qp-primary",accentHex);
      set("--qp-primary-dark",mix(rgb,black,0.22));
      set("--qp-primary-light",light);
      set("--qp-primary-ring","rgba("+rgb.r+", "+rgb.g+", "+rgb.b+", 0.25)");
      set("--qp-accent",mix(rgb,white,0.12));
      set("--qp-accent-bg",light);
    }
    if(panel==="brand"){
      var text=mix(rgb,white,0.78);
      var tr=parse(text);
      set("--qp-sidebar-bg",mix(rgb,black,0.72));
      set("--qp-sidebar-hover",mix(rgb,black,0.58));
      set("--qp-sidebar-active",mix(rgb,black,0.28));
      set("--qp-sidebar-text",text);
      set("--qp-sidebar-muted",mix(rgb,white,0.55));
      set("--qp-sidebar-border","rgba("+tr.r+", "+tr.g+", "+tr.b+", 0.14)");
      set("--qp-sidebar-active-text","#ffffff");
    } else if(panel==="custom"){
      var pr=parse(panelHex);
      var lightP=isLight(pr);
      var hover=lightP?mix(pr,black,0.08):mix(pr,white,0.1);
      var active=lightP?mix(pr,black,0.22):mix(pr,white,0.22);
      var pText=lightP?mix(pr,black,0.72):mix(pr,white,0.82);
      var pMuted=lightP?mix(pr,black,0.45):mix(pr,white,0.55);
      var ptr=parse(pText);
      var aRgb=parse(active);
      set("--qp-sidebar-bg",panelHex);
      set("--qp-sidebar-hover",hover);
      set("--qp-sidebar-active",active);
      set("--qp-sidebar-text",pText);
      set("--qp-sidebar-muted",pMuted);
      set("--qp-sidebar-border","rgba("+ptr.r+", "+ptr.g+", "+ptr.b+", "+(lightP?0.12:0.14)+")");
      set("--qp-sidebar-active-text",isLight(aRgb)?"#0f172a":"#ffffff");
    }
    if(surface==="soft"){
      var softLight=mix(rgb,white,0.9);
      set("--qp-surface",softLight);
      set("--qp-card","#ffffff");
      set("--qp-border",mix(rgb,{r:226,g:232,b:240},0.65));
    } else if(surface==="custom"){
      var sr=parse(surfaceHex);
      set("--qp-surface",surfaceHex);
      set("--qp-card",isLight(sr)?"#ffffff":mix(sr,white,0.88));
      set("--qp-border",mix(sr,{r:226,g:232,b:240},0.55));
    }
  } catch(e) {
    document.documentElement.dataset.theme=${JSON.stringify(DEFAULT_COLOR_THEME)};
    document.documentElement.dataset.panel=${JSON.stringify(DEFAULT_PANEL_STYLE)};
    document.documentElement.dataset.surface=${JSON.stringify(DEFAULT_SURFACE_STYLE)};
  }
})();`
