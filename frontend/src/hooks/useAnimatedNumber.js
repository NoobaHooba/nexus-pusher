import { useEffect, useRef, useState } from 'react';

/**
 * Returns a smoothly animated value that chases `target` with a spring.
 * @param {number} target   - The real value to animate toward.
 * @param {object} opts
 * @param {number} opts.stiffness - Spring stiffness (default 120)
 * @param {number} opts.damping   - Spring damping   (default 20)
 * @param {number} opts.precision - Stop animating when delta < this (default 0.5)
 */
export function useAnimatedNumber(target, { stiffness = 120, damping = 20, precision = 0.5 } = {}) {
  const [display, setDisplay] = useState(target);
  const state = useRef({ pos: target, vel: 0 });
  const raf   = useRef(null);
  const last  = useRef(null);

  useEffect(() => {
    const spring = (ts) => {
      if (last.current === null) last.current = ts;
      const dt = Math.min((ts - last.current) / 1000, 0.064); // cap at 64 ms
      last.current = ts;

      const { pos, vel } = state.current;
      const force = -stiffness * (pos - target) - damping * vel;
      const newVel = vel + force * dt;
      const newPos = pos + newVel * dt;

      if (Math.abs(newPos - target) < precision && Math.abs(newVel) < precision) {
        state.current = { pos: target, vel: 0 };
        setDisplay(target);
        last.current = null;
        return; // done — no next frame scheduled
      }

      state.current = { pos: newPos, vel: newVel };
      setDisplay(newPos);
      raf.current = requestAnimationFrame(spring);
    };

    if (raf.current) cancelAnimationFrame(raf.current);
    last.current = null;
    raf.current = requestAnimationFrame(spring);

    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, stiffness, damping, precision]);

  return display;
}
