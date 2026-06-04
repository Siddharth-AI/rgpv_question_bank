"use client";

import { Canvas } from "@react-three/fiber";
import { Float, MeshDistortMaterial, MeshTransmissionMaterial } from "@react-three/drei";

function CoreBlob() {
  return (
    <Float speed={2.2} rotationIntensity={0.6} floatIntensity={0.8}>
      <mesh>
        <icosahedronGeometry args={[1, 64]} />
        <MeshDistortMaterial
          color="#7C5CFF"
          emissive="#5B3FE0"
          emissiveIntensity={0.45}
          distort={0.55}
          speed={2.2}
          metalness={0.85}
          roughness={0.25}
        />
      </mesh>
    </Float>
  );
}

function GlassShell() {
  return (
    <mesh scale={1.55}>
      <icosahedronGeometry args={[1, 4]} />
      <MeshTransmissionMaterial
        transmission={1}
        thickness={0.45}
        roughness={0.15}
        chromaticAberration={0.06}
        attenuationColor="#FF6B9D"
        attenuationDistance={0.85}
        anisotropy={0.4}
        ior={1.4}
      />
    </mesh>
  );
}

export function HeroScene() {
  return (
    <div className="absolute inset-0 -z-0">
      <Canvas camera={{ fov: 38, position: [0, 0, 5] }} dpr={[1, 2]}>
        <ambientLight intensity={0.2} />
        <directionalLight position={[5, 5, 5]} intensity={1.1} color="#7C5CFF" />
        <directionalLight position={[-5, -3, 2]} intensity={0.8} color="#00D4FF" />
        <pointLight position={[2, -2, 3]} intensity={1.5} color="#FF6B9D" />
        <pointLight position={[0, 4, 4]} intensity={0.4} color="#ffffff" />
        <group position={[1.7, -0.1, 0]}>
          <CoreBlob />
          <GlassShell />
        </group>
      </Canvas>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 18% 50%, rgba(10,10,15,0.92) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
