# FixFlow Visual System: 3D Asset Master Prompt Specification

This document is the **single source of truth** and design blueprint for evolving the visual identity of **FixFlow AI**. It maps the existing website video mockups to a proprietary visual language called **The Flow Engine** (inspired by Microsoft Fluent and Apple Vision Pro). 

This guide provides the **exact master descriptions and generator prompts** to build these assets using 3D modeling tools (Blender, Spline, Cinema4D) or Generative AI tools (Midjourney, Stable Diffusion, Luma AI, Spline AI).

---

## 1. Brand Vision & The Flow Ribbon

The logo's geometric ribbon structure is evolved into a continuous, flowing visual system. This ribbon represents the client lifecycle: fluid collaboration tightening into structured, secure agreement nodes.

- **Aesthetic**: Refractive glassmorphic materials, glowing fiber-optic energy paths, volumetric backlighting, and warm ambient highlights.
- **Color Identity**: 
  - **Freelancer Workspace**: Primary Cyan (`#3fd7ff` / HSL 192, 100%, 62%)
  - **Agency Intake**: Secondary Violet (`#a78bfa` / HSL 258, 90%, 76%)
  - **Developer Delivery**: Success Green (`#26d07c` / HSL 150, 68%, 48%)
  - **Escrow Vault**: Secure Amber/Gold (`#eab308` / HSL 45, 93%, 47%)

---

## 2. 3D Visual Asset Architecture & Prompts

### Visual Component 1: THE FLOW ENGINE (Hero Centerpiece)
- **Replaces Original Video**: `/video/hero-ui.mp4` / `/landing-page/hero-ui.png` (WaitlistHero.jsx)
- **Concept**: A continuous interlocking double-helix ribbon representing intake parsing.

#### A. 3D Modeling Specifications (Blender / Spline)
- **Geometry**: Dual interwoven 3D Bezier splines swept into hollow tubes. Include a third concentric torus ring ($r=0.6$) resting horizontally at the center.
- **Materials**: 
  - Ribbon 1: Glassmorphism (`transmission = 0.95`, `roughness = 0.12`, `ior = 1.48`, color cyan).
  - Ribbon 2: Glassmorphism (`transmission = 0.95`, `roughness = 0.12`, `ior = 1.48`, color violet).
  - Core: High-emissive fiber threads inside the tubes pulsing gently.
- **Lighting**: Studio HDR with high backlighting (rim light) to illuminate the translucent glass edges.

#### B. Generative AI Image Prompt (Midjourney v6)
> `/imagine prompt: A futuristic 3D abstract object representing workflow automation, interlocking double helix ribbons made of thick transparent refractive glass, glowing cyan and violet neon energy streams running through the center of the glass tubes, floating on a dark navy blue minimalist workspace background, volumetric soft lighting, depth of field, Microsoft Fluent design style, premium aesthetic, 8k render, octane render style, Raytracing --ar 16:9 --style raw --v 6.0`

---

### Visual Component 2: THE COLLABORATION NETWORK (Onboarding Portal)
- **Replaces Original Video**: `/video/onboarding-portal.mp4` / `/landing-page/onboarding-portal.png` (SolutionSection.jsx - Row 1)
- **Concept**: A connected topological ecosystem showing clients, agencies, freelancers, and AI agents.

#### A. 3D Modeling Specifications (Blender / Spline)
- **Geometry**: Five glass octahedrons representing nodes positioned in a 3D coordinate system (Client, Freelancer, Agency, Deliverables, and AI Agent). Connect them with thin translucent glowing tubes.
- **Materials**: Matte translucent white glass for node shells with inner glowing cores (color matched to node role). Edge lines should be semi-transparent grey (`opacity = 0.3`).
- **Motion**: Tiny glowing spheres (data packets) traversing along the tubes from Client to AI and Freelancer.

#### B. Generative AI Image Prompt (Midjourney v6)
> `/imagine prompt: A futuristic 3D connected network diagram, five floating transparent glass octahedral nodes connected by thin glowing neon green and purple light pipelines, small energy beads flowing along the lines, abstract tech visualization, high-end UI design asset, dark glassmorphism, clean background, soft ambient shadows, Apple Vision Pro aesthetic, 3d rendering, cinematic lighting --ar 4:3 --v 6.0`

---

### Visual Component 3: THE PROPOSAL ENGINE (Scoping & Proposal Generator)
- **Replaces Original Video**: `/video/payment-checkout.mp4` / `/landing-page/payment-checkout.png` (SolutionSection.jsx - Row 2)
- **Concept**: An input stream (messy briefs) parsed into a structured, branching proposal timeline (milestones, budgets, scope).

#### A. 3D Modeling Specifications (Blender / Spline)
- **Geometry**: Left-to-right flow. A single input spline curve enters a central glass torus analyzer ring. Out of the analyzer ring, three distinct parallel output curves emerge, terminating at three small structured document cubes.
- **Materials**: The torus ring has high refraction glass properties. The input curve glows white; the output lines glow cyan, violet, and green respectively.
- **Motion**: White light packets converge into the center, trigger a pulsing flash in the torus ring, and emerge as color-sorted streams flowing to the right.

#### B. Generative AI Image Prompt (Midjourney v6)
> `/imagine prompt: A 3D model of a futuristic proposal generator machine, a single beam of unstructured white light passing through a circular glass lens and splitting into three distinct organized streams of glowing colored light (cyan, violet, emerald green), clean dark studio background, minimalist tech design, glassmorphism UI element, volumetric lighting, premium render, octane render --ar 16:10 --v 6.0`

---

### Visual Component 4: THE ESCROW VAULT (Secure Escrow)
- **Replaces Original Video**: `/video/exploded-view.mp4` / `/landing-page/exploded-view.png` (WhyJoinSection.jsx)
- **Concept**: High-trust security represented by concentric locking rings protecting a glowing escrow core.

#### A. 3D Modeling Specifications (Blender / Spline)
- **Geometry**: A central icosahedron core surrounded by three concentric flat torus rings aligned to the X, Y, and Z axes. Small cubic blockchain nodes are attached to the outer circumference of the rings.
- **Materials**: 
  - Core: Metallic gold (`metalness = 0.95`, `roughness = 0.08`) with a warm yellow emission glow.
  - Rings: Super-translucent glass with clearcoat to maximize refractive light paths.
- **Motion**: Outer rings rotate in opposite directions at differential speeds ($f, -1.4f, 2.2f$).

#### B. Generative AI Image Prompt (Midjourney v6)
> `/imagine prompt: A futuristic 3D secure escrow vault, a central glowing metallic gold sphere surrounded by three concentric rotating rings made of frosted transparent glass, small tech nodes attached to the rings, cryptographic security visualization, dark luxury tech style, soft gold and cyan volumetric lighting, raytracing, premium UI asset, Blender render --ar 4:3 --v 6.0`

---

### Visual Component 5: THE DELIVERY LAUNCH SYSTEM (Project Delivery)
- **Replaces Original Icon**: Rocket Icon / Milestone Payout (WaitlistForm.jsx)
- **Concept**: Upward spiral representing task completion, release of deliverables, and final escrow payment.

#### A. 3D Modeling Specifications (Blender / Spline)
- **Geometry**: A vertical cylinder path where three glass ribbons helix upwards, widening as they rise.
- **Materials**: Helix curves colored success-green (`#26d07c`) using physical glass textures.
- **Motion**: Floating energy particles rise vertically inside the helix, accelerating and expanding outward at the top.

#### B. Generative AI Image Prompt (Midjourney v6)
> `/imagine prompt: A futuristic 3D delivery launch visualization, spiraling upward ribbons of emerald green glass wrapping around a vertical column of light, glowing green particles shooting upwards and dispersing at the top like a light fountain, project completion concept, dark background, premium glassmorphism, 3d illustration, octane render --ar 4:5 --v 6.0`

---

## 3. Glassmorphism & Rendering Standards

To guarantee that the produced 3D assets render with a premium look, designers should configure assets with the following properties:

### WebGL Material Config (Three.js / React Three Fiber)
```javascript
const glassMaterial = new THREE.MeshPhysicalMaterial({
  roughness: 0.12,          // Soft light scatter
  transmission: 0.95,       // Max transparency
  thickness: 1.2,           // Refraction depth
  ior: 1.48,                // Glass Index of Refraction
  clearcoat: 1.0,           // Wet-look surface shine
  clearcoatRoughness: 0.03, // Mirror-like reflection
  transparent: true,
  opacity: 0.85
});
```

### Lighting Environment Setup
- **Ambient Fill**: Cool navy ambient (`#0e1f2b` at `0.3` intensity) to fill shadow channels.
- **Key Light**: High-angle warm white directional light (`1.5` intensity) to define structural contours.
- **Rim Light**: Back-angled high-intensity point light (`2.0` intensity) colored cyan or gold to highlight glass edges and generate bloom profiles.

---

## 4. Animation Guidelines

1. **Natural Drift**: Always apply a subtle, continuous floating oscillation ($y = A \sin(\omega t)$ where $A = 0.08$ and $\omega = 0.45$) to simulate gravity-free depth.
2. **Dynamic Hover Response**: Interactive elements should scale up by $10\text{--}15\%$ on hover, accompanied by a shift in light reflection angles to make the UI feel reactive.
3. **Scroll Parallax**: Bind the asset's rotation to scroll height (`scrollYProgress`) with a maximum range of $\pm 25$ degrees to maintain grid structure alignment.
