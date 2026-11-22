import { useState } from "react";
import { ArrowLeft, ArrowRight, LibraryBig, Search } from "lucide-react";
import { request, sendJson } from "./api";
import { Button, ErrorMessage, Loading, PageTitle, PassageCard } from "./ui";

const PAGE_SIZE = 8;

export default function EvidenceExplorer({ documents, selected, scopeKey, ready, savedIds, disabled, onSave }) {
  const [query, setQuery] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const document = documents.find((item) => item.id === documentId);
  const visible = result?.kind === "search" ? result.scopeKey === scopeKey && result
    : result?.documentId === document?.id && result;

  async function run(operation) {
    setBusy(true);
    setError("");
    try {
      setResult(await operation());
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  function search(event) {
    event.preventDefault();
    if (!ready || busy || query.trim().length < 3) return;
    setResult(null);
    return run(async () => {
      const passages = await sendJson("/search", "POST", { query: query.trim(), document_ids: selected, top_k: 8 });
      return { kind: "search", scopeKey, query: query.trim(), passages };
    });
  }

  function browse(id, offset = 0) {
    return run(async () => {
      const data = await request(`/documents/${id}/passages?offset=${offset}&limit=${PAGE_SIZE}`);
      return { kind: "browse", documentId: id, offset, ...data };
    });
  }

  return <>
    <PageTitle title="Evidence Explorer">Search for relevant excerpts or browse a document in page order.</PageTitle>
    <div className="panel divide-y divide-line">
      <form onSubmit={search} className="p-4 sm:p-5">
        <label htmlFor="passage-query" className="text-sm font-semibold">Search passages</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <input id="passage-query" type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            minLength={3} maxLength={2000} required placeholder="e.g. database backup retention" className="field min-w-36 flex-1 px-3 py-2" />
          <Button variant="primary" type="submit" disabled={!ready || busy || query.trim().length < 3}>
            <Search size={16} aria-hidden="true" />Search
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">{selected.length ? `Searching ${selected.length} selected documents` : "Searching all indexed documents"}</p>
      </form>
      <form className="p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); if (document && !busy) void browse(document.id); }}>
        <label htmlFor="browse-document" className="text-sm font-semibold">Browse a document</label>
        <div className="mt-2 flex flex-wrap gap-2">
          <select id="browse-document" value={document ? document.id : ""} disabled={busy}
            onChange={(event) => { setDocumentId(event.target.value); setResult(null); setError(""); }}
            className="field min-w-36 flex-1 px-3 py-2">
            <option value="">Choose an indexed document</option>
            {documents.map((file) => <option key={file.id} value={file.id}>{file.filename}</option>)}
          </select>
          <Button type="submit" disabled={!document || busy}><LibraryBig size={16} aria-hidden="true" />Browse</Button>
        </div>
      </form>
    </div>
    {error && <div className="mt-4"><ErrorMessage>{error}</ErrorMessage></div>}
    {busy && <Loading>Loading passages…</Loading>}
    {visible && !busy && <section aria-label="Passage results" className="mt-6 space-y-2.5" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="wrap-anywhere text-base font-semibold">
          {visible.kind === "search" ? `Results for “${visible.query}”` : document.filename}
        </h2>
        <span className="text-xs text-muted">
          {visible.kind === "search" ? `${visible.passages.length} ${visible.passages.length === 1 ? "match" : "matches"}`
            : `${visible.offset + 1}–${visible.offset + visible.passages.length} of ${visible.total} passages`}
        </span>
      </div>
      {visible.passages.map((passage) => <PassageCard key={passage.chunk_id} passage={passage}
        saved={savedIds.has(passage.chunk_id)} disabled={disabled} onSave={onSave} />)}
      {visible.passages.length === 0 && <p className="panel p-4 text-sm text-muted">No passages match this search.</p>}
      {visible.kind === "browse" && visible.total > PAGE_SIZE && <nav aria-label="Passage pages" className="flex justify-between gap-2 pt-2">
        <Button disabled={visible.offset === 0} onClick={() => browse(document.id, visible.offset - PAGE_SIZE)}>
          <ArrowLeft size={16} aria-hidden="true" /> Previous
        </Button>
        <Button disabled={visible.offset + PAGE_SIZE >= visible.total} onClick={() => browse(document.id, visible.offset + PAGE_SIZE)}>
          Next <ArrowRight size={16} aria-hidden="true" />
        </Button>
      </nav>}
    </section>}
  </>;
}
