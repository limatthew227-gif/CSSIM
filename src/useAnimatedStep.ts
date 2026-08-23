import { useLayoutEffect, useRef, useState } from "react";

/**
 * Animate an absolute event step without assuming the previous tween finished. If a new event
 * arrives early, motion continues from the exact in-flight fraction instead of snapping to the
 * previous integer. Unrelated parent renders cannot cancel the active animation.
 */
export function useAnimatedStep(
  roundKey: string | number,
  currentStep: number,
  timingKey: string | number,
  durationForFullStep: () => number,
  enabled = true,
) {
  const [animatedStep, setAnimatedStep] = useState(currentStep);
  const animatedStepRef = useRef(currentStep);
  const roundKeyRef = useRef(roundKey);
  const durationRef = useRef(durationForFullStep);
  durationRef.current = durationForFullStep;

  useLayoutEffect(() => {
    const roundChanged = roundKeyRef.current !== roundKey;
    const movedBackwards = currentStep < animatedStepRef.current - 1e-6;
    const skippedSeveralEvents = currentStep - animatedStepRef.current > 1.001;
    roundKeyRef.current = roundKey;

    if (!enabled || roundChanged || movedBackwards || skippedSeveralEvents) {
      animatedStepRef.current = currentStep;
      setAnimatedStep(currentStep);
      return;
    }

    const startStep = animatedStepRef.current;
    const remainingSteps = currentStep - startStep;
    if (remainingSteps <= 1e-6) return;

    const startedAt = performance.now();
    const duration = Math.max(60, durationRef.current() * remainingSteps);
    let animationId = 0;
    const tick = (now: number) => {
      const fraction = Math.min(1, (now - startedAt) / duration);
      const nextStep = startStep + remainingSteps * fraction;
      animatedStepRef.current = nextStep;
      setAnimatedStep(nextStep);
      if (fraction < 1) animationId = requestAnimationFrame(tick);
    };
    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, [currentStep, enabled, roundKey, timingKey]);

  return enabled ? animatedStep : currentStep;
}
