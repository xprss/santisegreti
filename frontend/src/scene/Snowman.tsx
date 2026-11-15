const SNOW = '#f4f8fc'
const COAL = '#1b1714'

export interface SnowmanLook {
  scarf: string
  hat: 'top' | 'beanie'
  hatColor: string
}

/** Pupazzo di neve: tre palle, naso di carota, sciarpa, braccia di rametti. Guarda verso +z. */
export function Snowman({ scarf, hat, hatColor }: SnowmanLook) {
  const coal = (x: number, y: number, z: number, r = 0.035) => (
    <mesh position={[x, y, z]}>
      <sphereGeometry args={[r, 6, 5]} />
      <meshStandardMaterial color={COAL} roughness={0.6} />
    </mesh>
  )
  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <icosahedronGeometry args={[0.55, 2]} />
        <meshStandardMaterial color={SNOW} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 1.13, 0]} castShadow>
        <icosahedronGeometry args={[0.4, 2]} />
        <meshStandardMaterial color={SNOW} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 1.66, 0]} castShadow>
        <icosahedronGeometry args={[0.28, 2]} />
        <meshStandardMaterial color={SNOW} roughness={1} flatShading />
      </mesh>

      {/* bottoni, occhi, sorriso di carbone */}
      {coal(0, 1.25, 0.38)}
      {coal(0, 1.08, 0.4)}
      {coal(0, 0.91, 0.37)}
      {coal(-0.1, 1.74, 0.26, 0.032)}
      {coal(0.1, 1.74, 0.26, 0.032)}
      {[-0.12, -0.06, 0, 0.06, 0.12].map((x) => (
        <group key={x}>{coal(x, 1.53 + Math.abs(x) * 0.35, 0.25, 0.018)}</group>
      ))}
      <mesh position={[0, 1.66, 0.38]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.045, 0.26, 6]} />
        <meshStandardMaterial color="#f07a1a" roughness={0.6} flatShading />
      </mesh>

      {/* sciarpa con un lembo che pende */}
      <mesh position={[0, 1.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.25, 0.07, 6, 16]} />
        <meshStandardMaterial color={scarf} roughness={0.8} flatShading />
      </mesh>
      <mesh position={[0.17, 1.25, 0.2]} rotation={[0.2, 0, 0.15]}>
        <boxGeometry args={[0.12, 0.32, 0.05]} />
        <meshStandardMaterial color={scarf} roughness={0.8} />
      </mesh>

      {/* braccia di rametti */}
      {[1, -1].map((side) => (
        <group key={side} position={[side * 0.36, 1.2, 0]} rotation={[0, 0, side * -1.0]}>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.018, 0.025, 0.6, 4]} />
            <meshStandardMaterial color="#4a2e1a" roughness={1} />
          </mesh>
          <mesh position={[side * -0.05, 0.5, 0]} rotation={[0, 0, side * 0.7]}>
            <cylinderGeometry args={[0.01, 0.014, 0.18, 4]} />
            <meshStandardMaterial color="#4a2e1a" roughness={1} />
          </mesh>
        </group>
      ))}

      {hat === 'top' ? (
        <group position={[0, 1.88, 0]} rotation={[0, 0, 0.12]}>
          <mesh>
            <cylinderGeometry args={[0.3, 0.3, 0.035, 14]} />
            <meshStandardMaterial color={COAL} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.19, 0.2, 0.34, 14]} />
            <meshStandardMaterial color={COAL} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.205, 0.205, 0.07, 14]} />
            <meshStandardMaterial color={hatColor} roughness={0.5} />
          </mesh>
        </group>
      ) : (
        <group position={[0, 1.84, 0]} rotation={[0.15, 0, -0.1]}>
          <mesh>
            <sphereGeometry args={[0.25, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={hatColor} roughness={0.9} flatShading />
          </mesh>
          <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.24, 0.045, 5, 16]} />
            <meshStandardMaterial color="#fffaf0" roughness={1} flatShading />
          </mesh>
          <mesh position={[0, 0.28, 0]}>
            <icosahedronGeometry args={[0.08, 1]} />
            <meshStandardMaterial color="#fffaf0" roughness={1} flatShading />
          </mesh>
        </group>
      )}
    </group>
  )
}
