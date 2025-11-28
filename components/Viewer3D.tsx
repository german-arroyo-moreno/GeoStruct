
import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei';
import * as THREE from 'three';
import { ProcessedMesh, HoverState, StructureMode, VertexData } from '../types';

interface ViewerProps {
  meshData: ProcessedMesh;
  hoverState: HoverState | null;
  mode: StructureMode;
}

// Helper component to render a single specific face
const SingleFaceHighlight: React.FC<{ 
  meshData: ProcessedMesh; 
  faceId: number; 
  color: string;
  opacity?: number;
  scale?: number;
}> = ({ meshData, faceId, color, opacity = 0.4, scale = 1.02 }) => {
  const f = meshData.faces.find(f => f.id === faceId);
  if (!f) return null;

  const v1 = meshData.vertices[f.v1];
  const v2 = meshData.vertices[f.v2];
  const v3 = meshData.vertices[f.v3];
  
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    v1.x, v1.y, v1.z,
    v2.x, v2.y, v2.z,
    v3.x, v3.y, v3.z
  ]);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex([0, 1, 2]);
  geometry.scale(scale, scale, scale);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthTest={false} />
    </mesh>
  );
};

const MeshHighlight: React.FC<{ meshData: ProcessedMesh; hoverState: HoverState | null; mode: StructureMode }> = ({ meshData, hoverState, mode }) => {
  if (!hoverState) return null;

  // SPECIAL CASE: Soup Mode - Face Hover (The entire row in table is a triangle)
  if (mode === 'soup' && hoverState.type === 'face') {
    if (!meshData.soupTriangles) return null;
    
    const triangle = meshData.soupTriangles.find(t => t.id === hoverState.id);
    if (!triangle) return null;

    const { v1, v2, v3 } = triangle;

    // Geometry for the face
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      v1.x, v1.y, v1.z,
      v2.x, v2.y, v2.z,
      v3.x, v3.y, v3.z
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex([0, 1, 2]);
    // Slightly scale up to avoid z-fighting and cover the base mesh
    geometry.scale(1.02, 1.02, 1.02);

    return (
      <group>
        {/* Highlight the Face */}
        <mesh geometry={geometry}>
          <meshBasicMaterial color="#ec4899" transparent opacity={0.5} side={THREE.DoubleSide} depthTest={false} />
        </mesh>
        
        {/* Highlight Triangle Wireframe */}
        <lineSegments>
            <edgesGeometry args={[geometry]} />
            <lineBasicMaterial color="#ffffff" depthTest={false} linewidth={2} transparent opacity={0.8} />
        </lineSegments>

        {/* Highlight the 3 Vertices */}
        {[v1, v2, v3].map((v, i) => (
          <mesh key={i} position={[v.x, v.y, v.z]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial color="#ffffff" depthTest={false} />
          </mesh>
        ))}
      </group>
    );
  }

  // Standard Vertex Highlight
  if (hoverState.type === 'vertex') {
    let v = meshData.vertices.find(v => v.id === hoverState.id);
    if (v) {
      return (
        <mesh position={[v.x, v.y, v.z]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color="#ec4899" depthTest={false} />
        </mesh>
      );
    }
  }

  // Highlight Face (Indexed Mode or HalfEdge Face reference)
  if (hoverState.type === 'face' && mode !== 'soup') {
    return (
      <group>
        <SingleFaceHighlight meshData={meshData} faceId={hoverState.id} color="#ec4899" opacity={0.6} scale={1.03} />
        <SingleFaceHighlight meshData={meshData} faceId={hoverState.id} color="#ffffff" opacity={0.2} scale={1.01} />
      </group>
    );
  }

  // Highlight Edge (Winged) or HalfEdge
  if (hoverState.type === 'edge' || hoverState.type === 'halfedge') {
    let vStart: VertexData | undefined, vEnd: VertexData | undefined;
    let isHalf = false;
    let wingedEdgeData = null;

    if (hoverState.type === 'edge' && meshData.edges) {
      const e = meshData.edges.find(e => e.id === hoverState.id);
      if (e) {
        wingedEdgeData = e;
        vStart = meshData.vertices[e.startVertex];
        vEnd = meshData.vertices[e.endVertex];
      }
    } else if (hoverState.type === 'halfedge' && meshData.halfEdges) {
      const he = meshData.halfEdges.find(h => h.id === hoverState.id);
      if (he) {
        isHalf = true;
        vStart = meshData.vertices[he.originVertex];
        vEnd = meshData.vertices[he.targetVertex];
      }
    }

    if (vStart && vEnd) {
      const start = new THREE.Vector3(vStart.x, vStart.y, vStart.z);
      const end = new THREE.Vector3(vEnd.x, vEnd.y, vEnd.z);
      
      const mid = start.clone().lerp(end, 0.5);
      const direction = new THREE.Vector3().subVectors(end, start);
      const length = direction.length();
      
      return (
        <group>
            {/* The Line/Edge Itself */}
            <mesh position={mid} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())}>
              <cylinderGeometry args={[0.04, 0.04, length, 8]} />
              <meshBasicMaterial color={isHalf ? "#f59e0b" : "#ffffff"} depthTest={false} />
            </mesh>
            
            {/* Arrow for Half Edge */}
            {isHalf && (
               <mesh position={mid.clone().add(direction.clone().multiplyScalar(0.2))} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())}>
                  <coneGeometry args={[0.08, 0.15, 8]} />
                  <meshBasicMaterial color="#f59e0b" depthTest={false} />
               </mesh>
            )}

            {/* WINGED EDGE SPECIFIC: Show Left and Right Faces */}
            {wingedEdgeData && (
              <>
                {wingedEdgeData.faceLeft !== -1 && (
                  <SingleFaceHighlight 
                    meshData={meshData} 
                    faceId={wingedEdgeData.faceLeft} 
                    color="#10b981" // Green for Left
                    opacity={0.6}
                  />
                )}
                {wingedEdgeData.faceRight !== -1 && (
                  <SingleFaceHighlight 
                    meshData={meshData} 
                    faceId={wingedEdgeData.faceRight} 
                    color="#3b82f6" // Blue for Right
                    opacity={0.6}
                  />
                )}
              </>
            )}
        </group>
      );
    }
  }

  return null;
};

// Component to render indices in 3D space
const IndicesLabels: React.FC<{ meshData: ProcessedMesh, mode: StructureMode }> = ({ meshData, mode }) => {
   const visible = mode !== 'soup'; 
   
   if (!visible) return null;

   return (
     <group>
       {meshData.vertices.map((v) => (
         <Text
           key={v.id}
           position={[v.x * 1.1, v.y * 1.1, v.z * 1.1]} // Push out slightly
           fontSize={0.15}
           color="white"
           anchorX="center"
           anchorY="middle"
         >
           {v.id}
         </Text>
       ))}
     </group>
   );
}


export const Viewer3D: React.FC<ViewerProps> = ({ meshData, hoverState, mode }) => {
  // Reconstruct standard geometry for the base mesh
  const geometry = useMemo(() => {
    // If we are in the middle of construction, meshData.faces might be partial.
    // We only build geometry from the faces present in meshData.
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(meshData.vertices.length * 3);
    meshData.vertices.forEach((v, i) => {
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
    });
    
    const indices: number[] = [];
    meshData.faces.forEach(f => indices.push(f.v1, f.v2, f.v3));

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [meshData]);

  return (
    // Updated background to a radial gradient for better depth and contrast
    <div className="w-full h-full relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-[#050b14] to-black">
      <Canvas>
        <PerspectiveCamera makeDefault position={[3, 2, 4]} />
        <OrbitControls enableDamping dampingFactor={0.1} />
        
        <ambientLight intensity={0.7} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <pointLight position={[-10, -10, -10]} intensity={0.8} />

        <group>
          {/* Main Mesh - Wireframe + Transparent Surface */}
          <mesh geometry={geometry}>
             <meshStandardMaterial 
                color="#312e81" // Dark indigo
                emissive="#1e1b4b" // Slight emissive glow
                roughness={0.2} 
                metalness={0.9}
                transparent 
                opacity={0.15} 
                side={THREE.DoubleSide}
                polygonOffset
                polygonOffsetFactor={1}
                polygonOffsetUnits={1}
             />
          </mesh>
          <mesh geometry={geometry}>
            {/* Brighter wireframe color (Light Indigo/Blue) for high contrast */}
            <meshBasicMaterial color="#818cf8" wireframe />
          </mesh>

          {/* Interactive Highlights */}
          <MeshHighlight meshData={meshData} hoverState={hoverState} mode={mode} />
          
        </group>

        <gridHelper args={[10, 10, 0x1e293b, 0x0f172a]} position={[0, -2, 0]} />
      </Canvas>
      
      <div className="absolute bottom-4 left-4 text-xs text-gray-500 font-mono pointer-events-none">
        Use Mouse to Rotate/Zoom
      </div>
    </div>
  );
};