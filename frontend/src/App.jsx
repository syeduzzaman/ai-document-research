import { useEffect, useState } from "react";
import { Bookmark, ClipboardCheck, Files, Layers3, MessageSquareText, Search } from "lucide-react";
import { request, sendJson } from "./api";
import DocumentLibrary from "./DocumentLibrary";
import QuestionWorkspace from "./QuestionWorkspace";
import EvidenceExplorer from "./EvidenceExplorer";
import EvidenceNotebook from "./EvidenceNotebook";
import RepairChecklist from "./RepairChecklist";
import { Button, ErrorMessage } from "./ui";

const workspaces = [
  { key: "questions", label: "Document Q&A", icon: MessageSquareText },
  { key: "evidence", label: "Evidence Explorer", icon: Search },
  { key: "repair", label: "Repair Estimate Checklist", icon: ClipboardCheck },
  { key: "notebook", label: "Evidence Notebook", icon: Bookmark },
];

export default function App() {
  const [workspace, setWorkspace] = useState("questions");
  const [health, setHealth] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selected, setSelected] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [issue, setIssue] = useState("");
  const [notice, setNotice] = useState("");
  const [mutation, setMutation] = useState("");

  async function loadWorkspace(signal) {
    try {
      const [status, files, saved] = await Promise.all([
        request("/health", { signal }), request("/documents", { signal }), request("/bookmarks", { signal }),
      ]);
      if (signal?.aborted) return;
      setHealth(status);
      setDocuments(files);
      setBookmarks(saved);
      setIssue("");
    } catch (error) {
      if (!signal?.aborted) setIssue(error.message);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadWorkspace(controller.signal);
    return () => controller.abort();
  }, []);

  async function perform(action, operation) {
    setMutation(action);
    setIssue("");
    setNotice("");
    try {
      await operation();
    } catch (error) {
      setIssue(error.message);
    } finally {
      setMutation("");
    }
  }

  function upload(file) {
    if (file.size > health.max_upload_bytes) {
      setIssue("This file exceeds the 10 MiB upload limit.");
      return;
    }
    return perform("upload", async () => {
      const body = new FormData();
      body.append("file", file);
      const { document, created } = await request("/documents", { method: "POST", body });
      setDocuments((current) => current.some((item) => item.id === document.id) ? current : [document, ...current]);
      setNotice(created ? `${document.filename} is ready to search.` : "This document is already indexed.");
    });
  }

  function removeDocument(file) {
    if (!window.confirm(`Delete “${file.filename}”, its indexed passages, and any notebook entries for it?`)) return;
    return perform("delete", async () => {
      await request(`/documents/${file.id}`, { method: "DELETE" });
      setDocuments((current) => current.filter((item) => item.id !== file.id));
      setSelected((current) => current.filter((id) => id !== file.id));
      setBookmarks((current) => current.filter((item) => item.document_id !== file.id));
      setNotice("Document deleted.");
    });
  }

  function toggleDocument(id) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function savePassage(chunkId) {
    return perform("bookmark", async () => {
      const saved = await request(`/bookmarks/${chunkId}`, { method: "PUT" });
      setBookmarks((current) => current.some((item) => item.chunk_id === chunkId) ? current : [saved, ...current]);
      setNotice("Passage saved in Evidence Notebook.");
    });
  }

  function updateNote(chunkId, note) {
    return perform("note", async () => {
      const updated = await sendJson(`/bookmarks/${chunkId}`, "PATCH", { note });
      setBookmarks((current) => current.map((item) => item.chunk_id === chunkId ? updated : item));
      setNotice("Note saved.");
    });
  }

  function removeBookmark(chunkId) {
    return perform("bookmark", async () => {
      await request(`/bookmarks/${chunkId}`, { method: "DELETE" });
      setBookmarks((current) => current.filter((item) => item.chunk_id !== chunkId));
      setNotice("Passage removed from the notebook.");
    });
  }

  const disabled = !health || !!mutation;
  const savedIds = new Set(bookmarks.map((item) => item.chunk_id));
  const passageActions = { savedIds, disabled, onSave: savePassage };
  const scopeKey = JSON.stringify([selected, documents.map((item) => item.id)]);
  const scope = { selected, scopeKey, ready: health !== null && documents.length > 0 };

  return <div className="min-h-screen lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
    <a href="#workspace-content" className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:rounded-md focus:bg-white focus:p-3">
      Skip to workspace
    </a>
    <aside className="flex min-w-0 flex-col bg-sidebar px-4 pt-4 pb-3 text-white lg:sticky lg:top-0 lg:h-dvh lg:px-4 lg:pt-7 lg:pb-6">
      <a href="/" className="mx-1.5 flex w-fit items-center gap-2.5 rounded-md" aria-label="AI Document Research home">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-sidebar"><Layers3 size={21} aria-hidden="true" /></span>
        <span className="text-[15px] leading-tight font-semibold tracking-tight">AI Document Research</span>
      </a>
      <nav aria-label="Workspace" className="mt-4 grid grid-cols-2 gap-1.5 px-1 pb-1 sm:flex sm:flex-wrap lg:mt-10 lg:flex-col">
        {workspaces.map(({ key, label, icon: Icon }) => <button type="button" key={key}
          aria-current={key === workspace ? "page" : undefined} onClick={() => setWorkspace(key)} className="nav-item">
          <Icon size={17} className="shrink-0" aria-hidden="true" /><span>{label}</span>
          {key === "notebook" && bookmarks.length > 0 && <span aria-hidden="true" className="ml-auto rounded bg-white/10 px-1.5 text-xs">{bookmarks.length}</span>}
        </button>)}
      </nav>
      <div className="mt-auto hidden border-t border-white/10 px-2 pt-5 text-xs leading-relaxed text-slate-300 lg:block">
        <strong className="block pb-1 text-sm font-medium text-white">{health?.mode === "openai" ? "OpenAI processing" : "Local workspace"}</strong>
        {health?.mode === "openai" ? "Text and questions are sent to OpenAI for processing." : "Document text stays on this machine in demo mode."}
      </div>
    </aside>

    <main id="workspace-content" className="min-w-0" tabIndex={-1}>
      <header className="flex min-h-15 items-center justify-between gap-3 border-b border-line bg-white/85 px-4 sm:px-7">
        <div className="flex items-center gap-2 text-sm text-muted"><Files size={16} aria-hidden="true" /> Workspace</div>
        <span className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-forest">
          <span className="size-2 rounded-full bg-current" aria-hidden="true" />
          {health ? health.mode === "openai" ? "OpenAI mode" : "Retrieval demo" : issue ? "Offline" : "Connecting"}
        </span>
      </header>

      <div className="mx-auto grid max-w-[1380px] gap-x-7 gap-y-6 px-4 py-7 sm:px-7 sm:py-10 xl:grid-cols-[minmax(0,1fr)_290px]">
        {(issue || notice) && <div className="space-y-2 xl:col-span-2">
          {issue && <ErrorMessage>{issue}</ErrorMessage>}
          {issue && !health && <Button onClick={() => { setIssue(""); void loadWorkspace(); }}>Retry connection</Button>}
          {notice && <p role="status" className="rounded-lg border border-teal-200 bg-mint px-4 py-2.5 text-sm text-forest">{notice}</p>}
        </div>}
        <div className="order-2 min-w-0 xl:order-none">
          <section hidden={workspace !== "questions"}><QuestionWorkspace {...scope} {...passageActions} /></section>
          <section hidden={workspace !== "evidence"}><EvidenceExplorer documents={documents} {...scope} {...passageActions} /></section>
          <section hidden={workspace !== "repair"}>
            <RepairChecklist documents={documents.filter((item) => selected.includes(item.id))} mode={health?.mode} />
          </section>
          <section hidden={workspace !== "notebook"}>
            <EvidenceNotebook bookmarks={bookmarks} disabled={disabled} onUpdate={updateNote}
              onRemove={removeBookmark} onExplore={() => setWorkspace("evidence")} />
          </section>
        </div>
        <DocumentLibrary documents={documents} selected={selected} onSelect={toggleDocument}
          onClear={() => setSelected([])} onUpload={upload} onDelete={removeDocument}
          disabled={disabled} uploading={mutation === "upload"} />
      </div>
    </main>
  </div>;
}
