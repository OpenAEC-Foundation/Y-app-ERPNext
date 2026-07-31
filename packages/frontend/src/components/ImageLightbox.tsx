/**
 * Fullscreen image overlay. Used when the user clicks an image-attachment
 * in Messenger (and later: Webmail). Replaces the previous behavior of
 * opening the image in a new browser tab, which broke flow on desktop
 * (extra tab) and was unusable on mobile (file-download instead of view).
 *
 * Closes on: ESC, click outside image, click X-button.
 * Supports: download via toolbar, filename caption.
 */
import { useEffect } from "react";
import { X, Download } from "lucide-react";

interface ImageLightboxProps {
  imageUrl: string;
  filename?: string;
  /** Optional separate URL for download (e.g. full-res when imageUrl is a preview). */
  downloadUrl?: string;
  onClose: () => void;
}

export default function ImageLightbox({ imageUrl, filename, downloadUrl, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div
        className="absolute top-3 right-3 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {(downloadUrl || imageUrl) && (
          <a
            href={downloadUrl || imageUrl}
            download={filename || true}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            title="Download"
          >
            <Download size={18} />
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
          title="Sluiten (Esc)"
        >
          <X size={18} />
        </button>
      </div>

      {/* Image */}
      <img
        src={imageUrl}
        alt={filename || ""}
        className="max-w-[95vw] max-h-[90vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Caption */}
      {filename && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs max-w-[80vw] truncate"
          onClick={(e) => e.stopPropagation()}
        >
          {filename}
        </div>
      )}
    </div>
  );
}
