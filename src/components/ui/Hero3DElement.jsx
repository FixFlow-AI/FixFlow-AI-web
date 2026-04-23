import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, MeshDistortMaterial, Sphere, Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

function Scene() {
  const pointsRef = useRef()
  const sphereRef = useRef()

  // Generate random points for the background
  const particlesCount = 2000
  const positions = useMemo(() => {
    const pos = new Float32Array(particlesCount * 3)
    for (let i = 0; i < particlesCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 15
      pos[i * 3 + 1] = (Math.random() - 0.5) * 15
      pos[i * 3 + 2] = (Math.random() - 0.5) * 15
    }
    return pos
  }, [])

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (pointsRef.current) {
      pointsRef.current.rotation.y = t * 0.05
      pointsRef.current.rotation.x = t * 0.02
    }
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -10]} color="#4f46e5" intensity={2} />
      
      <Float speed={1.5} rotationIntensity={0.5} floatIntensity={1}>
        <Sphere ref={sphereRef} args={[1, 100, 100]} scale={1.5}>
          <MeshDistortMaterial
            color="#4f46e5"
            speed={2}
            distort={0.4}
            radius={1}
            roughness={0.1}
            metalness={0.8}
            transparent
            opacity={0.3}
          />
        </Sphere>
      </Float>

      <Points ref={pointsRef} positions={positions} stride={3}>
        <PointMaterial
          transparent
          color="#6366f1"
          size={0.015}
          sizeAttenuation={true}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Points>
    </>
  )
}

export default function Hero3DElement() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] opacity-40">
      <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
        <Scene />
      </Canvas>
    </div>
  )
}
