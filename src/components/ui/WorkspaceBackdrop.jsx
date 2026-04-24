import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Icosahedron, Sphere, MeshDistortMaterial } from '@react-three/drei'

function AnimatedShapes() {
  const icoRef = useRef(null)
  const sphereRef = useRef(null)

  useFrame((state) => {
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
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} color="#8b5cf6" />
      <directionalLight position={[-10, -10, -5]} intensity={0.5} color="#6366f1" />

      {/* Primary animated shape */}
      <Icosahedron ref={icoRef} args={[1.5, 0]} position={[4, 1, -5]}>
        <meshStandardMaterial
          color="#8b5cf6"
          wireframe
          transparent
          opacity={0.15}
        />
      </Icosahedron>

      {/* Distorted sphere for organic feel */}
      <Sphere ref={sphereRef} args={[1.2, 64, 64]} position={[-4, -2, -6]}>
        <MeshDistortMaterial
          color="#6366f1"
          attach="material"
          distort={0.4}
          speed={1.5}
          transparent
          opacity={0.1}
          wireframe
        />
      </Sphere>
      
      {/* Background particles/nodes */}
      <group position={[0, 0, -8]}>
        {Array.from({ length: 20 }).map((_, i) => (
          <Sphere 
            key={i} 
            args={[0.05, 16, 16]} 
            position={[
              (Math.random() - 0.5) * 20, 
              (Math.random() - 0.5) * 20, 
              (Math.random() - 0.5) * 10
            ]}
          >
            <meshBasicMaterial color="#a78bfa" transparent opacity={0.3} />
          </Sphere>
        ))}
      </group>
    </>
  )
}

export default function WorkspaceBackdrop() {
  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* 3D Background layer */}
      <div className="absolute inset-0 z-0 opacity-60 pointer-events-none">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          style={{ pointerEvents: 'none' }}
          gl={{ antialias: true }}
        >
          <AnimatedShapes />
        </Canvas>
      </div>

      {/* Existing Gradients over the 3D shapes for blending */}
      <div className="absolute inset-0 workspace-grid opacity-40 z-10" />
      <div className="absolute -top-40 left-[-10%] h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-[120px] z-10" />
      <div className="absolute top-24 right-[-6%] h-[22rem] w-[22rem] rounded-full bg-accent/10 blur-[120px] z-10" />
      <div className="absolute bottom-[-8rem] left-1/3 h-[18rem] w-[18rem] rounded-full bg-emerald-400/10 blur-[120px] z-10" />
      
      {/* Fallback gradient / overlay to ensure text readability */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/40 to-background/90 z-10" />
    </div>
  )
}
