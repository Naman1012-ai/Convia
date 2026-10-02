import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { X, Download, ZoomIn, ZoomOut, RotateCcw, ExternalLink } from 'lucide-react';
import { uploadthingService } from '../../services/uploadthingService';

export function FilePreviewModal({ isOpen, onClose, attachment }) {
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    setZoomLevel(1);
  }, [attachment]);

  if (!isOpen || !attachment) return null;

  const filename = attachment.fileName || attachment.filename || 'Attachment';
  const fileUrl = attachment.url || attachment.downloadURL;
  const type = attachment.category || attachment.type || 'file';
  const extension = attachment.extension || 'file';
  const size = attachment.size || 0;

  const isImage = type === 'image';
  const isPdf = extension === 'pdf';

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md font-sans">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 rounded-3xl border border-slate-800 flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header Bar */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-white truncate">{filename}</h3>
            <p className="text-[11px] text-slate-400 font-mono">
              {extension.toUpperCase()} &bull; {uploadthingService.formatFileSize(size)} &bull; UploadThing CDN
            </p>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2">
            {isImage && (
              <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1 text-slate-300">
                <button onClick={handleZoomOut} className="p-1.5 hover:text-white rounded-lg" title="Zoom Out" aria-label="Zoom Out">
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="text-[10px] font-mono font-bold px-1.5">{Math.round(zoomLevel * 100)}%</span>
                <button onClick={handleZoomIn} className="p-1.5 hover:text-white rounded-lg" title="Zoom In" aria-label="Zoom In">
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button onClick={handleResetZoom} className="p-1.5 hover:text-white rounded-lg" title="Reset Zoom" aria-label="Reset Zoom">
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              aria-label="Close Preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Viewport */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center min-h-[400px] bg-slate-950/40">
          {isImage ? (
            <div className="transition-transform duration-200" style={{ transform: `scale(${zoomLevel})` }}>
              <img
                src={fileUrl}
                alt={filename}
                className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-lg"
              />
            </div>
          ) : isPdf ? (
            <iframe
              src={fileUrl}
              title={filename}
              className="w-full h-[70vh] rounded-xl border border-slate-800 bg-white"
            />
          ) : (
            <div className="text-center space-y-3 p-8">
              <p className="text-sm font-bold text-slate-300">Direct preview not available for .{extension} files.</p>
              <button
                onClick={handleDownload}
                className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs"
              >
                Download File to View
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

FilePreviewModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  attachment: PropTypes.object,
};
