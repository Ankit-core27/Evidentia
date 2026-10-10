import React, { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, UploadCloud, X } from 'lucide-react';
import { useUploadEvidence } from '@/hooks/useEvidence';
import { formatBytes } from '@/lib/format';
import { Id } from '@/types/api';

interface UploadItem {
  key: string;
  name: string;
  size: number;
  status: 'uploading' | 'done' | 'failed';
  error?: string;
}

/**
 * Drop zone and file picker for a case. Each file is its own request, so one bad file
 * doesn't block the rest and each shows its own result.
 */
export const EvidenceUploader: React.FC<{ caseId: Id }> = ({ caseId }) => {
  const upload = useUploadEvidence(caseId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);

  const setItem = (key: string, patch: Partial<UploadItem>) =>
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const uploadFiles = async (list: FileList | null) => {
    const files = list ? [...list] : [];
    if (!files.length) return;
    const batch = files.map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`,
      name: file.name,
      size: file.size,
      status: 'uploading' as const
    }));
    setItems((prev) => [...batch, ...prev]);
    await Promise.all(
      files.map(async (file, i) => {
        try {
          await upload.mutateAsync([file]);
          setItem(batch[i].key, { status: 'done' });
        } catch (error) {
          setItem(batch[i].key, { status: 'failed', error: error instanceof Error ? error.message : 'Upload failed' });
        }
      })
    );
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void uploadFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 transition-all ${
          dragging ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/60'
        }`}
      >
        <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
          <UploadCloud className="w-5 h-5" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <p className="text-xs font-bold text-slate-200 uppercase">Drop evidence files here</p>
          <p className="text-[11px] text-slate-400">
            PDFs, Word documents, text, photos, audio and short videos. Each original is stored and hashed, then processed for text and AI proposals.
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 shrink-0"
        >
          Select files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          data-testid="evidence-upload-input"
          onChange={(e) => {
            void uploadFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Uploads</span>
            {items.every((i) => i.status !== 'uploading') && (
              <button onClick={() => setItems([])} className="hover:text-slate-200 flex items-center gap-1">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          {items.map((item) => (
            <div
              key={item.key}
              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center gap-2"
              data-testid="upload-row"
            >
              {item.status === 'uploading' && <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />}
              {item.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              {item.status === 'failed' && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
              <span className="text-slate-200 truncate">{item.name}</span>
              <span className="text-[10px] text-slate-500 shrink-0">{formatBytes(item.size)}</span>
              <span className={`ml-auto text-[10px] shrink-0 ${item.status === 'failed' ? 'text-red-300' : 'text-slate-400'}`}>
                {item.status === 'uploading' ? 'Uploading…' : item.status === 'done' ? 'Uploaded' : item.error}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
