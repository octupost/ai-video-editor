import gsap from "gsap";
import { AnimationOptions, AnimationTransform, IAnimation } from "./types";

export interface GsapAnimationParams {
  /**
   * Animation presets or custom GSAP vars
   */
  type: "character" | "word" | "line";
  from: gsap.TweenVars;
  to: gsap.TweenVars;
  stagger?: number | gsap.StaggerVars;
}

export class GsapAnimation implements IAnimation {
  readonly id: string;
  readonly type: string;
  readonly options: Required<AnimationOptions>;
  readonly params: GsapAnimationParams;

  private timeline: gsap.core.Timeline | null = null;
  private lastTarget: any = null;

  constructor(
    params: GsapAnimationParams,
    opts: AnimationOptions,
    type: string = "gsap",
  ) {
    this.id = opts.id || `gsap_${Math.random().toString(36).substr(2, 9)}`;
    this.type = type;
    this.params = params;
    this.options = {
      duration: opts.duration,
      delay: opts.delay ?? 0,
      easing: opts.easing ?? "none",
      iterCount: opts.iterCount ?? 1,
      id: this.id,
    };
  }

  getTransform(_time: number): AnimationTransform {
    // GSAP animations usually handle properties directly on children,
    // so the base transform is empty.
    return {};
  }

  apply(target: any, time: number): void {
    const { duration, delay } = this.options;
    const offsetTime = time - delay;

    // Initialize timeline if target changed or not created
    if (this.lastTarget !== target || !this.timeline) {
      this.initTimeline(target);
      this.lastTarget = target;
    }

    if (!this.timeline) return;

    if (offsetTime < 0) {
      this.timeline.pause(0);
      return;
    }

    // Convert microseconds to seconds
    const timeInSeconds = offsetTime / 1e6;
    const durationInSeconds = duration / 1e6;

    // Handle iteration and clamping
    let progress = timeInSeconds / durationInSeconds;
    if (this.options.iterCount !== Infinity) {
      progress = Math.min(progress, this.options.iterCount);
    }

    // GSAP timeline.seek(seconds)
    this.timeline.pause(timeInSeconds);
  }

  private initTimeline(target: any): void {
    if (this.timeline) {
      this.timeline.kill();
    }

    const { from, to, stagger, type } = this.params;
    const durationInSeconds = this.options.duration / 1e6;

    this.timeline = gsap.timeline({ paused: true });

    // Identify animation targets based on type
    let animTargets: any[] = [];

    // PixiJS SplitBitmapText structure:
    // Container -> Words -> Characters
    // We need to flatten or pick based on type
    if (target && target.children) {
      if (type === "character") {
        // Find all characters (recursive or specific depth)
        const findCharacters = (node: any): any[] => {
          if (!node.children || node.children.length === 0) return [node];
          let results: any[] = [];
          for (const child of node.children) {
            results = results.concat(findCharacters(child));
          }
          return results;
        };
        animTargets = findCharacters(target);
      } else if (type === "word") {
        // Words are usually direct children of the text container if using word-level splitting
        animTargets = target.children;
      } else {
        animTargets = [target];
      }
    } else {
      animTargets = [target];
    }

    this.timeline.fromTo(animTargets, from, {
      duration: durationInSeconds,
      stagger: stagger || 0,
      ease: this.options.easing as any,
      ...to,
    });
  }

  destroy() {
    if (this.timeline) {
      this.timeline.kill();
      this.timeline = null;
    }
  }
}
