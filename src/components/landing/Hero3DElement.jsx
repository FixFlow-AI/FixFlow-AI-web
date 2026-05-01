import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import useTheme3DPalette from '@/hooks/useTheme3DPalette'

const WORKFLOW_NODES = [
  { id: 'github', label: 'GitHub Scan', metric: 'signals', colorKey: 'primary', position: [-2.6, 0.9, 0.2] },
  { id: 'niche', label: 'Niche Intel', metric: 'fit 91', colorKey: 'secondary', position: [-1.35, 1.55, -0.15] },
  { id: 'lead', label: 'Lead Scoring', metric: '4 active', colorKey: 'primary', position: [0.12, 1.16, 0.12] },
  { id: 'outreach', label: 'Outreach Draft', metric: '138 w', colorKey: 'accent', position: [1.42, 0.52, -0.1] },
  { id: 'escrow', label: 'Escrow Rails', metric: '$3.6k', colorKey: 'secondary', position: [2.35, -0.42, 0.15] },
  { id: 'proof', label: 'Proof Vault', metric: '2 minted', colorKey: 'muted', position: [0.86, -1.45, -0.18] },
  { id: 'flowboard', label: 'FlowBoard', metric: 'ready', colorKey: 'primary', position: [-0.9, -0.95, 0.12] },
]

const WORKFLOW_EDGES = [
  ['github', 'niche'],
  ['niche', 'lead'],
  ['lead', 'outreach'],
  ['outreach', 'escrow'],
  ['escrow', 'proof'],
  ['proof', 'flowboard'],
  ['flowboard', 'github'],
  ['niche', 'flowboard'],
  ['lead', 'flowboard'],
]

const NODE_INDEX = new Map(WORKFLOW_NODES.map((node, index) => [node.id, index]))
const NODE_VECTORS = WORKFLOW_NODES.map((node) => new THREE.Vector3(...node.position))
const EDGE_ENDPOINTS = WORKFLOW_EDGES.map(([from, to], index) => ({
  from: NODE_INDEX.get(from),
  to: NODE_INDEX.get(to),
  phase: index / WORKFLOW_EDGES.length,
}))

function WorkflowTopology({ activeIndex, palette }) {
  const groupRef = useRef(null)
  const coreRef = useRef(null)
  const ringRef = useRef(null)
  const nodeMeshRef = useRef(null)
  const packetMeshRef = useRef(null)

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const packetPosition = useMemo(() => new THREE.Vector3(), [])
  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(WORKFLOW_EDGES.length * 2 * 3)

    EDGE_ENDPOINTS.forEach((edge, edgeIndex) => {
      const from = NODE_VECTORS[edge.from]
      const to = NODE_VECTORS[edge.to]
      const offset = edgeIndex * 6

      positions[offset] = from.x
      positions[offset + 1] = from.y
      positions[offset + 2] = from.z
      positions[offset + 3] = to.x
      positions[offset + 4] = to.y
      positions[offset + 5] = to.z
    })

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.computeBoundingSphere()

    return geometry
  }, [])

  useEffect(() => () => lineGeometry.dispose(), [lineGeometry])

  useEffect(() => {
    if (!nodeMeshRef.current) {
      return
    }

    WORKFLOW_NODES.forEach((node, index) => {
      const scale = index === activeIndex ? 1.6 : 1
      dummy.position.set(...node.position)
      dummy.rotation.set(0, activeIndex * 0.2, 0)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()

      nodeMeshRef.current.setMatrixAt(index, dummy.matrix)
      nodeMeshRef.current.setColorAt(index, new THREE.Color(palette[node.colorKey] || palette.primary))
    })

    nodeMeshRef.current.instanceMatrix.needsUpdate = true

    if (nodeMeshRef.current.instanceColor) {
      nodeMeshRef.current.instanceColor.needsUpdate = true
    }
  }, [activeIndex, dummy, palette])

  useFrame((state) => {
    const pointerX = state.pointer.x * 0.18
    const pointerY = state.pointer.y * 0.08
    const elapsed = state.clock.elapsedTime

    if (groupRef.current) {
      groupRef.current.rotation.y = -0.18 + pointerX + Math.sin(elapsed * 0.18) * 0.06
      groupRef.current.rotation.x = -0.08 + pointerY
    }

    if (coreRef.current) {
      coreRef.current.rotation.y = elapsed * 0.16 + pointerX
      coreRef.current.rotation.x = elapsed * 0.04 + pointerY
    }

    if (ringRef.current) {
      ringRef.current.rotation.z = elapsed * 0.1
      ringRef.current.rotation.y = pointerX * 0.7
    }

    if (packetMeshRef.current) {
      EDGE_ENDPOINTS.forEach((edge, index) => {
        const from = NODE_VECTORS[edge.from]
        const to = NODE_VECTORS[edge.to]
        const progress = (elapsed * 0.18 + edge.phase) % 1
        const eased = progress * progress * (3 - 2 * progress)

        packetPosition.lerpVectors(from, to, eased)
        dummy.position.copy(packetPosition)
        dummy.scale.setScalar(0.52 + Math.sin(progress * Math.PI) * 0.22)
        dummy.updateMatrix()

        packetMeshRef.current.setMatrixAt(index, dummy.matrix)
      })

      packetMeshRef.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group ref={groupRef} scale={0.96} position={[0.05, -0.03, 0]}>
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color={palette.line} transparent opacity={palette.lineOpacity} />
      </lineSegments>

      <instancedMesh ref={nodeMeshRef} args={[undefined, undefined, WORKFLOW_NODES.length]}>
        <octahedronGeometry args={[0.13, 0]} />
        <meshBasicMaterial vertexColors transparent opacity={0.92} />
      </instancedMesh>

      <instancedMesh ref={packetMeshRef} args={[undefined, undefined, EDGE_ENDPOINTS.length]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshBasicMaterial color={palette.accent} transparent opacity={0.9} />
      </instancedMesh>

      <mesh ref={coreRef} position={[-0.35, 0.05, 0]}>
        <icosahedronGeometry args={[0.58, 1]} />
        <meshBasicMaterial color={palette.primary} wireframe transparent opacity={palette.coreOpacity} />
      </mesh>

      <mesh ref={ringRef} rotation={[Math.PI / 2.4, 0, 0]} position={[-0.35, 0.05, 0]}>
        <torusGeometry args={[1.06, 0.01, 8, 72]} />
        <meshBasicMaterial color={palette.secondary} transparent opacity={palette.secondaryOpacity + 0.08} />
      </mesh>

      <mesh rotation={[0.9, 0.25, 0.4]} position={[-0.35, 0.05, 0]}>
        <torusGeometry args={[0.82, 0.008, 8, 64]} />
        <meshBasicMaterial color={palette.muted} transparent opacity={palette.lineOpacity} />
      </mesh>
    </group>
  )
}

function ActiveWorkflowBadge({ activeIndex, palette }) {
  const activeNode = WORKFLOW_NODES[activeIndex]
  const activeColor = palette[activeNode.colorKey] || palette.primary

  return (
    <div className="rounded-2xl border border-primary/15 bg-background/40 p-3 shadow-[var(--glass-card-shadow)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
        <span>Live workflow topology</span>
        <span className="text-primary">adaptive</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/45 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em]">
        <span className="flex min-w-0 items-center gap-2 text-foreground">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: activeColor }}
            aria-hidden="true"
          />
          <span className="truncate">{activeNode.label}</span>
        </span>
        <span className="shrink-0 text-primary">{activeNode.metric}</span>
      </div>
    </div>
  )
}

function Hero3DElement() {
  const palette = useTheme3DPalette()
  const [enabled, setEnabled] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const widthQuery = window.matchMedia('(min-width: 768px)')

    const update = () => setEnabled(widthQuery.matches && !motionQuery.matches)
    update()

    motionQuery.addEventListener('change', update)
    widthQuery.addEventListener('change', update)

    return () => {
      motionQuery.removeEventListener('change', update)
      widthQuery.removeEventListener('change', update)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % WORKFLOW_NODES.length)
    }, 1700)

    return () => window.clearInterval(timer)
  }, [enabled])

  if (!enabled) {
    return (
      <div className="pointer-events-none absolute inset-x-4 top-28 z-0 hidden sm:block lg:right-[5%] lg:left-auto lg:top-[13%] lg:w-[32%] lg:min-w-[330px]">
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(circle at 50% 35%, ${palette.primary}26, transparent 58%)` }}
        />
        <ActiveWorkflowBadge activeIndex={activeIndex} palette={palette} />
      </div>
    )
  }

  return (
    <>
      <div className="pointer-events-none absolute right-[-6%] top-[12%] z-0 h-[64%] w-[54%] opacity-42">
        <Canvas
          camera={{ position: [0, 0, 5.8], fov: 44 }}
          dpr={[1, 1.35]}
          frameloop="always"
          gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
        >
          <WorkflowTopology activeIndex={activeIndex} palette={palette} />
        </Canvas>
      </div>

      <div className="pointer-events-none absolute right-[5%] top-[13%] z-0 hidden w-[32%] min-w-[330px] xl:block">
        <ActiveWorkflowBadge activeIndex={activeIndex} palette={palette} />
      </div>
    </>
  )
}

export default memo(Hero3DElement)
