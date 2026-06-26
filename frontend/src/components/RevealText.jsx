import { Children, isValidElement } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Animates text word-by-word on scroll.
 * Accepts plain string children OR mixed children (strings + elements).
 * Non-string children (e.g. <span>) are rendered as-is without splitting.
 */
export function RevealText({ children, as = "h2", className, style }) {
  const reducedMotion = useReducedMotion();
  const Tag = motion[as] || motion.h2;

  /* Flatten children into a list of { type: 'word'|'element', content } */
  const parts = [];
  Children.forEach(children, (child) => {
    if (typeof child === "string") {
      child.split(" ").forEach((word, i, arr) => {
        if (word) parts.push({ type: "word", content: word });
        if (i < arr.length - 1) parts.push({ type: "space" });
      });
    } else if (isValidElement(child)) {
      parts.push({ type: "element", content: child });
    }
  });

  return (
    <Tag
      className={className}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.45 }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.035 } },
      }}
    >
      {parts.map((part, index) => {
        if (part.type === "space") return "\u00a0";
        return (
          <motion.span
            className="reveal-word"
            key={index}
            variants={{
              hidden: { opacity: 0, y: reducedMotion ? 0 : 18 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { duration: reducedMotion ? 0 : 0.5 },
              },
            }}
          >
            {part.content}
          </motion.span>
        );
      })}
    </Tag>
  );
}
