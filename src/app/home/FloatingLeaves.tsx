'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { Leaf, LeafyGreen } from 'lucide-react';

type LeafSpec = {
  Icon: typeof Leaf;
  className: string;
  duration: number;
  delay: number;
  yRange: [number, number];
  rotateRange: [number, number];
};

const LEAVES: LeafSpec[] = [
  { Icon: Leaf,       className: 'top-[8%]  right-[6%]  w-10 h-10 text-[#15803D]/10', duration: 14, delay: 0,   yRange: [0, -18], rotateRange: [-6, 6] },
  { Icon: LeafyGreen, className: 'top-[18%] left-[10%]  w-14 h-14 text-[#4ADE80]/10', duration: 18, delay: 1.2, yRange: [0, 16],  rotateRange: [4, -8] },
  { Icon: Leaf,       className: 'bottom-[12%] right-[16%] w-8 h-8 text-[#15803D]/8', duration: 12, delay: 0.6, yRange: [0, -12], rotateRange: [-10, 4] },
  { Icon: Leaf,       className: 'bottom-[20%] left-[6%]  w-12 h-12 text-[#4ADE80]/8', duration: 16, delay: 2,   yRange: [0, 14],  rotateRange: [6, -6] },
  { Icon: LeafyGreen, className: 'top-[4%]  left-[42%]   w-9 h-9 text-[#15803D]/8',   duration: 20, delay: 0.8, yRange: [0, -10], rotateRange: [-4, 8] },
];

export default function FloatingLeaves() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {LEAVES.map((leaf, i) => {
        const { Icon, className, duration, delay, yRange, rotateRange } = leaf;
        return (
          <motion.div
            key={i}
            className={`absolute ${className}`}
            initial={false}
            animate={
              reduceMotion
                ? { opacity: 0.5 }
                : {
                    y: [yRange[0], yRange[1], yRange[0]],
                    rotate: [rotateRange[0], rotateRange[1], rotateRange[0]],
                    opacity: [0.5, 0.9, 0.5],
                  }
            }
            transition={
              reduceMotion
                ? undefined
                : { duration, delay, repeat: Infinity, repeatType: 'loop', ease: 'easeInOut' }
            }
          >
            <Icon className="w-full h-full" strokeWidth={1.5} />
          </motion.div>
        );
      })}
    </div>
  );
}
