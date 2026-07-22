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

const FULL_LEAVES: LeafSpec[] = [
  { Icon: Leaf,       className: 'top-[8%]  right-[6%]  w-10 h-10 text-[#15803D]/20', duration: 14, delay: 0,    yRange: [0, -18], rotateRange: [-6, 6] },
  { Icon: LeafyGreen, className: 'top-[18%] left-[10%]  w-14 h-14 text-[#4ADE80]/18', duration: 18, delay: 1.2,  yRange: [0, 16],  rotateRange: [4, -8] },
  { Icon: Leaf,       className: 'bottom-[12%] right-[16%] w-8 h-8 text-[#15803D]/16', duration: 12, delay: 0.6,  yRange: [0, -12], rotateRange: [-10, 4] },
  { Icon: Leaf,       className: 'bottom-[20%] left-[6%]  w-12 h-12 text-[#4ADE80]/16', duration: 16, delay: 2,    yRange: [0, 14],  rotateRange: [6, -6] },
  { Icon: LeafyGreen, className: 'top-[4%]  left-[42%]   w-9 h-9 text-[#15803D]/16',   duration: 20, delay: 0.8,  yRange: [0, -10], rotateRange: [-4, 8] },
  { Icon: Leaf,       className: 'top-[30%] right-[32%]  w-7 h-7 text-[#4ADE80]/14',   duration: 15, delay: 1.6,  yRange: [0, -14], rotateRange: [-8, 5] },
  { Icon: LeafyGreen, className: 'bottom-[6%]  left-[28%] w-11 h-11 text-[#15803D]/14', duration: 22, delay: 0.4,  yRange: [0, 12],  rotateRange: [5, -5] },
  { Icon: Leaf,       className: 'top-[44%] left-[4%]    w-8 h-8 text-[#4ADE80]/22',   duration: 13, delay: 2.4,  yRange: [0, -16], rotateRange: [-6, 9] },
  { Icon: Leaf,       className: 'bottom-[32%] right-[4%] w-9 h-9 text-[#15803D]/20',  duration: 17, delay: 1,    yRange: [0, 10],  rotateRange: [4, -7] },
];

const LIGHT_LEAVES: LeafSpec[] = [
  { Icon: Leaf,       className: 'top-[10%] right-[8%]  w-8 h-8 text-[#15803D]/10',  duration: 16, delay: 0,   yRange: [0, -14], rotateRange: [-6, 6] },
  { Icon: LeafyGreen, className: 'bottom-[14%] left-[8%] w-10 h-10 text-[#4ADE80]/10', duration: 20, delay: 1,   yRange: [0, 12],  rotateRange: [5, -5] },
  { Icon: Leaf,       className: 'top-[40%] right-[38%] w-7 h-7 text-[#15803D]/8',   duration: 18, delay: 1.8, yRange: [0, -10], rotateRange: [-4, 7] },
];

export default function FloatingLeaves({ density = 'full' }: { density?: 'full' | 'light' }) {
  const reduceMotion = useReducedMotion();
  const leaves = density === 'full' ? FULL_LEAVES : LIGHT_LEAVES;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {leaves.map((leaf, i) => {
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
