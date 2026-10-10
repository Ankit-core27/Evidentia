import React, { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, UploadCloud, X } from 'lucide-react';
import { useUploadEvidence } from '@/hooks/useEvidence';
import { secondaryButtonClass } from '@/components/shared/formStyles';
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
    <div className="space-y-2">
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
        className={`border border-dashed rounded-md px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors ${
          dragging ? 'border-accent bg-accent/10' : 'border-control/60'
        }`}
      >
        <UploadCloud className="hidden sm:block size-5 text-ink-muted shrink-0" aria-hidden />
        <div className="flex-1">
          <p className="text-body text-ink">
            {dragging ? 'Drop to upload' : 'Drop evidence files here, or choose them'}
          </p>
          <p className="text-xs text-ink-muted">
            PDF, Word, text, photos, audio and short video. Each original is stored and hashed, then read for text and AI proposals.
          </p>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} className={`${secondaryButtonClass} shrink-0 self-start sm:self-auto`}>
          Choose files
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
        <div className="rounded-md border border-line">
          <div className="flex items-center justify-between px-3 h-8 border-b border-line text-xs text-ink-muted">
            <span>Uploads</span>
            {items.every((i) => i.status !== 'uploading') && (
              <button onClick={() => setItems([])} className="hover:text-ink flex items-center gap-1">
                <X className="size-3" aria-hidden /> Clear
              </button>
            )}
          </div>
          <ul className="divide-y divide-line" aria-live="polite">
            {items.map((item) => (
              <li key={item.key} className="px-3 py-1.5 text-body flex items-center gap-2" data-testid="upload-row">
                {item.status === 'uploading' && <Loader2 className="size-3.5 text-accent-text animate-spin shrink-0" aria-hidden />}
                {item.status === 'done' && <CheckCircle2 className="size-3.5 text-ok shrink-0" aria-hidden />}
                {item.status === 'failed' && <AlertTriangle className="size-3.5 text-danger shrink-0" aria-hidden />}
                <span className="text-ink truncate">{item.name}</span>
                <span className="font-mono text-2xs text-ink-muted shrink-0">{formatBytes(item.size)}</span>
                <span className={`ml-auto text-xs shrink-0 ${item.status === 'failed' ? 'text-danger' : 'text-ink-muted'}`}>
                  {item.status === 'uploading' ? 'Uploading…' : item.status === 'done' ? 'Uploaded' : item.error}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
