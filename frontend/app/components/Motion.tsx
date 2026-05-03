"use client";

import { motion, useScroll, useTransform, useMotionValue, useSpring, type Variants, type HTMLMotionProps } from "framer-motion";
import { useRef, type ReactNode } from "react";
import Image from "next/image";

const ease = [0.16, 1, 0.3, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.9, ease } },
};

export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.9, ease } },
};

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: "fadeUp" | "fadeIn" | "scale";
  once?: boolean;
  amount?: number;
};

export function Reveal({
  children,
  className,
  delay = 0,
  variant = "fadeUp",
  once = true,
  amount = 0.2,
}: RevealProps) {
  const variants =
    variant === "fadeIn" ? fadeIn : variant === "scale" ? scaleIn : fadeUp;

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={variants}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

type StaggerGroupProps = {
  children: ReactNode;
  className?: string;
  amount?: number;
} & Pick<HTMLMotionProps<"div">, "onAnimationComplete">;

export function StaggerGroup({ children, className, amount = 0.2 }: StaggerGroupProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={stagger}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  );
}

type KenBurnsImageProps = {
  src: string;
  alt: string;
  priority?: boolean;
  quality?: number;
  className?: string;
  /** Slow zoom direction. "in" zooms in, "out" zooms out. */
  direction?: "in" | "out";
  /** Animation duration in seconds */
  duration?: number;
  sizes?: string;
};

export function KenBurnsImage({
  src,
  alt,
  priority = false,
  quality = 85,
  className = "",
  direction = "in",
  duration = 18,
  sizes = "100vw",
}: KenBurnsImageProps) {
  const fromScale = direction === "in" ? 1 : 1.12;
  const toScale = direction === "in" ? 1.12 : 1;

  return (
    <motion.div
      className={`absolute inset-0 ${className}`}
      initial={{ scale: fromScale }}
      animate={{ scale: toScale }}
      transition={{ duration, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        quality={quality}
        sizes={sizes}
        className="object-cover"
      />
    </motion.div>
  );
}

type ParallaxImageProps = {
  src: string;
  alt: string;
  className?: string;
  quality?: number;
  /** Strength of parallax. 0 = none, 1 = strong */
  strength?: number;
  sizes?: string;
};

export function ParallaxImage({
  src,
  alt,
  className = "",
  quality = 85,
  strength = 0.3,
  sizes = "100vw",
}: ParallaxImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [`-${strength * 50}%`, `${strength * 50}%`]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <motion.div className="absolute inset-0 -top-[15%] -bottom-[15%]" style={{ y }}>
        <Image src={src} alt={alt} fill quality={quality} sizes={sizes} className="object-cover" />
      </motion.div>
    </div>
  );
}

/**
 * Top-of-page scroll progress bar. Drop into the layout once.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 30, restDelta: 0.001 });
  return (
    <motion.div
      style={{ scaleX, transformOrigin: "0%" }}
      className="fixed top-0 left-0 right-0 h-[2px] bg-[#c9a96e] z-[60] origin-left"
    />
  );
}

/**
 * Animated divider with shimmering accents — used between sections.
 */
export function GoldDivider({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        whileInView={{ scaleX: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease }}
        className="h-px flex-1 bg-gradient-to-r from-transparent to-[#c9a96e]/40 origin-right"
      />
      {label && (
        <motion.span
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.2, ease }}
          className="text-[#c9a96e] text-xs tracking-[0.3em] uppercase font-light"
        >
          {label}
        </motion.span>
      )}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        whileInView={{ scaleX: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease }}
        className="h-px flex-1 bg-gradient-to-l from-transparent to-[#c9a96e]/40 origin-left"
      />
    </div>
  );
}

/**
 * Magnetic button — slight pull toward cursor on hover.
 */
export function MagneticHover({ children, className }: { children: ReactNode; className?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 15 });
  const springY = useSpring(y, { stiffness: 200, damping: 15 });

  return (
    <motion.div
      className={className}
      style={{ x: springX, y: springY }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        x.set((e.clientX - cx) * 0.25);
        y.set((e.clientY - cy) * 0.25);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
