import { AlertCircle, Bookmark, Check, ChevronDown, FileText, LoaderCircle } from "lucide-react";

export function Button({ variant = "secondary", className = "", type = "button", ...props }) {
  return <button type={type} className={`button button-${variant} ${className}`} {...props} />;
}

export function PageTitle({ title, children }) {
  return <div className="mb-7">
    <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-[2.55rem]">{title}</h1>
    {children && <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">{children}</p>}
  </div>;
}

export function ErrorMessage({ children }) {
  return <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
    <AlertCircle aria-hidden="true" size={17} className="mt-0.5 shrink-0" />
    <span>{children}</span>
  </div>;
}

export function Loading({ children }) {
  return <p role="status" className="flex items-center gap-2 px-1 py-5 text-sm text-muted">
    <LoaderCircle size={17} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />{children}
  </p>;
}

export function SavePassage({ passage, saved, disabled, onSave }) {
  const Icon = saved ? Check : Bookmark;
  return <Button variant="quiet" disabled={saved || disabled} onClick={() => onSave(passage.chunk_id)}>
    <Icon size={15} aria-hidden="true" />{saved ? "Passage saved" : "Save passage"}
  </Button>;
}

export function PassageCard({ passage, detailRef, saved, disabled, onSave }) {
  return <details ref={detailRef} className="group overflow-hidden rounded-xl border border-line bg-white">
    <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2.5 px-3 py-3 text-sm [&::-webkit-details-marker]:hidden">
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-mint font-mono text-xs font-semibold text-forest">
        {passage.id ? `[${passage.id}]` : <FileText size={15} aria-hidden="true" />}
      </span>
      <strong className="min-w-0 flex-1 wrap-anywhere font-semibold">{passage.filename}</strong>
      <span className="shrink-0 text-xs text-muted">Page {passage.page}</span>
      <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-muted group-open:rotate-180" />
    </summary>
    <div className="border-t border-line bg-canvas px-4 py-3">
      <blockquote className="wrap-anywhere text-sm leading-relaxed">{passage.text}</blockquote>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-1">
        <span className="text-xs text-muted">
          Passage {passage.chunk_index + 1}{typeof passage.score === "number" && ` · Similarity ${passage.score.toFixed(2)}`}
        </span>
        <SavePassage passage={passage} saved={saved} disabled={disabled} onSave={onSave} />
      </div>
    </div>
  </details>;
}
