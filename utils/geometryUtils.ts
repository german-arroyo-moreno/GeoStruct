
import * as THREE from 'three';
import { 
  ProcessedMesh, 
  VertexData, 
  FaceData, 
  WingedEdgeData, 
  HalfEdgeData,
  SoupTriangleData
} from '../types';

// Helper to round numbers for display and equality checks
const r = (n: number) => Math.round(n * 100) / 100;

export const analyzeGeometry = (geometry: THREE.BufferGeometry): ProcessedMesh => {
  const positions = geometry.attributes.position.array;
  
  // Data structures for the clean, processed mesh
  const vertices: VertexData[] = [];
  const faces: FaceData[] = [];
  const soupTriangles: SoupTriangleData[] = [];
  
  // Map to find duplicate vertices (Vertex Merging)
  // Key: "x_y_z" -> Value: new Vertex ID
  const uniqueVertsMap = new Map<string, number>();
  
  // Helper to process a vertex from the raw buffer
  const getOrAddVertex = (pIdx: number): number => {
    const x = r(positions[pIdx]);
    const y = r(positions[pIdx + 1]);
    const z = r(positions[pIdx + 2]);
    const key = `${x}_${y}_${z}`;
    
    if (uniqueVertsMap.has(key)) {
      return uniqueVertsMap.get(key)!;
    }
    
    const id = vertices.length;
    vertices.push({ id, x, y, z });
    uniqueVertsMap.set(key, id);
    return id;
  };

  // 1. Build Connected Topology (Vertices & Faces)
  const rawIndices = geometry.index ? geometry.index.array : null;
  const processedIndices: number[] = [];

  if (rawIndices) {
    for (let i = 0; i < rawIndices.length; i++) {
      processedIndices.push(getOrAddVertex(rawIndices[i] * 3));
    }
  } else {
    const numVerts = positions.length / 3;
    for (let i = 0; i < numVerts; i++) {
      processedIndices.push(getOrAddVertex(i * 3));
    }
  }

  // 2. Create Faces
  for (let i = 0; i < processedIndices.length; i += 3) {
    faces.push({
      id: i / 3,
      v1: processedIndices[i],
      v2: processedIndices[i + 1],
      v3: processedIndices[i + 2],
    });
  }

  // 3. Generate Soup Data
  for (let i = 0; i < processedIndices.length; i += 3) {
    const v1 = vertices[processedIndices[i]];
    const v2 = vertices[processedIndices[i+1]];
    const v3 = vertices[processedIndices[i+2]];

    soupTriangles.push({
      id: i / 3,
      v1: { x: v1.x, y: v1.y, z: v1.z },
      v2: { x: v2.x, y: v2.y, z: v2.z },
      v3: { x: v3.x, y: v3.y, z: v3.z }
    });
  }

  // 4. Build Half-Edges (Intermediate step for both HE and WE structures)
  // A half-edge is defined by (FaceID, StartVertex, EndVertex)
  // We store them linearly. Index = FaceID * 3 + localIndex (0, 1, or 2)
  interface TempHalfEdge {
    id: number;
    origin: number;
    target: number; 
    face: number;
    next: number;
    prev: number; 
    twin: number | null;
  }

  const tempHalfEdges: TempHalfEdge[] = [];

  faces.forEach((face) => {
    const vs = [face.v1, face.v2, face.v3];
    for (let i = 0; i < 3; i++) {
      const vStart = vs[i];
      const vEnd = vs[(i + 1) % 3];
      const heId = face.id * 3 + i;
      const nextId = face.id * 3 + ((i + 1) % 3);
      const prevId = face.id * 3 + ((i + 2) % 3); // (i-1) mod 3
      
      tempHalfEdges.push({
        id: heId,
        origin: vStart,
        target: vEnd,
        face: face.id,
        next: nextId,
        prev: prevId,
        twin: null
      });
    }
  });

  // Link Twins
  const heLookup = new Map<string, number>();
  tempHalfEdges.forEach(he => {
    heLookup.set(`${he.origin}_${he.target}`, he.id);
  });

  tempHalfEdges.forEach(he => {
    const twinId = heLookup.get(`${he.target}_${he.origin}`);
    if (twinId !== undefined) {
      he.twin = twinId;
    }
  });

  // 5. Build Final Half Edge Structure
  const halfEdges: HalfEdgeData[] = tempHalfEdges.map(he => ({
    id: he.id,
    originVertex: he.origin,
    targetVertex: he.target,
    face: he.face,
    next: he.next,
    prev: he.prev,
    twin: he.twin
  }));

  // Populate references for Half-Edge Mode
  if (halfEdges.length > 0) {
    halfEdges.forEach(he => {
      vertices[he.originVertex].incidentHalfEdge = he.id;
      faces[he.face].incidentHalfEdge = he.id;
    });
  }

  // 6. Build Winged Edge Structure
  // We map unique geometric edges to WingedEdges
  const wingedEdges: WingedEdgeData[] = [];
  
  // Helper to get consistent edge key for undirected edges
  const getEdgeKey = (a: number, b: number) => a < b ? `${a}_${b}` : `${b}_${a}`;
  
  // Map to track created edges to avoid duplicates
  // key -> WingedEdgeIndex
  const edgeKeyToIndex = new Map<string, number>();

  // Map to track which WingedEdge a specific HalfEdge belongs to
  // HalfEdgeID -> WingedEdgeIndex
  const heToWeMap = new Map<number, number>();

  // First Pass: Create the Edge Objects (without pred/succ yet)
  tempHalfEdges.forEach(he => {
    const key = getEdgeKey(he.origin, he.target);
    
    if (!edgeKeyToIndex.has(key)) {
      // Create new Winged Edge
      const weId = wingedEdges.length;
      edgeKeyToIndex.set(key, weId);
      
      const isCanonical = he.origin < he.target; // Start < End
      
      wingedEdges.push({
        id: weId,
        startVertex: isCanonical ? he.origin : he.target,
        endVertex: isCanonical ? he.target : he.origin,
        faceLeft: -1,  // To be filled
        faceRight: -1, // To be filled
        predLeft: -1,
        succLeft: -1,
        predRight: -1,
        succRight: -1
      });
    }

    const weId = edgeKeyToIndex.get(key)!;
    heToWeMap.set(he.id, weId);

    // Assign Face Logic
    // In Winged Edge, "Left" and "Right" are relative to the edge direction Start->End.
    // If we are looking at the Canonical edge (Start<End):
    // - The HE (Start->End) traverses the Face to its Left (CCW standard).
    // - The HE (End->Start) traverses the Face to its Right.
    const we = wingedEdges[weId];
    if (he.origin === we.startVertex) {
      // This HE goes Start->End. Its face is the Left Face.
      we.faceLeft = he.face;
    } else {
      // This HE goes End->Start. Its face is the Right Face.
      we.faceRight = he.face;
    }
  });

  // Second Pass: Fill Predecessors and Successors
  // Now that all HEs are mapped to a Winged Edge ID, we can traverse.
  wingedEdges.forEach(we => {
    // Find the Half-Edges associated with this Winged Edge
    // We look for HE (Start -> End) for Left side
    // We look for HE (End -> Start) for Right side
    
    // Left Side Logic
    const heLeftId = heLookup.get(`${we.startVertex}_${we.endVertex}`);
    if (heLeftId !== undefined) {
      const heLeft = tempHalfEdges[heLeftId];
      // SuccLeft: The Edge connected to heLeft.next
      const succLeftHE = heLeft.next;
      const succLeftWE = heToWeMap.get(succLeftHE);
      if (succLeftWE !== undefined) we.succLeft = succLeftWE;

      // PredLeft: The Edge connected to heLeft.prev
      const predLeftHE = heLeft.prev;
      const predLeftWE = heToWeMap.get(predLeftHE);
      if (predLeftWE !== undefined) we.predLeft = predLeftWE;
    }

    // Right Side Logic
    const heRightId = heLookup.get(`${we.endVertex}_${we.startVertex}`);
    if (heRightId !== undefined) {
      const heRight = tempHalfEdges[heRightId];
      
      // SuccRight: The Edge connected to heRight.next
      // Note: Right face orientation is still CCW relative to the face normal,
      // which aligns with the heRight direction (End->Start).
      const succRightHE = heRight.next;
      const succRightWE = heToWeMap.get(succRightHE);
      if (succRightWE !== undefined) we.succRight = succRightWE;

      // PredRight: The Edge connected to heRight.prev
      const predRightHE = heRight.prev;
      const predRightWE = heToWeMap.get(predRightHE);
      if (predRightWE !== undefined) we.predRight = predRightWE;
    }

    // References for Vertices/Faces in WE mode
    vertices[we.startVertex].incidentEdge = we.id;
    vertices[we.endVertex].incidentEdge = we.id;
    if (we.faceLeft !== -1) faces[we.faceLeft].incidentEdge = we.id;
    if (we.faceRight !== -1) faces[we.faceRight].incidentEdge = we.id;
  });

  return {
    vertices,
    faces,
    soupTriangles,
    halfEdges,
    edges: wingedEdges
  };
};
