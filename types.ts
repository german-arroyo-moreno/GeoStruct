
export type ShapeType = 'cube' | 'sphere' | 'torus';
export type StructureMode = 'soup' | 'indexed' | 'halfedge' | 'wingededge';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

// Basic Vertex for display
export interface VertexData {
  id: number;
  x: number;
  y: number;
  z: number;
  originalIndex?: number; // For soup mode
  // Topological references
  incidentEdge?: number;     // ID of an incident Winged Edge
  incidentHalfEdge?: number; // ID of an outgoing Half Edge
}

// Triangle Face
export interface FaceData {
  id: number;
  v1: number;
  v2: number;
  v3: number;
  normal?: Vector3;
  // Topological references
  incidentEdge?: number;     // ID of one Winged Edge belonging to this face
  incidentHalfEdge?: number; // ID of one Half Edge bordering this face
}

// Soup Triangle (Independent)
export interface SoupTriangleData {
  id: number;
  v1: Vector3;
  v2: Vector3;
  v3: Vector3;
}

// Half Edge Structure
export interface HalfEdgeData {
  id: number;
  originVertex: number;
  targetVertex: number; // Explicit target for display convenience
  face: number;
  twin: number | null;
  next: number;
  prev: number;         // Previous Half Edge around the face
}

// Winged Edge Structure
export interface WingedEdgeData {
  id: number;
  createdStep: number; // The face index during which this edge was created
  startVertex: number;
  endVertex: number;
  faceLeft: number;
  faceRight: number;
  predLeft: number;
  succLeft: number;
  predRight: number;
  succRight: number;
}

// Processed Mesh Data container
export interface ProcessedMesh {
  vertices: VertexData[];
  faces: FaceData[];
  edges?: WingedEdgeData[]; // For Winged Edge
  halfEdges?: HalfEdgeData[]; // For Half Edge
  soupTriangles?: SoupTriangleData[]; // For Soup (independent triangles)
}

export interface HoverState {
  type: 'vertex' | 'face' | 'edge' | 'halfedge';
  id: number;
}