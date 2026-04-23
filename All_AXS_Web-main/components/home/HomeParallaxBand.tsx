"use client";

import Image from "next/image";
import { useRef, type ReactNode } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { shouldUnoptimizeEventImage } from "@/lib/utils/image";

export function HomeParallaxBand({
  imageSrc,
  alt,
  children,
  className = "",
  imageClassName = "",
  focal = "left",
}: {
  imageSrc: string;
  alt: string;
  children?: ReactNode;
  className?: string;
  imageClassName?: string;
  /** Scrim gradient favors this side for text contrast. */
  focal?: "left" | "right";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const parallaxPx = reduce ? 0 : 56;
  const y = useTransform(scrollYProgress, [0, 1], [parallaxPx, -parallaxPx]);

  return (
    <section
      ref={ref}
      className={[
        "relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden",
        className,
      ].join(" ")}
    >
      <div className="relative aspect-[21/9] min-h-[220px] max-h-[min(52vh,480px)] w-full sm:aspect-[24/9] md:min-h-[280px]">
        <motion.div className="absolute inset-0 h-[120%] w-full -top-[10%]" style={{ y }}>
          <Image
            src={imageSrc}
            alt={alt}
            fill
            unoptimized={shouldUnoptimizeEventImage(imageSrc)}
            className={["object-cover object-center", imageClassName].filter(Boolean).join(" ")}
            sizes="100vw"
            priority={false}
          />
        </motion.div>
        <div
          className={
            focal === "right"
              ? "absolute inset-0 bg-linear-to-l from-background/92 via-background/55 to-transparent sm:via-background/40"
              : "absolute inset-0 bg-linear-to-r from-background/92 via-background/55 to-transparent sm:via-background/40"
          }
          aria-hidden
        />
        {children ? (
          <div className="relative z-10 flex h-full min-h-[inherit] items-center">
            <div className="axs-page-shell w-full py-12 md:py-16">{children}</div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
