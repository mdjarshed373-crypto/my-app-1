import React, { useState, useEffect } from 'react';
import {
  isEmbeddedInIframe,
  breakoutToStandalone,
  getDirectStandaloneUrl,
} from '../../utils/fullscreen';
import { Maximize2, ExternalLink, Copy, Check, X } from 'lucide-react';

export const FullscreenBreakoutBar: React.FC = () => {
  const [inIframe, setInIframe] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const embedded = isEmbeddedInIframe();
    setInIframe(embedded);

    // Attempt automatic breakout on load if browser permits top navigation
    if (embedded) {
      try {
        if (window.top && window.top !== window.self) {
          window.top.location.href = window.location.href;
        }
      } catch {
        // Cross-origin iframe sandbox prevented silent top navigation
      }
    }
  }, []);

  const handleCopyDirectLink = async () => {
    try {
      const url = getDirectStandaloneUrl();
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  if (!inIframe || dismissed) {
    return null;
  }

  return (
    <div className="keep-dark-surface sticky top-0 z-[99] w-full bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 text-black px-3 py-2 text-xs font-semibold shadow-xl border-b border-amber-300/40 flex flex-wrap items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex h-2 w-2 rounded-full bg-black animate-ping shrink-0" />
        <span className="font-gaming uppercase tracking-wider text-[11px] sm:text-xs truncate">
          AI Studio Bar Detected — Open in Fullscreen Play Store App Mode
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
        <button
          type="button"
          onClick={breakoutToStandalone}
          className="px-3 py-1 rounded-lg bg-black hover:bg-slate-900 active:scale-95 text-amber-300 font-black font-gaming text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
          title="Open direct fullscreen standalone app without AI Studio frame"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Launch Fullscreen</span>
        </button>

        <button
          type="button"
          onClick={handleCopyDirectLink}
          className="px-2.5 py-1 rounded-lg bg-black/80 hover:bg-black text-white font-gaming text-xs flex items-center gap-1 cursor-pointer transition-all"
          title="Copy direct standalone URL to share with players"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-300">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="hidden sm:inline">Copy Direct Link</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg hover:bg-black/20 text-black/80 hover:text-black cursor-pointer"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
