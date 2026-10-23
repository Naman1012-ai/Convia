import React, { useEffect, useRef, useState, useId } from 'react';
import PropTypes from 'prop-types';
import mermaid from 'mermaid';
import { Copy, Check, AlertCircle, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';

// Initialize mermaid with Convia dark slate aesthetic
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    darkMode: true,
    background: '#090d16',
    primaryColor: '#7c3aed',
    primaryTextColor: '#f8fafc',
    primaryBorderColor: '#a78bfa',
    lineColor: '#38bdf8',
    secondaryColor: '#0f172a',
    tertiaryColor: '#1e293b',
  },
  securityLevel: 'loose',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
});

export function MermaidDiagram({ chart, title = 'Architecture Diagram' }) {
  const containerRef = useRef(null);
  const [svgContent, setSvgContent] = useState('');
  const [renderError, setRenderError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const uniqueId = useId().replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    let active = true;

    async function renderChart() {
      if (!chart || !chart.trim()) {
        setSvgContent('');
        setRenderError(null);
        return;
      }

      try {
        setRenderError(null);
        const renderId = `mermaid_${uniqueId}_${Date.now()}`;
        const { svg } = await mermaid.render(renderId, chart);
        if (active) {
          setSvgContent(svg);
        }
      } catch (err) {
        console.warn('[MermaidDiagram] Render warning:', err);
        if (active) {
          setRenderError(err.message || 'Could not parse diagram syntax.');
        }
      }
    }

    renderChart();

    return () => {
      active = false;
    };
  }, [chart, uniqueId]);

  const handleCopy = () => {
    if (!chart) return;
    navigator.clipboard.writeText(chart).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleZoom = (delta) => {
    setZoomLevel((prev) => Math.min(Math.max(0.6, prev + delta), 1.8));
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/90 overflow-hidden shadow-xl">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/80 bg-slate-900/60 text-xs">
        <span className="font-extrabold text-slate-200 tracking-tight flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary-400" />
          {title}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleZoom(-0.15)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-500 w-9 text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            type="button"
            onClick={() => handleZoom(0.15)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <div className="h-3.5 w-px bg-slate-800 mx-1" />
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Copy Diagram Source Code"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Diagram Canvas */}
      <div className="p-4 overflow-x-auto min-h-[260px] flex items-center justify-center">
        {renderError ? (
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-2 max-w-md">
            <AlertCircle className="h-6 w-6 text-amber-400" />
            <p className="text-xs font-semibold text-slate-300">Visual Diagram Preview</p>
            <pre className="text-[10px] font-mono p-3 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 text-left overflow-x-auto max-w-full">
              {chart}
            </pre>
          </div>
        ) : svgContent ? (
          <div
            ref={containerRef}
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center', transition: 'transform 0.15s ease' }}
            className="w-full flex justify-center py-2 [&>svg]:max-w-full [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 py-12">
            <RefreshCw className="h-4 w-4 animate-spin text-primary-400" />
            Synthesizing visual architecture topology...
          </div>
        )}
      </div>
    </div>
  );
}

MermaidDiagram.propTypes = {
  chart: PropTypes.string.isRequired,
  title: PropTypes.string,
};
