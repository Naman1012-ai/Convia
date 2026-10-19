import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  FileText,
  FileCode,
  Archive,
  File,
  Download,
  Eye,
  Maximize2,
  Check,
  Cloud,
  Headphones,
} from 'lucide-react';
import { uploadthingService } from '../../services/uploadthingService';

export function ChatFileCard({ attachment, onOpenPreview = () => {} }) {
  const [downloading, setDownloading] = useState(false);

  if (!attachment) return null;

  const type = attachment.category || attachment.type || 'file';
  const filename = attachment.fileName || attachment.filename || 'Attachment';
  const extension = attachment.extension || 'file';
  const size = attachment.size || 0;
  const fileUrl = attachment.url || attachment.downloadURL;

  const formattedSize = uploadthingService.formatFileSize(size);

  const handleDownload = (e) => {
    e.stopPropagation();
    setDownloading(true);

    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => setDownloading(false), 2000);
  };

  // Render Inline Image Thumbnail
  if (type === 'image') {
    return (
      <div className="mt-2 relative group max-w-sm rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 shadow-sm cursor-pointer" onClick={() => onOpenPreview(attachment)}>
        <img
          src={fileUrl}
          alt={filename}
          loading="lazy"
          className="w-full max-h-64 object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {/* UploadThing Badge & Hover Overlay */}
        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between p-3 text-white">
          <div className="flex items-center gap-1.5 text-xs font-mono truncate max-w-[200px]">
            <Eye className="h-4 w-4 text-primary-400 shrink-0" />
            <span className="truncate">{filename}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-primary-600 text-white transition-colors"
              title="Download Image"
              aria-label="Download Image"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={() => onOpenPreview(attachment)}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-primary-600 text-white transition-colors"
              title="Preview Image"
              aria-label="Preview Image"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Select File Icon
  let FileIcon = File;
  let iconBg = 'bg-slate-100 text-slate-600 border-slate-200';
  if (type === 'document') {
    FileIcon = FileText;
    iconBg = 'bg-rose-50 text-rose-600 border-rose-200';
  } else if (type === 'code') {
    FileIcon = FileCode;
    iconBg = 'bg-primary-50 text-primary-600 border-primary-200';
  } else if (type === 'archive') {
    FileIcon = Archive;
    iconBg = 'bg-amber-50 text-amber-600 border-amber-200';
  } else if (type === 'audio') {
    FileIcon = Headphones;
    iconBg = 'bg-emerald-50 text-emerald-600 border-emerald-200';
  }

  return (
    <div className="mt-2 flex items-center justify-between gap-2.5 sm:gap-4 p-2.5 sm:p-3 w-full max-w-sm sm:max-w-md rounded-2xl border border-slate-200 bg-white hover:border-primary-300 shadow-2xs transition-all overflow-hidden">
      <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
        <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-xl border flex items-center justify-center shrink-0 ${iconBg}`}>
          <FileIcon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>

        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="text-xs font-bold text-slate-900 truncate block w-full" title={filename}>
            {filename}
          </p>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] text-slate-500 font-mono mt-0.5 truncate">
            <span className="uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
              {extension}
            </span>
            <span className="shrink-0">{formattedSize}</span>
            <span className="text-[9px] text-primary-600 font-extrabold hidden sm:inline-flex items-center gap-0.5 shrink-0" title="Stored securely on UploadThing CDN">
              <Cloud className="h-3 w-3" /> UploadThing
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-1 sm:ml-2">
        {extension === 'pdf' && (
          <button
            onClick={() => onOpenPreview(attachment)}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-primary-50 hover:text-primary-600 text-slate-600 transition-colors cursor-pointer"
            title="Preview PDF"
            aria-label="Preview PDF"
          >
            <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        )}

        <button
          onClick={handleDownload}
          disabled={downloading}
          className="p-1.5 sm:p-2 rounded-xl bg-primary-50 hover:bg-primary-600 text-primary-600 hover:text-white transition-colors cursor-pointer"
          title="Download File"
          aria-label="Download File"
        >
          {downloading ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" /> : <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
        </button>
      </div>
    </div>
  );
}

ChatFileCard.propTypes = {
  attachment: PropTypes.object,
  onOpenPreview: PropTypes.func,
};
