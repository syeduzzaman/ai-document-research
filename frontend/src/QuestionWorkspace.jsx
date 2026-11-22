import { useRef, useState } from "react";
import { ArrowRight, Send } from "lucide-react";
import { sendJson } from "./api";
import { Button, ErrorMessage, Loading, PageTitle, PassageCard } from "./ui";

const suggestions = [
  "How many days of annual leave do employees receive?",
  "What is the first response target for a P1 incident?",
  "When do database backups run?",
];

export default function QuestionWorkspace({ selected, scopeKey, ready, savedIds, disabled, onSave }) {
  const [question, setQuestion] = useState("");
  const [run, setRun] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sources = useRef(new Map());
  const input = useRef(null);
  const result = run?.scopeKey === scopeKey ? run : null;

  async function ask(event) {
    event.preventDefault();
    if (busy || !ready || question.trim().length < 3) return;
    setRun(null);
    setError("");
    setBusy(true);
    try {
      const answer = await sendJson("/ask", "POST", { question: question.trim(), document_ids: selected, top_k: 3 });
      setRun({ answer, question: question.trim(), scopeKey });
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  function showCitation(id) {
    const details = sources.current.get(id);
    if (!details) return;
    details.open = true;
    details.scrollIntoView({ block: "nearest" });
    details.querySelector("summary")?.focus({ preventScroll: true });
  }

  return <>
    <PageTitle title="Ask your documents">Ask a question, open its sources, and save the passages you’ll need later.</PageTitle>
    <form onSubmit={ask} className="panel overflow-hidden" aria-label="Ask a question">
      <div className="p-4 sm:p-5">
        <label htmlFor="question" className="block text-sm font-semibold">Your question</label>
        <textarea id="question" ref={input} value={question} onChange={(event) => setQuestion(event.target.value)}
          placeholder="What would you like to find out?" maxLength={2000} minLength={3} required
          className="field mt-2.5 min-h-29 w-full resize-y p-3 leading-relaxed" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-canvas px-4 py-3 sm:px-5">
        <span className="text-sm text-muted">{selected.length ? `${selected.length} selected documents` : "All indexed documents"}</span>
        <Button variant="primary" type="submit" disabled={busy || !ready || question.trim().length < 3}>
          {busy ? "Searching…" : "Ask question"}<Send size={15} aria-hidden="true" />
        </Button>
      </div>
    </form>
    {error && <div className="mt-4"><ErrorMessage>{error}</ErrorMessage></div>}
    {busy && <Loading>Finding relevant passages…</Loading>}
    {!result && !busy && <section className="mt-7" aria-label="Example questions">
      <h2 className="mb-2.5 text-sm font-semibold">Try a sample question</h2>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {suggestions.map((sample) => <button type="button" className="sample-question" key={sample}
          onClick={() => { setQuestion(sample); input.current?.focus(); }}>
          <span>{sample}</span><ArrowRight size={16} className="shrink-0 text-forest" aria-hidden="true" />
        </button>)}
      </div>
    </section>}
    {result && <section aria-label="Answer" className="panel mt-6 p-4 sm:p-5" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{result.answer.refused ? "More information needed" : result.answer.mode === "demo" ? "Matching passages" : "Answer"}</h2>
        <span className="shrink-0 text-xs text-muted">{result.answer.elapsed_ms} ms</span>
      </div>
      <p className="mt-2 text-sm text-muted">{result.question}</p>
      <div className="mt-4 whitespace-pre-wrap wrap-anywhere leading-relaxed">
        {result.answer.answer.split(/(\[\d+\])/g).map((part, index) => {
          const id = Number(part.slice(1, -1));
          return /^\[\d+\]$/.test(part) && result.answer.sources.some((source) => source.id === id)
            ? <button key={index} type="button" aria-label={`Open source ${id}`} className="citation-link" onClick={() => showCitation(id)}>{part}</button>
            : part;
        })}
      </div>
      {result.answer.sources.length > 0 && <div className="mt-6 space-y-2">
        <h3 className="text-sm font-semibold">Sources</h3>
        {result.answer.sources.map((source) => <PassageCard key={source.chunk_id} passage={source}
          saved={savedIds.has(source.chunk_id)} disabled={disabled} onSave={onSave}
          detailRef={(element) => { if (element) sources.current.set(source.id, element); else sources.current.delete(source.id); }} />)}
      </div>}
    </section>}
  </>;
}
