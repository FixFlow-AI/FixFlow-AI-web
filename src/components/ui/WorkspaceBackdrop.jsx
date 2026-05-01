import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Icosahedron, MeshDistortMaterial, Sphere } from '@react-three/drei'
import useTheme3DPalette from '@/hooks/useTheme3DPalette'

const PARTICLE_POSITIONS = Array.from({ length: 22 }, (_, index) => {
  const angle = index * 2.399963
  const radius = 3.8 + (index % 5) * 0.7
  return [
    Math.cos(angle) * radius,
    Math.sin(angle * 0.82) * 3.2,
    -6 - (index % 4) * 1.1,
  ]
})

function AnimatedShapes({ palette, reduced = false }) {
  const icoRef = useRef(null)
  const sphereRef = useRef(null)
  const focusRef = useRef(null)

  useFrame((state) => {
    if (reduced) {
      return
    }

    const t = state.clock.getElapsedTime()
    if (icoRef.current) {
      icoRef.current.rotation.x = t * 0.1
      icoRef.current.rotation.y = t * 0.15
      icoRef.current.position.y = Math.sin(t * 0.5) * 0.2
    }
    if (sphereRef.current) {
      sphereRef.current.rotation.x = t * 0.2
      sphereRef.current.rotation.y = t * 0.1
      sphereRef.current.position.y = Math.cos(t * 0.4) * 0.3
    }
    if (focusRef.current) {
      focusRef.current.rotation.x = 0.35 + t * 0.08
      focusRef.current.rotation.y = -0.2 + t * 0.18
    }
  })

  return (
    <>
      <ambientLight intensity={0.62} />
      <directionalLight position={[10, 10, 5]} intensity={1.15} color={palette.primary} />
      <directionalLight position={[-10, -10, -5]} intensity={0.7} color={palette.secondary} />

      <Icosahedron ref={icoRef} args={[1.5, 0]} position={[4, 1, -5]}>
        <meshStandardMaterial
          color={palette.primary}
          wireframe
          transparent
          opacity={palette.coreOpacity}
        />
      </Icosahedron>

      <Sphere ref={sphereRef} args={[1.2, 32, 32]} position={[-4, -2, -6]}>
        <MeshDistortMaterial
          color={palette.secondary}
          attach="material"
          distort={reduced ? 0.12 : 0.34}
          speed={reduced ? 0 : 1.2}
          transparent
          opacity={palette.secondaryOpacity}
          wireframe
        />
      </Sphere>

      <mesh ref={focusRef} position={[1.65, -0.75, -4.35]} rotation={[0.35, -0.2, 0.1]}>
        <torusKnotGeometry args={[0.92, 0.13, 96, 8]} />
        <meshBasicMaterial
          color={palette.wire}
          wireframe
          transparent
          opacity={palette.focusOpacity}
          depthWrite={false}
        />
      </mesh>

      <group position={[0, 0, -8]}>
        {PARTICLE_POSITIONS.map((position, index) => (
          <Sphere key={index} args={[0.05, 10, 8]} position={position}>
            <meshBasicMaterial color={palette.particle} transparent opacity={palette.particleOpacity} />
          </Sphere>
        ))}
      </group>
    </>
  )
}

export default function WorkspaceBackdrop() {
  const palette = useTheme3DPalette()
  const [webglEnabled, setWebglEnabled] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const overlayClass = useMemo(
    () => `absolute inset-0 bg-gradient-to-br ${palette.overlayFrom} ${palette.overlayVia} ${palette.overlayTo} z-10`,
    [palette.overlayFrom, palette.overlayTo, palette.overlayVia]
  )

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const widthQuery = window.matchMedia('(min-width: 768px)')
    const update = () => {
      setWebglEnabled(widthQuery.matches)
      setReducedMotion(motionQuery.matches)
    }

    update()
    motionQuery.addEventListener('change', update)
    widthQuery.addEventListener('change', update)

    return () => {
      motionQuery.removeEventListener('change', update)
      widthQuery.removeEventListener('change', update)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-hidden"
      data-testid="workspace-backdrop"
      style={{ '--backdrop-primary': palette.primary, '--backdrop-wire': palette.wire }}
    >
      {webglEnabled ? (
        <div className="absolute inset-0 z-0 pointer-events-none" style={{ opacity: palette.canvasOpacity }}>
          <Canvas
            camera={{ position: [0, 0, 5], fov: 45 }}
            dpr={[1, 1.35]}
            style={{ pointerEvents: 'none' }}
            gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
          >
            <AnimatedShapes palette={palette} reduced={reducedMotion} />
          </Canvas>
        </div>
      ) : (
        <div
          className="absolute inset-0 z-0 opacity-60"
          style={{
            background: `radial-gradient(circle at 24% 30%, ${palette.primary}33, transparent 30%), radial-gradient(circle at 78% 18%, ${palette.secondary}2b, transparent 28%)`,
          }}
        />
      )}

      <div className="absolute inset-0 workspace-grid opacity-45 z-10" />
      <div className="absolute -top-40 left-[-10%] h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-[120px] z-10" />
      <div className="absolute top-24 right-[-6%] h-[22rem] w-[22rem] rounded-full bg-accent/10 blur-[120px] z-10" />
      <div className="absolute bottom-[-8rem] left-1/3 h-[18rem] w-[18rem] rounded-full bg-emerald-400/10 blur-[120px] z-10" />
      <div className={overlayClass} />
    </div>
  )
}
