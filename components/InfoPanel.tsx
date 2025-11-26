import React, { useState } from 'react';
import { ProcessedMesh, HoverState, StructureMode, Vector3 } from '../types';
import { Box, Layers, Link2, ArrowRight, CornerDownRight, Share2, ArrowLeft } from 'lucide-react';

interface InfoPanelProps {
  meshData: ProcessedMesh;
  mode: StructureMode;
  onHover: (state: HoverState | null) => void;
  hoverState: HoverState | null;
}

// Tooltip State
interface TooltipData {
  text: string;
  x: number;
  y: number;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ meshData, mode, onHover, hoverState }) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // --- Helpers ---
  
  const handleCellEnter = (
    e: React.MouseEvent, 
    tip: string, 
    highlight?: { type: HoverState['type'], id: number }
  ) => {
    e.stopPropagation(); // Prevent row hover triggers
    setTooltip({ text: tip, x: e.clientX, y: e.clientY });
    if (highlight) {
      onHover(highlight);
    }
  };

  const handleCellLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTooltip(null);
    // Note: We don't force null hover here, we let the Row or Container handle it,
    // otherwise moving between cells flickers.
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (tooltip) {
      setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    }
  }

  // --- Components ---

  const TableRow: React.FC<{ 
    children: React.ReactNode, 
    onEnter?: () => void, 
    onLeave?: () => void,
    isActive?: boolean,
    className?: string
  }> = ({ children, onEnter, onLeave, isActive, className = "" }) => (
    <tr 
      className={`
        border-b border-slate-700/50 
        transition-all duration-150 cursor-pointer text-xs font-mono group relative
        ${isActive ? 'bg-indigo-600/30 border-l-4 border-l-secondary' : 'hover:bg-indigo-900/30 hover:border-l-4 hover:border-l-indigo-400'}
        ${className}
      `}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children}
    </tr>
  );

  const Cell: React.FC<{ 
    children: React.ReactNode, 
    className?: string,
    tooltip?: string,
    highlight?: { type: HoverState['type'], id: number } 
  }> = ({ children, className="", tooltip: tip, highlight }) => {
    
    // Check if this cell's data is the one being globally highlighted
    const isHighlightMatch = highlight && hoverState && hoverState.type === highlight.type && hoverState.id === highlight.id;

    return (
      <td 
        className={`p-2 transition-colors ${className} ${isHighlightMatch ? 'bg-white/10 ring-1 ring-white/20' : ''}`}
        onMouseEnter={(e) => tip ? handleCellEnter(e, tip, highlight) : undefined}
        onMouseLeave={tip ? handleCellLeave : undefined}
      >
        {children}
      </td>
    );
  };

  const Header: React.FC<{ children: React.ReactNode, className?: string, tooltip?: string }> = ({ children, className="", tooltip: tip }) => (
    <th 
      className={`p-2 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky top-0 bg-slate-900/95 backdrop-blur z-10 border-b border-slate-700 ${className} cursor-help`}
      onMouseEnter={(e) => tip ? setTooltip({ text: tip, x: e.clientX, y: e.clientY }) : undefined}
      onMouseLeave={() => setTooltip(null)}
    >
      {children}
    </th>
  );

  const Coord: React.FC<{ v: Vector3, label?: string }> = ({ v, label }) => (
    <div className="flex gap-1 items-center whitespace-nowrap">
      {label && <span className="text-gray-500 mr-1">{label}:</span>}
      <span className="opacity-50 text-[9px]">[</span>
      <span className="text-cyan-300">{v.x}</span>, 
      <span className="text-cyan-300">{v.y}</span>, 
      <span className="text-cyan-300">{v.z}</span>
      <span className="opacity-50 text-[9px]">]</span>
    </div>
  );

  // --- Table Renderers ---

  const renderVerticesTable = (className: string = "flex-1") => {
    const showIncEdge = mode === 'wingededge';
    const showIncHE = mode === 'halfedge';

    return (
      <div className={`${className} overflow-auto border-b border-slate-700 pb-2 scrollbar-thin`}>
        <h3 className="p-2 text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2 sticky top-0 bg-slate-900 z-20 border-b border-slate-800">
          <Box size={12} /> Array Vértices
        </h3>
        <table className="w-full text-left" onMouseMove={handleMouseMove}>
          <thead>
            <tr>
              <Header tooltip="Identificador único del vértice en el array global.">ID</Header>
              <Header tooltip="Posición espacial (X, Y, Z) del vértice.">Coordenadas</Header>
              {showIncEdge && <Header tooltip="Referencia a una arista (cualquiera) conectada a este vértice.">Inc. Arista</Header>}
              {showIncHE && <Header tooltip="Referencia a una media-arista que tiene este vértice como Origen.">Inc. 1/2 Arista</Header>}
            </tr>
          </thead>
          <tbody>
            {meshData.vertices.map((v) => (
              <TableRow 
                key={v.id}
                isActive={hoverState?.type === 'vertex' && hoverState.id === v.id}
                onEnter={() => onHover({ type: 'vertex', id: v.id })}
                onLeave={() => onHover(null)}
              >
                <Cell 
                  className="text-secondary font-bold group-hover:text-white"
                  tooltip={`Vértice ${v.id}`}
                >
                  {v.id}
                </Cell>
                <Cell 
                  className="text-slate-300"
                  tooltip={`Coordenadas espaciales del vértice ${v.id}`}
                >
                  <span className="opacity-50">[</span>
                  <span className="text-cyan-300">{v.x}</span>, <span className="text-cyan-300">{v.y}</span>, <span className="text-cyan-300">{v.z}</span>
                  <span className="opacity-50">]</span>
                </Cell>
                
                {showIncEdge && (
                  <Cell 
                    className="text-orange-400 font-bold"
                    tooltip={`Puntero a la Arista Alada ${v.incidentEdge} conectada a este vértice.`}
                    highlight={v.incidentEdge !== undefined ? { type: 'edge', id: v.incidentEdge } : undefined}
                  >
                    {v.incidentEdge ?? '-'}
                  </Cell>
                )}
                {showIncHE && (
                  <Cell 
                    className="text-yellow-400 font-bold"
                    tooltip={`Puntero a la Media Arista ${v.incidentHalfEdge} que nace en este vértice.`}
                    highlight={v.incidentHalfEdge !== undefined ? { type: 'halfedge', id: v.incidentHalfEdge } : undefined}
                  >
                     {v.incidentHalfEdge ?? '-'}
                  </Cell>
                )}

              </TableRow>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderFacesTable = (className: string = "flex-1") => {
    const isIndexed = mode === 'indexed';
    const showIncEdge = mode === 'wingededge';
    const showIncHE = mode === 'halfedge';

    return (
      <div className={`${className} overflow-auto scrollbar-thin`}>
        <h3 className="p-2 text-xs font-bold text-pink-400 uppercase tracking-widest flex items-center gap-2 sticky top-0 bg-slate-900 z-20 border-b border-slate-800">
          <Layers size={12} /> Array Caras
        </h3>
        <table className="w-full text-left" onMouseMove={handleMouseMove}>
          <thead>
            <tr>
              <Header tooltip="Identificador único de la cara (triángulo).">ID</Header>
              {isIndexed && (
                <>
                  <Header tooltip="Índice del primer vértice que forma esta cara.">V1</Header>
                  <Header tooltip="Índice del segundo vértice que forma esta cara.">V2</Header>
                  <Header tooltip="Índice del tercer vértice que forma esta cara.">V3</Header>
                </>
              )}
              {showIncEdge && <Header tooltip="Referencia a una de las aristas que bordean esta cara.">Inc. Arista</Header>}
              {showIncHE && <Header tooltip="Referencia a una de las medias-aristas interiores a esta cara.">Inc. 1/2 Arista</Header>}
            </tr>
          </thead>
          <tbody>
            {meshData.faces.map((f) => (
              <TableRow 
                key={f.id}
                isActive={hoverState?.type === 'face' && hoverState.id === f.id}
                onEnter={() => onHover({ type: 'face', id: f.id })}
                onLeave={() => onHover(null)}
              >
                <Cell 
                  className="text-pink-400 font-bold group-hover:text-white"
                  tooltip={`Cara ${f.id}`}
                >
                    {f.id}
                </Cell>
                
                {isIndexed && (
                  <>
                    <Cell 
                        className="group-hover:text-cyan-300"
                        tooltip={`Vértice 1 de la cara ${f.id} -> Apunta al Vértice ${f.v1}`}
                        highlight={{ type: 'vertex', id: f.v1 }}
                    >
                        {f.v1}
                    </Cell>
                    <Cell 
                        className="group-hover:text-cyan-300"
                        tooltip={`Vértice 2 de la cara ${f.id} -> Apunta al Vértice ${f.v2}`}
                        highlight={{ type: 'vertex', id: f.v2 }}
                    >
                        {f.v2}
                    </Cell>
                    <Cell 
                        className="group-hover:text-cyan-300"
                        tooltip={`Vértice 3 de la cara ${f.id} -> Apunta al Vértice ${f.v3}`}
                        highlight={{ type: 'vertex', id: f.v3 }}
                    >
                        {f.v3}
                    </Cell>
                  </>
                )}

                {showIncEdge && (
                  <Cell 
                    className="text-orange-400 font-bold"
                    tooltip={`Arista incidente en la cara ${f.id} -> Apunta a Arista ${f.incidentEdge}`}
                    highlight={f.incidentEdge !== undefined ? { type: 'edge', id: f.incidentEdge } : undefined}
                  >
                    {f.incidentEdge ?? '-'}
                  </Cell>
                )}
                {showIncHE && (
                  <Cell 
                    className="text-yellow-400 font-bold"
                    tooltip={`Media Arista incidente en la cara ${f.id} -> Apunta a HalfEdge ${f.incidentHalfEdge}`}
                    highlight={f.incidentHalfEdge !== undefined ? { type: 'halfedge', id: f.incidentHalfEdge } : undefined}
                  >
                    {f.incidentHalfEdge ?? '-'}
                  </Cell>
                )}

              </TableRow>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // --- View Implementations ---

  const renderSoupView = () => (
    <div className="overflow-auto h-full scrollbar-thin">
      <div className="p-2 mb-2 bg-indigo-900/20 border border-indigo-500/30 rounded text-[10px] text-indigo-300">
        Triángulos independientes. Cada fila contiene los datos de los 3 vértices. Sin referencias a índices.
      </div>
      <table className="w-full text-left border-collapse" onMouseMove={handleMouseMove}>
        <thead>
          <tr>
            <Header tooltip="Identificador del triángulo en la sopa.">Triángulo</Header>
            <Header tooltip="Coordenadas explícitas de los 3 vértices que lo componen.">Vértices (x, y, z)</Header>
          </tr>
        </thead>
        <tbody>
          {meshData.soupTriangles?.map((t) => {
            return (
              <TableRow 
                key={t.id}
                isActive={hoverState?.type === 'face' && hoverState.id === t.id}
                onEnter={() => onHover({ type: 'face', id: t.id })} 
                onLeave={() => onHover(null)}
              >
                <Cell 
                    className="text-secondary font-bold group-hover:text-white align-top"
                    tooltip={`Triángulo ${t.id} - Haga hover para ver sus vértices.`}
                >
                  <span className="bg-slate-800 px-1 rounded">{t.id}</span>
                </Cell>
                <Cell className="text-slate-300 space-y-1" tooltip={`Datos de coordenadas para el Triángulo ${t.id}. No comparten memoria con otros triángulos.`}>
                  <Coord v={t.v1} label="v1" />
                  <Coord v={t.v2} label="v2" />
                  <Coord v={t.v3} label="v3" />
                </Cell>
              </TableRow>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderIndexedView = () => (
    <div className="flex flex-col h-full gap-4">
      {renderVerticesTable()}
      {renderFacesTable()}
    </div>
  );

  const renderWingedEdgeView = () => (
    <div className="flex flex-col h-full gap-2">
      <div className="flex-1 overflow-auto scrollbar-thin min-h-[150px] border-b border-slate-700 pb-2">
        <h3 className="p-2 text-xs font-bold text-orange-400 uppercase tracking-widest flex items-center gap-2 sticky top-0 bg-slate-900 z-20 border-b border-slate-800">
          <Share2 size={12} /> Aristas (Winged)
        </h3>
        <div className="p-2 mb-2 bg-indigo-900/20 border border-indigo-500/30 rounded text-[10px] text-indigo-300">
           <span className="text-emerald-400 font-bold">Verde = Izquierda</span> / <span className="text-blue-400 font-bold">Azul = Derecha</span>
        </div>
        <table className="w-full text-left" onMouseMove={handleMouseMove}>
          <thead>
            <tr>
              <Header tooltip="Identificador único de la arista.">ID</Header>
              <Header tooltip="Vértice inicial de la arista.">Start</Header>
              <Header tooltip="Vértice final de la arista.">End</Header>
              <Header className="text-emerald-500" tooltip="Cara situada a la IZQUIERDA (recorriendo Start->End).">L Face</Header>
              <Header className="text-emerald-500" tooltip="Arista PREDECESORA en el ciclo de la cara IZQUIERDA.">Pred L</Header>
              <Header className="text-emerald-500" tooltip="Arista SUCESORA en el ciclo de la cara IZQUIERDA.">Succ L</Header>
              <Header className="text-blue-500" tooltip="Cara situada a la DERECHA (recorriendo Start->End).">R Face</Header>
              <Header className="text-blue-500" tooltip="Arista PREDECESORA en el ciclo de la cara DERECHA.">Pred R</Header>
              <Header className="text-blue-500" tooltip="Arista SUCESORA en el ciclo de la cara DERECHA.">Succ R</Header>
            </tr>
          </thead>
          <tbody>
            {meshData.edges?.map((e) => (
              <TableRow 
                key={e.id}
                isActive={hoverState?.type === 'edge' && hoverState.id === e.id}
                onEnter={() => onHover({ type: 'edge', id: e.id })}
                onLeave={() => onHover(null)}
              >
                <Cell className="text-secondary font-bold group-hover:text-white" tooltip={`Arista Alada ID ${e.id}`}>
                  {e.id}
                </Cell>
                <Cell 
                    className="text-slate-400 group-hover:text-white"
                    tooltip={`Vértice Inicial: Apunta a Vértice ${e.startVertex}`}
                    highlight={{ type: 'vertex', id: e.startVertex }}
                >
                    {e.startVertex}
                </Cell>
                <Cell 
                    className="text-slate-400 group-hover:text-white"
                    tooltip={`Vértice Final: Apunta a Vértice ${e.endVertex}`}
                    highlight={{ type: 'vertex', id: e.endVertex }}
                >
                    {e.endVertex}
                </Cell>
                
                {/* Left Face Info */}
                <Cell 
                    className={e.faceLeft === -1 ? "text-slate-600" : "text-emerald-400 font-bold"}
                    tooltip={`Cara Izquierda: Apunta a Cara ${e.faceLeft}`}
                    highlight={e.faceLeft !== -1 ? { type: 'face', id: e.faceLeft } : undefined}
                >
                  {e.faceLeft}
                </Cell>
                <Cell 
                    className="text-emerald-600/80 text-[10px]"
                    tooltip={`Arista Predecesora (Izq): Apunta a Arista ${e.predLeft}`}
                    highlight={e.predLeft !== -1 ? { type: 'edge', id: e.predLeft } : undefined}
                >
                  {e.predLeft !== -1 ? e.predLeft : '-'}
                </Cell>
                <Cell 
                    className="text-emerald-600/80 text-[10px]"
                    tooltip={`Arista Sucesora (Izq): Apunta a Arista ${e.succLeft}`}
                    highlight={e.succLeft !== -1 ? { type: 'edge', id: e.succLeft } : undefined}
                >
                  {e.succLeft !== -1 ? e.succLeft : '-'}
                </Cell>

                {/* Right Face Info */}
                <Cell 
                    className={e.faceRight === -1 ? "text-slate-600" : "text-blue-400 font-bold"}
                    tooltip={`Cara Derecha: Apunta a Cara ${e.faceRight}`}
                    highlight={e.faceRight !== -1 ? { type: 'face', id: e.faceRight } : undefined}
                >
                  {e.faceRight}
                </Cell>
                <Cell 
                    className="text-blue-500/80 text-[10px]"
                    tooltip={`Arista Predecesora (Der): Apunta a Arista ${e.predRight}`}
                    highlight={e.predRight !== -1 ? { type: 'edge', id: e.predRight } : undefined}
                >
                  {e.predRight !== -1 ? e.predRight : '-'}
                </Cell>
                 <Cell 
                    className="text-blue-500/80 text-[10px]"
                    tooltip={`Arista Sucesora (Der): Apunta a Arista ${e.succRight}`}
                    highlight={e.succRight !== -1 ? { type: 'edge', id: e.succRight } : undefined}
                 >
                  {e.succRight !== -1 ? e.succRight : '-'}
                </Cell>

              </TableRow>
            ))}
          </tbody>
        </table>
      </div>
      {renderVerticesTable("h-1/4")}
      {renderFacesTable("h-1/4")}
    </div>
  );

  const renderHalfEdgeView = () => (
    <div className="flex flex-col h-full gap-2">
      <div className="flex-1 overflow-auto scrollbar-thin min-h-[150px] border-b border-slate-700 pb-2">
        <h3 className="p-2 text-xs font-bold text-yellow-400 uppercase tracking-widest flex items-center gap-2 sticky top-0 bg-slate-900 z-20 border-b border-slate-800">
          <CornerDownRight size={12} /> Medias Aristas (DCEL)
        </h3>
        <div className="p-2 mb-2 bg-indigo-900/20 border border-indigo-500/30 rounded text-[10px] text-indigo-300">
          Estructura dirigida. Orden: Start, End, Face, Prev, Next, Twin.
        </div>
        <table className="w-full text-left" onMouseMove={handleMouseMove}>
          <thead>
            <tr>
              <Header tooltip="Identificador único de la Media Arista.">ID</Header>
              <Header tooltip="Vértice Origen de esta media arista.">Start</Header>
              <Header tooltip="Vértice Destino (apuntado por la media arista).">End</Header>
              <Header tooltip="Cara a la que pertenece (limita) esta media arista.">Face</Header>
              <Header className="text-rose-500" tooltip="Media Arista ANTERIOR en el ciclo de esta cara.">Prev</Header>
              <Header className="text-sky-500" tooltip="Media Arista SIGUIENTE en el ciclo de esta cara.">Next</Header>
              <Header tooltip="Media Arista GEMELA (dirección opuesta, cara adyacente).">Twin</Header>
            </tr>
          </thead>
          <tbody>
            {meshData.halfEdges?.map((he) => (
              <TableRow 
                key={he.id}
                isActive={hoverState?.type === 'halfedge' && hoverState.id === he.id}
                onEnter={() => onHover({ type: 'halfedge', id: he.id })}
                onLeave={() => onHover(null)}
              >
                <Cell className="text-secondary font-bold group-hover:text-white" tooltip={`Half-Edge ID ${he.id}`}>
                    {he.id}
                </Cell>
                <Cell 
                    className="text-emerald-400"
                    tooltip={`Vértice Origen: Apunta a Vértice ${he.originVertex}`}
                    highlight={{ type: 'vertex', id: he.originVertex }}
                >
                    {he.originVertex}
                </Cell>
                <Cell 
                    className="text-emerald-400"
                    tooltip={`Vértice Destino: Apunta a Vértice ${he.targetVertex}`}
                    highlight={{ type: 'vertex', id: he.targetVertex }}
                >
                    {he.targetVertex}
                </Cell>
                <Cell 
                    className="text-amber-400"
                    tooltip={`Cara incidente: Apunta a Cara ${he.face}`}
                    highlight={{ type: 'face', id: he.face }}
                >
                    {he.face}
                </Cell>
                
                <Cell 
                    className="text-rose-400 font-bold whitespace-nowrap"
                    tooltip={`Anterior: Apunta a Half-Edge ${he.prev}`}
                    highlight={{ type: 'halfedge', id: he.prev }}
                >
                   <div className="flex items-center gap-1">
                    <ArrowLeft size={10} strokeWidth={3} /> {he.prev}
                   </div>
                </Cell>

                <Cell 
                    className="text-sky-400 font-bold whitespace-nowrap"
                    tooltip={`Siguiente: Apunta a Half-Edge ${he.next}`}
                    highlight={{ type: 'halfedge', id: he.next }}
                >
                   <div className="flex items-center gap-1">
                    {he.next} <ArrowRight size={10} strokeWidth={3} />
                   </div>
                </Cell>

                <Cell 
                    className={he.twin === null ? "text-slate-600" : "text-blue-400 font-bold group-hover:underline decoration-blue-500/50"}
                    tooltip={he.twin !== null ? `Gemela: Apunta a Half-Edge ${he.twin}` : "Sin gemela (borde)"}
                    highlight={he.twin !== null ? { type: 'halfedge', id: he.twin } : undefined}
                >
                  {he.twin ?? '-'}
                </Cell>
              </TableRow>
            ))}
          </tbody>
        </table>
      </div>
      {renderVerticesTable("h-1/4")}
      {renderFacesTable("h-1/4")}
    </div>
  );

  return (
    <div 
      className="h-full flex flex-col bg-slate-900 border-l border-slate-800 w-full shadow-[shadow: -5px 0 15px rgba(0,0,0,0.5)] z-30 relative"
      onMouseLeave={() => {
        setTooltip(null);
        onHover(null);
      }}
    >
      <div className="p-4 border-b border-slate-800 bg-slate-900">
        <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-widest">
          <Link2 className="text-secondary" size={16} /> Data Inspector
        </h2>
        <div className="flex items-center gap-2 mt-2">
           <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] text-indigo-400 font-mono">
             {mode.toUpperCase()} MODE
           </span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-0 bg-slate-900/50">
        {mode === 'soup' && renderSoupView()}
        {mode === 'indexed' && renderIndexedView()}
        {mode === 'wingededge' && renderWingedEdgeView()}
        {mode === 'halfedge' && renderHalfEdgeView()}
      </div>

      {/* GLOBAL TOOLTIP */}
      {tooltip && (
        <div 
            className="fixed z-50 pointer-events-none px-3 py-2 bg-slate-800/95 backdrop-blur border border-indigo-500/50 text-indigo-100 text-xs rounded shadow-2xl max-w-[250px] leading-relaxed"
            style={{ 
                left: tooltip.x + 15, 
                top: tooltip.y + 15,
            }}
        >
            {tooltip.text}
        </div>
      )}
    </div>
  );
};