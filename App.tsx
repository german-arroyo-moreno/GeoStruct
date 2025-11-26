import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ShapeType, StructureMode, ProcessedMesh, HoverState } from './types';
import { analyzeGeometry } from './utils/geometryUtils';
import { Viewer3D } from './components/Viewer3D';
import { InfoPanel } from './components/InfoPanel';
import { Cuboid, Circle, Donut, Database, Code, GitBranch, Share2 } from 'lucide-react';

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
  const [meshData, setMeshData] = useState<ProcessedMesh | null>(null);

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
    setMeshData(data);

    return () => { geo.dispose(); }
  }, [currentShape]);

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

          <section className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <h4 className="text-xs font-bold text-slate-300 mb-2">Estadísticas</h4>
            {meshData && (
               <div className="space-y-1 text-xs text-slate-400 font-mono">
                 <div className="flex justify-between"><span>Vértices:</span> <span className="text-white">{meshData.vertices.length}</span></div>
                 <div className="flex justify-between"><span>Caras:</span> <span className="text-white">{meshData.faces.length}</span></div>
                 <div className="flex justify-between"><span>Aristas (aprox):</span> <span className="text-white">{meshData.edges?.length || '-'}</span></div>
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
        {meshData && (
          <Viewer3D 
            meshData={meshData} 
            hoverState={hoverState} 
            mode={currentMode}
          />
        )}
        
        {/* Overlay Instructions */}
        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur text-white p-3 rounded-lg border border-white/10 max-w-xs pointer-events-none">
          <p className="text-xs">
            <span className="text-pink-400 font-bold">Interacción:</span> Mueve el ratón sobre las tablas de la derecha para iluminar los componentes (Vértices, Aristas, Caras) en el modelo 3D.
          </p>
        </div>
      </div>

      {/* RIGHT SIDEBAR: DATA TABLES */}
      {meshData && (
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
              meshData={meshData} 
              mode={currentMode} 
              onHover={setHoverState}
              hoverState={hoverState} // PASSING HOVER STATE DOWN
            />
          </div>
        </>
      )}

    </div>
  );
}