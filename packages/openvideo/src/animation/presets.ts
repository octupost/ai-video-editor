import { AnimationFactory, animationRegistry } from "./registry";
import { KeyframeAnimation } from "./keyframe-animation";
import { GsapAnimation } from "./gsap-animation";

// Animation Presets

function normalizeParams(params: any): any {
  if (params && params.presetParams) {
    return { ...params.presetParams, ...params };
  }
  return params;
}

export const pulse: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const factor = Math.max(opts.duration / 1e6, 1);
  const defaultMirror = normalized?.mirror || 0;
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(
      normalized,
      { ...opts, iterCount: factor * 3, easing },
      "pulse",
    );
  }
  return new KeyframeAnimation(
    {
      "0%": { scale: 1, mirror: defaultMirror },
      "25%": { scale: 0.9, mirror: defaultMirror },
      "50%": { scale: 1, mirror: defaultMirror },
      "75%": { scale: 0.9, mirror: defaultMirror },
      "100%": { scale: 1, mirror: defaultMirror },
    },
    {
      ...opts,
      easing,
      iterCount: factor * 3,
    },
    "pulse",
  );
};

export const fadeIn: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  // If params has keyframes, use them as-is (allows UI persistence)
  const defaultMirror = normalized?.mirror || 0;
  const defaultOpacity = normalized?.opacity || 0;
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "fadeIn");
  }
  return new KeyframeAnimation(
    {
      "0%": { opacity: defaultOpacity, scale: 0.9, mirror: defaultMirror },
      "100%": { opacity: 1, scale: 1, mirror: defaultMirror },
    },
    { ...opts, easing },
    "fadeIn",
  );
};

export const fadeOut: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const defaultMirror = normalized?.mirror || 0;
  const defaultOpacity = normalized?.opacity || 0;
  const easing = normalized?.easing || opts.easing || "easeInQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "fadeOut");
  }
  return new KeyframeAnimation(
    {
      "0%": { opacity: 1, mirror: defaultMirror },
      "100%": { opacity: defaultOpacity, mirror: defaultMirror },
    },
    { ...opts, easing },
    "fadeOut",
  );
};

export const slideIn: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  // If params has keyframes, use them as-is
  const defaultMirror = normalized?.mirror || 0;
  const defaultOpacity = normalized?.opacity || 0;
  const easing = normalized?.easing || opts.easing || "easeOutCubic";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "slideIn");
  }
  const config = normalized || { direction: "left" };
  const dist = config.distance || 300;
  const frames: any = {
    "100%": { x: 0, y: 0, opacity: 1, mirror: defaultMirror },
  };

  if (config.direction === "left")
    frames["0%"] = { x: -dist, opacity: defaultOpacity, mirror: defaultMirror };
  else if (config.direction === "right")
    frames["0%"] = { x: dist, opacity: defaultOpacity, mirror: defaultMirror };
  else if (config.direction === "top")
    frames["0%"] = { y: -dist, opacity: defaultOpacity, mirror: defaultMirror };
  else if (config.direction === "bottom")
    frames["0%"] = { y: dist, opacity: defaultOpacity, mirror: defaultMirror };
  else
    frames["0%"] = { x: -dist, opacity: defaultOpacity, mirror: defaultMirror }; // Default left

  const anim = new KeyframeAnimation(
    frames,
    { ...opts, easing },
    "slideIn",
  );
  (anim as any).presetParams = params;
  return anim;
};

export const slideOut: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  // If params has keyframes, use them as-is
  const defaultMirror = normalized?.mirror || 0;
  const defaultOpacity = normalized?.opacity || 0;
  const easing = normalized?.easing || opts.easing || "easeInCubic";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "slideOut");
  }
  const config = normalized || { direction: "left" };
  const dist = config.distance || 300;
  const frames: any = {
    "0%": { x: 0, y: 0, opacity: 1, mirror: defaultMirror },
  };

  if (config.direction === "left")
    frames["100%"] = {
      x: -dist,
      opacity: defaultOpacity,
      mirror: defaultMirror,
    };
  else if (config.direction === "right")
    frames["100%"] = {
      x: dist,
      opacity: defaultOpacity,
      mirror: defaultMirror,
    };
  else if (config.direction === "top")
    frames["100%"] = {
      y: -dist,
      opacity: defaultOpacity,
      mirror: defaultMirror,
    };
  else if (config.direction === "bottom")
    frames["100%"] = {
      y: dist,
      opacity: defaultOpacity,
      mirror: defaultMirror,
    };
  else
    frames["100%"] = {
      x: -dist,
      opacity: defaultOpacity,
      mirror: defaultMirror,
    }; // Default left

  const anim = new KeyframeAnimation(
    frames,
    { ...opts, easing },
    "slideOut",
  );
  (anim as any).presetParams = params;
  return anim;
};

export const zoomIn: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const defaultMirror = normalized?.mirror || 0;
  const defaultOpacity = normalized?.opacity || 0;
  const defaultScale = normalized?.scale || 0;
  const easing = normalized?.easing || opts.easing || "easeOutBack";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "zoomIn");
  }
  return new KeyframeAnimation(
    {
      "0%": {
        scale: defaultScale,
        opacity: defaultOpacity,
        mirror: defaultMirror,
      },
      "100%": { scale: 1, opacity: 1, mirror: defaultMirror },
    },
    { ...opts, easing },
    "zoomIn",
  );
};

export const zoomOut: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const defaultMirror = normalized?.mirror || 0;
  const defaultOpacity = normalized?.opacity || 0;
  const defaultScale = normalized?.scale || 0;
  const easing = normalized?.easing || opts.easing || "easeInBack";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "zoomOut");
  }
  return new KeyframeAnimation(
    {
      "0%": { scale: 1, opacity: 1, mirror: defaultMirror },
      "100%": {
        scale: defaultScale,
        opacity: defaultOpacity,
        mirror: defaultMirror,
      },
    },
    { ...opts, easing },
    "zoomOut",
  );
};

export const blurIn: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const defaultMirror = normalized?.mirror || 0;
  const defaultOpacity = normalized?.opacity || 0;
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "blurIn");
  }
  return new KeyframeAnimation(
    {
      "0%": { blur: 20, opacity: defaultOpacity, mirror: defaultMirror },
      "100%": { blur: 0, opacity: 1, mirror: defaultMirror },
    },
    { ...opts, easing },
    "blurIn",
  );
};

export const blurOut: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const defaultMirror = normalized?.mirror || 0;
  const defaultOpacity = normalized?.opacity || 0;
  const easing = normalized?.easing || opts.easing || "easeInQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "blurOut");
  }
  return new KeyframeAnimation(
    {
      "0%": { blur: 0, opacity: 1, mirror: defaultMirror },
      "100%": { blur: 20, opacity: defaultOpacity, mirror: defaultMirror },
    },
    { ...opts, easing },
    "blurOut",
  );
};

export const charFadeIn: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  return new GsapAnimation(
    {
      type: "character",
      from: { alpha: 0, scale: 0.5 },
      to: { alpha: 1, scale: 1 },
      stagger: normalized?.stagger ?? 0.05,
    },
    {
      ...opts,
      easing: normalized?.easing || opts.easing || "back.out",
    },
    "charFadeIn",
  );
};

export const charSlideUp: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  return new GsapAnimation(
    {
      type: "character",
      from: { alpha: 0, y: 50 },
      to: { alpha: 1, y: 0 },
      stagger: normalized?.stagger ?? 0.05,
    },
    {
      ...opts,
      easing: normalized?.easing || opts.easing || "power2.out",
    },
    "charSlideUp",
  );
};

export const charTypewriter: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  return new GsapAnimation(
    {
      type: "character",
      from: { alpha: 0 },
      to: { alpha: 1, duration: 0.001 },
      stagger: normalized?.stagger ?? 0.05,
    },
    {
      ...opts,
      easing: normalized?.easing || opts.easing || "none",
    },
    "charTypewriter",
  );
};

//custom presets in
export const blurSlideRightIn: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "blurSlideRightIn");
  }
  return new KeyframeAnimation(
    {
      "0%": { blur: 5, x: 100, mirror: 1 },
      "100%": { blur: 0, x: 0, mirror: 1 },
    },
    {
      ...opts,
      easing,
    },
    "blurSlideRightIn",
  );
};

export const wobbleZoomIn: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "wobbleZoomIn");
  }
  return new KeyframeAnimation(
    {
      "0%": { scale: 1.2, angle: -5, mirror: 1 },
      "32%": { scale: 1, angle: 0, mirror: 1 },
      "64%": { scale: 1.2, angle: -5, mirror: 1 },
      "100%": { scale: 1, angle: 0, mirror: 1 },
    },
    {
      ...opts,
      easing,
    },
    "wobbleZoomIn",
  );
};

export const spinZoomIn: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "spinZoomIn");
  }
  return new KeyframeAnimation(
    {
      "0%": { blur: 5, angle: 45, scale: 2, mirror: 1 },
      "100%": { blur: 0, angle: 0, scale: 1, mirror: 1 },
    },
    {
      ...opts,
      easing,
    },
    "spinZoomIn",
  );
};

export const blurSlideLeftIn: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "blurSlideLeftIn");
  }
  return new KeyframeAnimation(
    {
      "0%": { x: -200, blur: 10, mirror: 1 },
      "100%": { x: 0, blur: 0, mirror: 1 },
    },
    {
      ...opts,
      easing,
    },
    "blurSlideLeftIn",
  );
};

export const blurSlideRightStrongIn: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "blurSlideRightStrongIn");
  }
  return new KeyframeAnimation(
    {
      "0%": { x: 200, blur: 10, mirror: 1 },
      "100%": { x: 0, blur: 0, mirror: 1 },
    },
    {
      ...opts,
      easing,
    },
    "blurSlideRightStrongIn",
  );
};

export const cinematicZoomSlideIn: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "cinematicZoomSlideIn");
  }
  return new KeyframeAnimation(
    {
      "0%": { scale: 0.6, blur: 30, x: 200, mirror: 1 },
      "30%": { scale: 0.8, blur: 20, x: 50, mirror: 1 },
      "60%": { scale: 0.9, blur: 10, x: 0, mirror: 1 },
      "100%": { scale: 1, blur: 0, x: 0, mirror: 1 },
    },
    {
      ...opts,
      easing,
    },
    "cinematicZoomSlideIn",
  );
};

export const elasticTwistIn: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "elasticTwistIn");
  }
  return new KeyframeAnimation(
    {
      "0%": { scale: 1.4, blur: 20, angle: 10, mirror: 1 },
      "40%": { scale: 1, blur: 0, angle: 0, mirror: 1 },
      "60%": { scale: 1.3, blur: 0, angle: -10, mirror: 1 },
      "100%": { scale: 1, blur: 0, angle: 0, mirror: 1 },
    },
    {
      ...opts,
      easing,
    },
    "elasticTwistIn",
  );
};

export const spinFadeIn: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "spinFadeIn");
  }
  return new KeyframeAnimation(
    {
      "0%": { blur: 40, angle: 80, mirror: 1 },
      "100%": { blur: 0, angle: 0, mirror: 1 },
    },
    {
      ...opts,
      easing,
    },
    "spinFadeIn",
  );
};

export const flashZoomIn: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "flashZoomIn");
  }
  return new KeyframeAnimation(
    {
      "0%": { scale: 1, brightness: 3, mirror: 1 },
      "40%": { scale: 1, brightness: 3, mirror: 1 },
      "80%": { scale: 1.5, brightness: 3, mirror: 1 },
      "100%": { scale: 1, brightness: 1, mirror: 1 },
    },
    {
      ...opts,
      easing,
    },
    "flashZoomIn",
  );
};

//custom presets out
export const tiltSlideRightOut: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "tiltSlideRightOut");
  }
  return new KeyframeAnimation(
    {
      "0%": { angle: 0, x: 0, mirror: 1 },
      "70%": { angle: 7, x: 0, mirror: 1 },
      "100%": { angle: 10, x: 200, mirror: 1 },
    },
    {
      ...opts,
      easing,
    },
    "tiltSlideRightOut",
  );
};

export const tiltZoomOut: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "tiltZoomOut");
  }
  return new KeyframeAnimation(
    {
      "0%": { angle: 0, scale: 1, mirror: 1 },
      "100%": { angle: -10, scale: 1.2, mirror: 1 },
    },
    {
      ...opts,
      easing,
    },
    "tiltZoomOut",
  );
};

export const glitchSlideOut: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "glitchSlideOut");
  }
  return new KeyframeAnimation(
    {
      "0%": { x: 0, angle: 0, mirror: 1 },
      "30%": { x: 100, angle: -5, mirror: 1 },
      "70%": { x: 100, angle: -20, mirror: 1 },
      "100%": { x: -100, angle: -20, mirror: 1 },
    },
    {
      ...opts,
      easing,
    },
    "glitchSlideOut",
  );
};

export const dropBlurOut: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "dropBlurOut");
  }
  return new KeyframeAnimation(
    {
      "0%": { y: 0, blur: 0, mirror: 1 },
      "100%": { y: 200, blur: 20, mirror: 1 },
    },
    {
      ...opts,
      easing,
    },
    "dropBlurOut",
  );
};

export const fallZoomOut: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "fallZoomOut");
  }
  return new KeyframeAnimation(
    {
      "0%": { y: 0, scale: 1, mirror: 1 },
      "100%": { y: 250, scale: 1.5, mirror: 1 },
    },
    {
      ...opts,
      easing,
    },
    "fallZoomOut",
  );
};

export const zoomSpinOut: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "zoomSpinOut");
  }
  return new KeyframeAnimation(
    {
      "0%": { scale: 1, angle: 0, mirror: 1 },
      "100%": { scale: 2, angle: 10, mirror: 1 },
    },
    {
      ...opts,
      easing,
    },
    "zoomSpinOut",
  );
};

export const dramaticSpinSlideOut: AnimationFactory = (opts, params) => {
  const normalized = normalizeParams(params);
  const easing = normalized?.easing || opts.easing || "easeOutQuad";
  if (normalized && (normalized["0%"] || normalized["100%"])) {
    return new KeyframeAnimation(normalized, { ...opts, easing }, "dramaticSpinSlideOut");
  }
  return new KeyframeAnimation(
    {
      "0%": { x: 0, angle: 0, blur: 0, mirror: 1 },
      "40%": { x: -200, angle: 10, blur: 5, mirror: 1 },
      "100%": { x: -200, angle: 60, blur: 20, mirror: 1 },
    },
    {
      ...opts,
      easing,
    },
    "dramaticSpinSlideOut",
  );
};

// Register them
animationRegistry.register("fadeIn", fadeIn);
animationRegistry.register("fadeOut", fadeOut);
animationRegistry.register("slideIn", slideIn);
animationRegistry.register("slideOut", slideOut);
animationRegistry.register("zoomIn", zoomIn);
animationRegistry.register("zoomOut", zoomOut);
animationRegistry.register("charTypewriter", charTypewriter);
animationRegistry.register("pulse", pulse);
animationRegistry.register("blurIn", blurIn);
animationRegistry.register("blurOut", blurOut);
//custom presets in
animationRegistry.register("blurSlideRightIn", blurSlideRightIn);
animationRegistry.register("wobbleZoomIn", wobbleZoomIn);
animationRegistry.register("spinZoomIn", spinZoomIn);
animationRegistry.register("blurSlideLeftIn", blurSlideLeftIn);
animationRegistry.register("blurSlideRightStrongIn", blurSlideRightStrongIn);
animationRegistry.register("cinematicZoomSlideIn", cinematicZoomSlideIn);
animationRegistry.register("elasticTwistIn", elasticTwistIn);
animationRegistry.register("spinFadeIn", spinFadeIn);
animationRegistry.register("flashZoomIn", flashZoomIn);
//custom presets out
animationRegistry.register("tiltSlideRightOut", tiltSlideRightOut);
animationRegistry.register("tiltZoomOut", tiltZoomOut);
animationRegistry.register("glitchSlideOut", glitchSlideOut);
animationRegistry.register("dropBlurOut", dropBlurOut);
animationRegistry.register("fallZoomOut", fallZoomOut);
animationRegistry.register("zoomSpinOut", zoomSpinOut);
animationRegistry.register("dramaticSpinSlideOut", dramaticSpinSlideOut);

/**
 * Get the keyframe template for a preset animation
 * Useful for populating the animation editor UI
 */
export function getPresetTemplate(type: string, params?: any): any {
  const normalized = normalizeParams(params);
  const defaultMirror = normalized?.mirror || 0;
  const defaultScale = normalized?.scale || 0;
  const defaultOpacity = normalized?.opacity || 0;
  switch (type) {
    case "fadeIn":
      return {
        "0%": { opacity: defaultOpacity, scale: 0.9, mirror: defaultMirror },
        "100%": { opacity: 1, scale: 1, mirror: defaultMirror },
      };
    case "fadeOut":
      return {
        "0%": { opacity: 1, mirror: defaultMirror },
        "100%": { opacity: defaultOpacity, mirror: defaultMirror },
      };
    case "zoomIn":
      return {
        "0%": {
          scale: defaultScale,
          opacity: defaultOpacity,
          mirror: defaultMirror,
        },
        "100%": { scale: 1, opacity: 1, mirror: defaultMirror },
      };
    case "zoomOut":
      return {
        "0%": { scale: 1, opacity: 1, mirror: defaultMirror },
        "100%": {
          scale: defaultScale,
          opacity: defaultOpacity,
          mirror: defaultMirror,
        },
      };
    case "slideIn": {
      const direction = normalized?.direction || "left";
      const distance = normalized?.distance || 300;
      return {
        "0%": {
          x:
            direction === "left"
              ? -distance
              : direction === "right"
                ? distance
                : 0,
          y:
            direction === "top"
              ? -distance
              : direction === "bottom"
                ? distance
                : 0,
          opacity: defaultOpacity,
          mirror: defaultMirror,
        },
        "100%": { x: 0, y: 0, opacity: 1, mirror: defaultMirror },
      };
    }
    case "slideOut": {
      const direction = normalized?.direction || "left";
      const distance = normalized?.distance || 300;
      return {
        "0%": { x: 0, y: 0, opacity: 1, mirror: defaultMirror },
        "100%": {
          x:
            direction === "left"
              ? -distance
              : direction === "right"
                ? distance
                : 0,
          y:
            direction === "top"
              ? -distance
              : direction === "bottom"
                ? distance
                : 0,
          opacity: defaultOpacity,
          mirror: defaultMirror,
        },
      };
    }
    case "pulse":
      return {
        "0%": { scale: 1, mirror: defaultMirror },
        "25%": { scale: 0.9, mirror: defaultMirror },
        "50%": { scale: 1, mirror: defaultMirror },
        "75%": { scale: 0.9, mirror: defaultMirror },
        "100%": { scale: 1, mirror: defaultMirror },
      };
    case "blurIn":
      return {
        "0%": { blur: 20, opacity: defaultOpacity, mirror: defaultMirror },
        "100%": { blur: 0, opacity: 1, mirror: defaultMirror },
      };
    case "blurOut":
      return {
        "0%": { blur: 0, opacity: 1, mirror: defaultMirror },
        "100%": { blur: 20, opacity: defaultOpacity, mirror: defaultMirror },
      };
    case "blurSlideRightIn":
      return {
        "0%": { blur: 5, x: 100, mirror: defaultMirror },
        "100%": { blur: 0, x: 0, mirror: defaultMirror },
      };
    case "wobbleZoomIn":
      return {
        "0%": { scale: 1.2, angle: -5, mirror: defaultMirror },
        "32%": { scale: 1, angle: 0, mirror: defaultMirror },
        "64%": { scale: 1.2, angle: -5, mirror: defaultMirror },
        "100%": { scale: 1, angle: 0, mirror: defaultMirror },
      };
    case "spinZoomIn":
      return {
        "0%": { blur: 5, angle: 45, scale: 2, mirror: defaultMirror },
        "100%": { blur: 0, angle: 0, scale: 1, mirror: defaultMirror },
      };
    case "blurSlideLeftIn":
      return {
        "0%": { x: -200, blur: 10, mirror: defaultMirror },
        "100%": { x: 0, blur: 0, mirror: defaultMirror },
      };
    case "blurSlideRightStrongIn":
      return {
        "0%": { x: 200, blur: 10, mirror: defaultMirror },
        "100%": { x: 0, blur: 0, mirror: defaultMirror },
      };
    case "cinematicZoomSlideIn":
      return {
        "0%": { scale: 0.6, blur: 30, x: 200, mirror: defaultMirror },
        "30%": { scale: 0.8, blur: 20, x: 50, mirror: defaultMirror },
        "60%": { scale: 0.9, blur: 10, x: 0, mirror: defaultMirror },
        "100%": { scale: 1, blur: 0, x: 0, mirror: defaultMirror },
      };
    case "elasticTwistIn":
      return {
        "0%": { scale: 1.4, blur: 20, angle: 10, mirror: defaultMirror },
        "40%": { scale: 1, blur: 0, angle: 0, mirror: defaultMirror },
        "60%": { scale: 1.3, blur: 0, angle: -10, mirror: defaultMirror },
        "100%": { scale: 1, blur: 0, angle: 0, mirror: defaultMirror },
      };
    case "spinFadeIn":
      return {
        "0%": { blur: 40, angle: 80, mirror: defaultMirror },
        "100%": { blur: 0, angle: 0, mirror: defaultMirror },
      };
    case "flashZoomIn":
      return {
        "0%": { scale: 1, brightness: 3, mirror: defaultMirror },
        "40%": { scale: 1, brightness: 3, mirror: defaultMirror },
        "80%": { scale: 1.5, brightness: 3, mirror: defaultMirror },
        "100%": { scale: 1, brightness: 1, mirror: defaultMirror },
      };
    case "tiltSlideRightOut":
      return {
        "0%": { angle: 0, x: 0, mirror: defaultMirror },
        "70%": { angle: 7, x: 0, mirror: defaultMirror },
        "100%": { angle: 10, x: 200, mirror: defaultMirror },
      };
    case "tiltZoomOut":
      return {
        "0%": { angle: 0, scale: 1, mirror: defaultMirror },
        "100%": { angle: -10, scale: 1.2, mirror: defaultMirror },
      };
    case "glitchSlideOut":
      return {
        "0%": { x: 0, angle: 0, mirror: defaultMirror },
        "30%": { x: 100, angle: -5, mirror: defaultMirror },
        "70%": { x: 100, angle: -20, mirror: defaultMirror },
        "100%": { x: -100, angle: -20, mirror: defaultMirror },
      };
    case "dropBlurOut":
      return {
        "0%": { y: 0, blur: 0, mirror: defaultMirror },
        "100%": { y: 200, blur: 20, mirror: defaultMirror },
      };
    case "fallZoomOut":
      return {
        "0%": { y: 0, scale: 1, mirror: defaultMirror },
        "100%": { y: 250, scale: 1.5, mirror: defaultMirror },
      };
    case "zoomSpinOut":
      return {
        "0%": { scale: 1, angle: 0, mirror: defaultMirror },
        "100%": { scale: 2, angle: 10, mirror: defaultMirror },
      };
    case "dramaticSpinSlideOut":
      return {
        "0%": { x: 0, angle: 0, blur: 0, mirror: defaultMirror },
        "40%": { x: -200, angle: 10, blur: 5, mirror: defaultMirror },
        "100%": { x: -200, angle: 60, blur: 20, mirror: defaultMirror },
      };
    case "custom":
    default:
      return {
        "0%": {},
        "100%": {},
      };
  }
}
