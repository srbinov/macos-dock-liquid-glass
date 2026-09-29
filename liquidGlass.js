'use strict';

export const LIQUID_GLASS_MODE = {
  DARK: 0,
  LIGHT: 1,
};

// Tahoe liquid glass: a dim, cool body over a blurred backdrop (see
// glassBlur.js), edged by a thin light rim on all four sides that is brightest
// along the top and bottom, plus a faint inner glow.
// {r,g,b,a}. Intensity 100 is this recipe. Intensity 0 fades to a solid plate.
const LIGHT = {
  fill: [235, 242, 250, 0.26],
  gradientStart: [255, 255, 255, 0.34],
  gradientEnd: [232, 240, 250, 0.22],
};

// Dark: a cool, dim body under the blur (the real dock reads slate-blue, not
// white-washed), lifted slightly toward the top like light entering a lens.
const DARK = {
  fill: [30, 42, 58, 0.24],
  gradientStart: [70, 84, 102, 0.26],
  gradientEnd: [24, 34, 48, 0.22],
};

const SOLID_LIGHT = [255, 255, 255];
const SOLID_DARK = [28, 28, 30];

const lerp = (a, b, t) => a + (b - a) * t;

const interp = (rgba, solid, t, solidAlpha) => {
  const [r, g, b, a] = rgba;
  return `rgba(${Math.round(lerp(solid[0], r, t))}, ${Math.round(lerp(solid[1], g, t))}, ` +
    `${Math.round(lerp(solid[2], b, t))}, ${Math.round(lerp(solidAlpha, a, t) * 1000) / 1000})`;
};

// Specular rim: bright along the top, a darker thickness along the bottom,
// and a soft shadow so the pill floats. Alphas follow intensity so a solid
// plate (t = 0) does not keep a glass outline.
const LIGHT_MODE = LIQUID_GLASS_MODE.LIGHT;
const glassShadows = (mode, t) => {
  const r = (v) => Math.round(v * t * 1000) / 1000;
  // St honours a single box-shadow only (extra layers are dropped with
  // "Ignoring excess values"), so the rim lives in the blur shader and this is
  // just the float shadow.
  return `0 8px 22px rgba(0, 0, 0, ${r(0.20)})`;
};

/**
 * @param {number} mode LIQUID_GLASS_MODE.LIGHT | .DARK
 * @param {number} [intensity] 0-100 (default 100 = full glass)
 */
export const buildLiquidGlassDeclarations = (mode, intensity = 100) => {
  const recipe = mode === LIQUID_GLASS_MODE.LIGHT ? LIGHT : DARK;
  const solid = mode === LIQUID_GLASS_MODE.LIGHT ? SOLID_LIGHT : SOLID_DARK;
  const t = Math.max(0, Math.min(100, intensity)) / 100;
  return [
    `background-color: ${interp(recipe.fill, solid, t, 1)}`,
    'background-gradient-direction: vertical',
    `background-gradient-start: ${interp(recipe.gradientStart, solid, t, 1)}`,
    `background-gradient-end: ${interp(recipe.gradientEnd, solid, t, 1)}`,
    'border: none',
    `box-shadow: ${glassShadows(mode, t)}`,
  ];
};

export const modeForColorScheme = (colorScheme) =>
  colorScheme === 'prefer-dark' ? LIQUID_GLASS_MODE.DARK : LIQUID_GLASS_MODE.LIGHT;

export const buildDockBackgroundStyle = (params) => {
  const {
    liquidGlass,
    glassMode,
    glassIntensity = 100,
    borderRadius,
    panelMode,
    backgroundRgba,
  } = params;
  const radius = panelMode ? 0 : borderRadius;
  const parts = [`border-radius: ${radius}px`];
  if (liquidGlass) {
    parts.push(...buildLiquidGlassDeclarations(glassMode, glassIntensity));
  } else if (backgroundRgba) {
    parts.push(`background: rgba(${backgroundRgba})`);
  }
  return `${parts.join('; ')};`;
};
