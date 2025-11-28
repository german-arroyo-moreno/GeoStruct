
import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { ShapeType, StructureMode, ProcessedMesh, HoverState } from './types';
import { analyzeGeometry } from './utils/geometryUtils';
import { Viewer3D } from './components/Viewer3D';
import { InfoPanel } from './components/InfoPanel';
import { Cuboid, Circle, Donut, Database, Code, GitBranch, Share2, Play, Pause, SkipForward, RotateCcw, StepForward } from 'lucide-react';

const SHAPES: { id: ShapeType; label: string; icon: React.ReactNode }[] = [
  { id: 'cube', label: 'Cubo', icon: <Cuboid size={18} /> },
  { id: 'sphere', label: 'Esfera', icon: <Circle size={18} /> },
  { id: 'torus', label: 'Torus', icon: <Donut size={18} /> },
];

const MODES: { id: StructureMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'soup', label: 'Sopa de Triángulos', icon: <Database size={16} />, desc: "Arrays de vértices simples sin compartir" },
  { id: 'indexed', label: 'Indexado', icon: <Code size={16} />, desc: "Vértices compartidos + Lista de Índices" },
  { id: 'wingededge', label: 'Arista Alada', icon: <Share2 size={16} />, desc: "Arista Alada Completa (Full Winged Edge)" },
  { id: 'halfedge', label: 'Media Arista', icon: <GitBranch size={16} />, desc: "Media Arista (Half-Edge / DCEL)" },
];

export default function App() {
  const [currentShape, setCurrentShape] = useState<ShapeType>('cube');
  const [currentMode, setCurrentMode] = useState<StructureMode>('indexed');
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  
  // Full calculated mesh data
  const [fullMeshData, setFullMeshData] = useState<ProcessedMesh | null>(null);

  // Construction Mode State
  const [isConstructionMode, setIsConstructionMode] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(-1); // -1 means empty, 0 means first face, etc.
  const [isPlaying, setIsPlaying] = useState(false);

  // Resize State
  const [leftWidth, setLeftWidth] = useState(256);
  const [rightWidth, setRightWidth] = useState(384);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);

  // Generate Geometry on shape change
  useEffect(() => {
    let geo: THREE.BufferGeometry;
    
    // Low poly geometries for readability in tables
    switch (currentShape) {
      case 'cube':
        geo = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1);
        break;
      case 'sphere':
        geo = new THREE.IcosahedronGeometry(0.8, 0); // Level 0 for low vertex count (12 verts)
        break;
      case 'torus':
        geo = new THREE.TorusGeometry(0.6, 0.25, 5, 8); // Very low poly torus
        break;
      default:
        geo = new THREE.BoxGeometry();
    }
    
    // Convert to non-indexed if simulating logic, but our util handles extraction
    const data = analyzeGeometry(geo);
    setFullMeshData(data);
    
    // Reset construction state when shape changes
    setCurrentStep(-1);
    setIsPlaying(false);

    return () => { geo.dispose(); }
  }, [currentShape]);

  // Handle Playback
  useEffect(() => {
    let interval: number;
    if (isPlaying && fullMeshData) {
      interval = window.setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= fullMeshData.faces.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 500); // 500ms per step
    }
    return () => clearInterval(interval);
  }, [isPlaying, fullMeshData]);

  // Compute "Snapshot" of mesh data based on construction step
  const activeMeshData = useMemo(() => {
    if (!fullMeshData) return null;
    if (!isConstructionMode) return fullMeshData;

    // Slice data up to currentStep (which represents the index of the last added face)
    // We treat 'step' as the face Index. So step 0 includes Face 0.

    const slicedFaces = fullMeshData.faces.filter(f => f.id <= currentStep);
    
    // Determine which vertices have been "discovered" so far.
    // Since vertices are added to the list in order of discovery by the geometry analyzer,
    // we essentially just need to find the maximum vertex ID referenced by the visible faces
    // and slice the vertex array up to that point.
    let maxVertIndex = -1;
    slicedFaces.forEach(f => {
      maxVertIndex = Math.max(maxVertIndex, f.v1, f.v2, f.v3);
    });

    // If step is -1 (start), maxVertIndex is -1, so slice(0, 0) gives empty array.
    const relevantVertices = fullMeshData.vertices.slice(0, maxVertIndex + 1);

    const slicedVertices = relevantVertices.map(v => ({
      ...v,
      // Hide topological links to future items.
      incidentEdge: (v.incidentEdge !== undefined && fullMeshData.edges && fullMeshData.edges[v.incidentEdge].createdStep <= currentStep) 
        ? v.incidentEdge : undefined,
      incidentHalfEdge: (v.incidentHalfEdge !== undefined && fullMeshData.halfEdges && fullMeshData.halfEdges[v.incidentHalfEdge].face <= currentStep)
        ? v.incidentHalfEdge : undefined
    }));

    // Sliced Half Edges
    // Include only those belonging to faces <= currentStep
    const slicedHalfEdges = fullMeshData.halfEdges 
      ? fullMeshData.halfEdges.filter(he => he.face <= currentStep).map(he => {
          // If twin belongs to a future face, hide it
          const twinIsVisible = he.twin !== null && fullMeshData.halfEdges![he.twin].face <= currentStep;
          return {
            ...he,
            twin: twinIsVisible ? he.twin : null
          };
      }) 
      : undefined;

    // Sliced Winged Edges
    const slicedEdges = fullMeshData.edges
      ? fullMeshData.edges.filter(e => e.createdStep <= currentStep).map(e => {
          // If right face is in future, hide it
          const rightFaceVisible = e.faceRight !== -1 && e.faceRight <= currentStep;
          
          // Check neighbors visibility. 
          // Note: In a real algorithm, preds/succs update dynamically. 
          // Here we just check if the linked edge exists in our slice.
          // Ideally, we'd check if the *face* causing that link has been processed, but simplify to edge existence.
          const checkEdge = (id: number) => (id !== -1 && fullMeshData.edges![id].createdStep <= currentStep) ? id : -1;

          return {
            ...e,
            faceRight: rightFaceVisible ? e.faceRight : -1,
            predRight: rightFaceVisible ? checkEdge(e.predRight) : -1,
            succRight: rightFaceVisible ? checkEdge(e.succRight) : -1,
            // Left face is usually the creation face, so it's visible if edge is visible
            predLeft: checkEdge(e.predLeft),
            succLeft: checkEdge(e.succLeft)
          }
      })
      : undefined;

    return {
      vertices: slicedVertices,
      faces: slicedFaces,
      soupTriangles: fullMeshData.soupTriangles?.slice(0, currentStep + 1), // Only if we supported soup construction
      halfEdges: slicedHalfEdges,
      edges: slicedEdges
    };

  }, [fullMeshData, isConstructionMode, currentStep]);

  // Resize Handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft.current) {
        const newWidth = Math.max(200, Math.min(e.clientX, 500));
        setLeftWidth(newWidth);
      }
      if (isResizingRight.current) {
        const newWidth = Math.max(250, Math.min(window.innerWidth - e.clientX, 800));
        setRightWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizingLeft.current = false;
      isResizingRight.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResizeLeft = () => {
    isResizingLeft.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const startResizeRight = () => {
    isResizingRight.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const toggleConstructionMode = () => {
    const newMode = !isConstructionMode;
    setIsConstructionMode(newMode);
    setCurrentStep(newMode ? -1 : (fullMeshData?.faces.length || 0));
    setIsPlaying(false);
  };

  const activeFaceHighlight = isConstructionMode && currentStep >= 0 
    ? { type: 'face' as const, id: currentStep } 
    : null;

  // Merge hover state with active face highlight logic?
  // Ideally, user hover overrides active face.
  const visualHoverState = hoverState || activeFaceHighlight;

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* LEFT SIDEBAR: CONTROLS */}
      <div 
        style={{ width: leftWidth }}
        className="bg-slate-900 border-r border-slate-700 flex flex-col z-20 shadow-xl flex-shrink-0"
      >
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-pink-500">
            GeoStruct 3D
          </h1>
          <p className="text-xs text-slate-400 mt-2">Explorador de Estructuras</p>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-8 scrollbar-thin">
          
          {/* Shape Selector */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Objeto 3D</h3>
            <div className="grid grid-cols-3 gap-2">
              {SHAPES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setCurrentShape(s.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                    currentShape === s.id 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {s.icon}
                  <span className="text-[10px] mt-1">{s.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Mode Selector */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Estructura de Datos</h3>
            <div className="space-y-2">
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    setCurrentMode(m.id);
                    setHoverState(null);
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 ${
                    currentMode === m.id
                      ? 'bg-slate-800 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                      : 'bg-transparent border-slate-700 hover:border-slate-500 text-slate-400'
                  }`}
                >
                  <div className={`${currentMode === m.id ? 'text-indigo-400' : 'text-slate-500'}`}>
                    {m.icon}
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${currentMode === m.id ? 'text-white' : 'text-slate-300'}`}>
                      {m.label}
                    </div>
                    <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{m.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* CONSTRUCTION MODE CONTROLS */}
            <section className="p-4 bg-slate-800/80 rounded-lg border border-indigo-500/30 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                 <h4 className="text-xs font-bold text-white flex items-center gap-2">
                   <StepForward size={14} className="text-emerald-400"/> Construcción Paso a Paso
                 </h4>
                 <button 
                    onClick={toggleConstructionMode}
                    className={`w-8 h-4 rounded-full transition-colors relative ${isConstructionMode ? 'bg-emerald-500' : 'bg-slate-600'}`}
                 >
                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isConstructionMode ? 'translate-x-4' : ''}`} />
                 </button>
              </div>

              {isConstructionMode && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                   <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                      <span>Cara actual:</span>
                      <span className="text-emerald-400 font-bold">
                        {currentStep === -1 ? 'INICIO' : `#${currentStep}`}
                      </span>
                   </div>
                   
                   {/* Progress Bar */}
                   <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full transition-all duration-300"
                        style={{ width: fullMeshData ? `${((currentStep + 1) / fullMeshData.faces.length) * 100}%` : '0%' }}
                      />
                   </div>

                   <div className="flex gap-2 justify-between mt-2">
                      <button 
                        onClick={() => { setCurrentStep(-1); setIsPlaying(false); }}
                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                        title="Reiniciar"
                      >
                        <RotateCcw size={14} />
                      </button>
                      
                      <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={`flex-1 flex items-center justify-center gap-2 p-2 rounded font-bold text-xs transition-colors ${isPlaying ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-emerald-500 text-slate-900 hover:bg-emerald-400'}`}
                      >
                         {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                         {isPlaying ? 'PAUSAR' : 'AUTO'}
                      </button>

                      <button 
                        onClick={() => {
                          setIsPlaying(false);
                          setCurrentStep(prev => (fullMeshData && prev < fullMeshData.faces.length - 1) ? prev + 1 : prev);
                        }}
                        className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded"
                        title="Siguiente Paso"
                      >
                        <SkipForward size={14} />
                      </button>
                   </div>
                </div>
              )}
            </section>

          <section className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <h4 className="text-xs font-bold text-slate-300 mb-2">Estadísticas</h4>
            {activeMeshData && (
               <div className="space-y-1 text-xs text-slate-400 font-mono">
                 <div className="flex justify-between"><span>Vértices:</span> <span className="text-white">{activeMeshData.vertices.length}</span></div>
                 <div className="flex justify-between"><span>Caras:</span> <span className="text-white">{activeMeshData.faces.length}</span></div>
                 <div className="flex justify-between"><span>Aristas (aprox):</span> <span className="text-white">{activeMeshData.edges?.length || activeMeshData.halfEdges?.length || '-'}</span></div>
               </div>
            )}
          </section>
        </div>
        
        <div className="p-4 border-t border-slate-800 text-[10px] text-slate-500 text-center">
          Clase de Gráficos por Computador
        </div>
      </div>

      {/* LEFT RESIZER */}
      <div 
        className="w-1 bg-slate-800 hover:bg-indigo-500 hover:w-1.5 transition-all cursor-col-resize z-50 flex-shrink-0"
        onMouseDown={startResizeLeft}
      />

      {/* CENTER: 3D VIEWER */}
      <div 
        className="flex-1 relative cursor-crosshair min-w-0"
        onMouseEnter={() => setHoverState(null)}
      >
        {activeMeshData && (
          <Viewer3D 
            meshData={activeMeshData} 
            hoverState={visualHoverState} 
            mode={currentMode}
          />
        )}
        
        {/* Overlay Instructions */}
        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur text-white p-3 rounded-lg border border-white/10 max-w-xs pointer-events-none">
          <p className="text-xs">
            {isConstructionMode ? (
               <span className="text-emerald-400 font-bold animate-pulse">Modo Construcción Activo</span>
            ) : (
               <span><span className="text-pink-400 font-bold">Interacción:</span> Mueve el ratón sobre las tablas de la derecha para iluminar los componentes.</span>
            )}
          </p>
        </div>
      </div>

      {/* RIGHT SIDEBAR: DATA TABLES */}
      {activeMeshData && (
        <>
           {/* RIGHT RESIZER */}
          <div 
            className="w-1 bg-slate-800 hover:bg-indigo-500 hover:w-1.5 transition-all cursor-col-resize z-50 flex-shrink-0"
            onMouseDown={startResizeRight}
          />

          <div 
            style={{ width: rightWidth }}
            className="flex-shrink-0 bg-slate-900 border-l border-slate-800"
          >
            <InfoPanel 
              meshData={activeMeshData} 
              mode={currentMode} 
              onHover={setHoverState}
              hoverState={visualHoverState} // PASSING HOVER STATE DOWN
            />
          </div>
        </>
      )}

    </div>
  );
}
