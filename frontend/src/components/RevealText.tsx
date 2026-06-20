import { motion, useReducedMotion } from 'framer-motion'

interface RevealTextProps {
  children: string
  as?: 'h1' | 'h2' | 'p'
  className?: string
}

export function RevealText({ children, as = 'h2', className }: RevealTextProps) {
  const reducedMotion = useReducedMotion()
  const Tag = motion[as]
  const words = children.split(' ')

  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.45 }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: reducedMotion ? 0 : 0.035 } },
      }}
    >
      {words.map((word, index) => (
        <motion.span
          className="reveal-word"
          key={`${word}-${index}`}
          variants={{
            hidden: { opacity: 0, y: reducedMotion ? 0 : 18 },
            visible: { opacity: 1, y: 0, transition: { duration: reducedMotion ? 0 : 0.5 } },
          }}
        >
          {word}
          {index < words.length - 1 ? '\u00a0' : ''}
        </motion.span>
      ))}
    </Tag>
  )
}
