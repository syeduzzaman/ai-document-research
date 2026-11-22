import { useState } from "react";
import { Bookmark, Download, Search, Trash2 } from "lucide-react";
import { downloadMarkdown, markdownText, quote } from "./export";
import { Button, PageTitle } from "./ui";

function NotebookEntry({ bookmark, disabled, onUpdate, onRemove }) {
  const [note, setNote] = useState(bookmark.note);
  const noteId = `note-${bookmark.chunk_id}`;
  return <article className="panel space-y-3 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <h2 className="wrap-anywhere text-base font-semibold">{bookmark.filename}</h2>
        <p className="mt-0.5 text-xs text-muted">Page {bookmark.page} · Passage {bookmark.chunk_index + 1}</p>
      </div>
      <Button variant="quiet" disabled={disabled} onClick={() => onRemove(bookmark.chunk_id)}>
        <Trash2 size={15} aria-hidden="true" />Remove passage
      </Button>
    </div>
    <blockquote className="rounded-lg border-l-2 border-teal-500 bg-canvas p-3 text-sm leading-relaxed wrap-anywhere">
      {bookmark.text}
    </blockquote>
    <form onSubmit={(event) => {
      event.preventDefault();
      if (!disabled && note.trim() !== bookmark.note) void onUpdate(bookmark.chunk_id, note.trim());
    }}>
      <label htmlFor={noteId} className="text-sm font-medium">Note</label>
      <textarea id={noteId} className="field mt-2 min-h-20 w-full resize-y p-2.5 text-sm" maxLength={2000}
        value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why does this passage matter?" />
      <Button className="mt-2" type="submit" disabled={disabled || note.trim() === bookmark.note}>Save note</Button>
    </form>
  </article>;
}

export default function EvidenceNotebook({ bookmarks, disabled, onUpdate, onRemove, onExplore }) {
  function exportNotebook() {
    const entries = bookmarks.map((bookmark) => [
      `## ${markdownText(bookmark.filename)} · Page ${bookmark.page} · Passage ${bookmark.chunk_index + 1}`,
      quote(bookmark.text),
      bookmark.note && `**Note**\n\n${quote(bookmark.note)}`,
    ].filter(Boolean).join("\n\n"));
    downloadMarkdown("evidence-notebook.md", ["# Evidence Notebook", ...entries]);
  }

  return <>
    <PageTitle title="Evidence Notebook">Keep source passages and notes together for later review.</PageTitle>
    {bookmarks.length ? <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>{bookmarks.length} saved {bookmarks.length === 1 ? "passage" : "passages"}</span>
        <Button onClick={exportNotebook}><Download size={16} aria-hidden="true" />Export Markdown</Button>
      </div>
      {bookmarks.map((bookmark) => <NotebookEntry key={bookmark.chunk_id} bookmark={bookmark} disabled={disabled}
        onUpdate={onUpdate} onRemove={onRemove} />)}
    </div> : <div className="panel p-5 sm:p-7">
      <Bookmark size={22} className="mb-3 text-forest" aria-hidden="true" />
      <h2 className="text-base font-semibold">No saved passages</h2>
      <p className="mt-1 text-sm text-muted">Open a source in an answer or search result and choose Save passage.</p>
      <Button className="mt-4" onClick={onExplore}><Search size={16} aria-hidden="true" />Explore evidence</Button>
    </div>}
  </>;
}
