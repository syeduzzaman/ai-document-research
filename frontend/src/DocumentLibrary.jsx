import { useRef, useState } from "react";
import { ChevronDown, FileText, Search, Trash2, Upload } from "lucide-react";
import { Button } from "./ui";

export default function DocumentLibrary({ documents, selected, onSelect, onClear, onUpload, onDelete, disabled, uploading }) {
  const input = useRef(null);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(false);
  const files = documents.filter((file) => file.filename.toLowerCase().includes(filter.trim().toLowerCase()));

  return <aside className="min-w-0 self-start xl:sticky xl:top-6" aria-label="Document library">
    <div className="panel px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          Documents <span className="rounded-md bg-mint px-1.5 py-0.5 text-xs text-forest">{documents.length}</span>
        </h2>
        <Button variant="quiet" className="xl:hidden" aria-expanded={expanded}
          aria-controls="library-files" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Hide files" : selected.length ? `${selected.length} selected` : "Show files"}
          <ChevronDown aria-hidden="true" size={16} className={expanded ? "rotate-180" : ""} />
        </Button>
      </div>
      <input ref={input} type="file" aria-label="Upload document" accept=".pdf,.txt,.md" className="sr-only"
        disabled={disabled} tabIndex={-1} onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onUpload(file);
          event.target.value = "";
        }} />
      <div className={`${expanded ? "block" : "hidden"} xl:block`} id="library-files">
        <Button className="mt-4 w-full" onClick={() => input.current?.click()} disabled={disabled}>
          <Upload size={16} aria-hidden="true" />{uploading ? "Indexing document…" : "Upload document"}
        </Button>
        <p className="mt-2 text-center text-xs text-muted">PDF, TXT, Markdown · Up to 10 MiB</p>
        {documents.length > 0 && <label className="relative mt-4 block">
          <Search className="pointer-events-none absolute top-2.5 left-3 text-muted" size={16} aria-hidden="true" />
          <input type="search" aria-label="Filter documents" value={filter} onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter by filename" className="field w-full py-2 pl-9 text-sm" />
        </label>}
        <div className="flex min-h-10 items-center justify-between gap-2 pt-2 text-xs text-muted" aria-live="polite">
          <span>{selected.length ? `${selected.length} selected` : "Search spans all documents"}</span>
          {selected.length > 0 && <Button variant="quiet" className="text-xs" onClick={onClear}>Clear</Button>}
        </div>
        <div className="max-h-[40dvh] space-y-1.5 overflow-y-auto p-0.5">
          {files.map((file) => <div key={file.id} className="flex items-center gap-1 rounded-lg border border-line bg-white p-1.5 has-checked:border-teal-300 has-checked:bg-mint">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 p-1.5">
              <input type="checkbox" checked={selected.includes(file.id)}
                disabled={selected.length >= 20 && !selected.includes(file.id)} onChange={() => onSelect(file.id)}
                className="size-4 shrink-0 accent-[var(--color-forest)]" />
              <FileText className="shrink-0 text-forest" size={16} aria-hidden="true" />
              <span className="min-w-0">
                <strong title={file.filename} className="block truncate text-xs font-semibold">{file.filename}</strong>
                <span className="mt-0.5 block text-xs text-muted">{file.chunk_count} {file.chunk_count === 1 ? "passage" : "passages"}</span>
              </span>
            </label>
            <Button variant="quiet" className="min-w-8 px-1.5! hover:text-red-700" disabled={disabled}
              aria-label={`Delete ${file.filename}`} onClick={() => onDelete(file)}>
              <Trash2 size={15} aria-hidden="true" />
            </Button>
          </div>)}
          {files.length === 0 && <p className="p-2 text-sm text-muted">
            {documents.length ? "No files match this filter." : "Upload a document to start searching."}
          </p>}
        </div>
        {selected.length === 20 && <p className="mt-2 text-xs text-muted">Selection limit reached. Clear a selection to add another.</p>}
      </div>
    </div>
  </aside>;
}
