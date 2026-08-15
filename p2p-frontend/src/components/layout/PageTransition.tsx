import { motion } from "framer-motion";

/**
 * Wraps each route so navigation reads as a deliberate transition rather than
 * a hard cut. Kept short and ease-out — chrome motion should feel instant,
 * not animated-for-its-own-sake.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
