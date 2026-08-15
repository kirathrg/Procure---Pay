import { useEffect, useRef, useState } from "react";
import { motion, useAnimation } from "framer-motion";

const CORRUGATION =
  "repeating-linear-gradient(0deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0.05) 1px, transparent 1px, transparent 4px)";

const KRAFT = "#b98a5e";
const KRAFT_SHADE = "#a97a4f";
const KRAFT_DARK = "#8f6640";
const TAPE = "#d8cba8";

export function PackageBox({ scanning }: { scanning: boolean }) {
  const w = 84; // width/depth (square footprint)
  const h = 84; // height

  const controls = useAnimation();
  const [dragging, setDragging] = useState(false);
  const rotation = useRef({ y: -16, x: -24 });
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const faceBase: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundImage: CORRUGATION,
    backgroundBlendMode: "multiply",
  };

  function idleSpin() {
    const { x, y } = rotation.current;
    controls.start({
      rotateY: [y - 16, y + 16, y - 16],
      rotateX: x,
      transition: {
        rotateY: { duration: scanning ? 2.4 : 8, repeat: Infinity, ease: "easeInOut" },
        rotateX: { duration: 0.3 },
      },
    });
  }

  useEffect(() => {
    if (!dragging) idleSpin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, dragging]);

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(true);
    controls.stop();
    lastPoint.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging || !lastPoint.current) return;
    const dx = e.clientX - lastPoint.current.x;
    const dy = e.clientY - lastPoint.current.y;
    lastPoint.current = { x: e.clientX, y: e.clientY };

    rotation.current.y += dx * 0.5;
    rotation.current.x = Math.max(-70, Math.min(70, rotation.current.x - dy * 0.5));

    controls.set({ rotateY: rotation.current.y, rotateX: rotation.current.x });
  }

  function handlePointerUp() {
    setDragging(false);
    lastPoint.current = null;
  }

  return (
    <div style={{ perspective: 700 }} className="flex h-[160px] w-[160px] items-center justify-center">
      <motion.div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        animate={controls}
        initial={{ rotateY: rotation.current.y, rotateX: rotation.current.x }}
        style={{
          transformStyle: "preserve-3d",
          width: w,
          height: h,
          position: "relative",
          cursor: dragging ? "grabbing" : "grab",
          touchAction: "none",
        }}
      >
        {/* Front */}
        <div
          style={{
            ...faceBase,
            width: w,
            height: h,
            transform: `translateZ(${w / 2}px)`,
            backgroundColor: KRAFT,
            border: "1px solid rgba(0,0,0,0.3)",
          }}
        >
          {/* center seam tape */}
          <div
            className="absolute inset-y-0 left-1/2 w-4 -translate-x-1/2"
            style={{ background: TAPE, boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}
          />
          {/* shipping label */}
          <div className="absolute bottom-2 left-1/2 h-6 w-11 -translate-x-1/2 rounded-[1px] bg-[#f4efe1] shadow-sm">
            <div className="absolute left-1 right-1 top-1 h-[2px] bg-[#c2c2c2]" />
            <div className="absolute left-1 right-2 top-2.5 h-[2px] bg-[#c2c2c2]" />
            <div className="absolute left-1 right-3 top-4 h-[2px] bg-[#c2c2c2]" />
          </div>
        </div>

        {/* Back */}
        <div
          style={{
            ...faceBase,
            width: w,
            height: h,
            transform: `translateZ(-${w / 2}px) rotateY(180deg)`,
            backgroundColor: KRAFT_SHADE,
            border: "1px solid rgba(0,0,0,0.3)",
          }}
        />

        {/* Right */}
        <div
          style={{
            ...faceBase,
            width: w,
            height: h,
            transform: `rotateY(90deg) translateZ(${w / 2}px)`,
            backgroundColor: KRAFT_SHADE,
            border: "1px solid rgba(0,0,0,0.3)",
          }}
        >
          <div
            className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2"
            style={{ background: TAPE, opacity: 0.85 }}
          />
        </div>

        {/* Left */}
        <div
          style={{
            ...faceBase,
            width: w,
            height: h,
            transform: `rotateY(-90deg) translateZ(${w / 2}px)`,
            backgroundColor: KRAFT_DARK,
            border: "1px solid rgba(0,0,0,0.3)",
          }}
        />

        {/* Top */}
        <div
          style={{
            width: w,
            height: w,
            position: "absolute",
            top: 0,
            left: 0,
            transform: `rotateX(90deg) translateZ(${h / 2}px)`,
            backgroundColor: KRAFT,
            border: "1px solid rgba(0,0,0,0.3)",
            backgroundImage: `
              linear-gradient(45deg, transparent 47%, rgba(0,0,0,0.18) 47%, rgba(0,0,0,0.18) 53%, transparent 53%),
              linear-gradient(-45deg, transparent 47%, rgba(0,0,0,0.18) 47%, rgba(0,0,0,0.18) 53%, transparent 53%),
              ${CORRUGATION}
            `,
          }}
        >
          {/* tape strip sealing the top flaps */}
          <div
            className="absolute inset-y-0 left-1/2 w-4 -translate-x-1/2"
            style={{ background: TAPE, opacity: 0.9, boxShadow: "0 0 0 1px rgba(0,0,0,0.1)" }}
          />
        </div>

        {/* Bottom */}
        <div
          style={{
            ...faceBase,
            width: w,
            height: w,
            transform: `rotateX(-90deg) translateZ(${h / 2}px)`,
            backgroundColor: KRAFT_DARK,
            border: "1px solid rgba(0,0,0,0.3)",
          }}
        />
      </motion.div>
    </div>
  );
}
