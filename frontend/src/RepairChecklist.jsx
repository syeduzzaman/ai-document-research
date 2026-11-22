import { useEffect, useRef, useState } from "react";
import { Camera, ClipboardCheck, Download, FileCheck2, FileText, Play, TriangleAlert } from "lucide-react";
import { request, sendJson } from "./api";
import { downloadMarkdown, markdownText, quote } from "./export";
import { Button, ErrorMessage, Loading, PageTitle } from "./ui";

const categories = [
  { key: "photos", label: "Photos", icon: Camera },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "approvals", label: "Approvals", icon: FileCheck2 },
];

function citationLabel(citation) {
  return `${citation.filename} · Page ${citation.page}${citation.revision ? ` · ${citation.revision}` : ""}`;
}

function ChecklistResults({ checklist, example }) {
  const [checked, setChecked] = useState(new Set());
  const heading = useRef(null);
  const total = checklist.requirements.length;

  useEffect(() => { heading.current?.focus(); }, []);

  function toggle(index) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function exportChecklist() {
    const groups = categories.flatMap(({ key, label }) => {
      const items = checklist.requirements.flatMap(({ category, action, citation }, index) => category === key ? [
        `- [${checked.has(index) ? "x" : " "}] ${markdownText(action.replace(/\s+/g, " "))}\n\n  **Source** ${markdownText(citationLabel(citation))}\n\n${quote(citation.quote).split("\n").map((line) => `  ${line}`).join("\n")}`,
      ] : []);
      return items.length ? [`## ${label}`, ...items] : [];
    });
    const manual = checklist.manual_checks.map((item) => `- ${markdownText(item.replace(/\s+/g, " "))}`);
    downloadMarkdown("repair-checklist.md", [
      "# Repair Estimate Checklist", quote(checklist.scenario), `${checked.size} of ${total} requirements completed.`,
      ...groups, ...(manual.length ? ["## Needs manual confirmation", manual.join("\n")] : []),
    ]);
  }

  return <section aria-label="Checklist results" className="panel mt-6 space-y-5 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold">{example ? "Sample checklist" : "Your repair checklist"}</h2>
      <Button onClick={exportChecklist}><Download size={16} aria-hidden="true" />Export Markdown</Button>
    </div>
    <p className="wrap-anywhere rounded-lg bg-canvas px-3 py-2 text-sm text-muted">{checklist.scenario}</p>
    {total > 0 && <div>
      <label htmlFor="checklist-progress" className="text-sm font-medium">{checked.size} of {total} complete</label>
      <progress id="checklist-progress" max={total} value={checked.size} className="mt-2 h-2 w-full overflow-hidden rounded-full" />
    </div>}
    {categories.map(({ key, label, icon: Icon }) => {
      const items = checklist.requirements.map((item, index) => ({ item, index })).filter(({ item }) => item.category === key);
      if (!items.length) return null;
      return <div key={key}>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Icon size={17} className="text-forest" aria-hidden="true" />{label}</h3>
        <ul className="space-y-2">
          {items.map(({ item: { action, citation }, index }) => <li key={index} className="rounded-lg border border-line px-3 py-2.5 has-checked:bg-mint">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm font-medium">
              <input type="checkbox" checked={checked.has(index)} onChange={() => toggle(index)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-forest)]" />
              <span className="wrap-anywhere">{action}</span>
            </label>
            <details className="mt-2 ml-6.5 text-xs text-forest">
              <summary className="cursor-pointer wrap-anywhere"><strong>Source</strong> {citationLabel(citation)}</summary>
              <blockquote className="mt-2 rounded-md bg-canvas p-2.5 text-sm text-ink wrap-anywhere">{citation.quote}</blockquote>
            </details>
          </li>)}
        </ul>
      </div>;
    })}
    {checklist.manual_checks.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-amber-950">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><TriangleAlert size={17} aria-hidden="true" />Needs manual confirmation</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm wrap-anywhere">
        {checklist.manual_checks.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>}
  </section>;
}

export default function RepairChecklist({ documents, mode }) {
  const [scenario, setScenario] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const documentIds = documents.map((item) => item.id);
  const selection = [...documentIds].sort().join(",");
  const visible = result && (result.example || result.selection === selection);
  const canGenerate = !busy && mode === "openai" && documentIds.length > 0 && scenario.trim().length >= 10;

  async function run(example) {
    setBusy(true);
    setResult(null);
    setError("");
    try {
      const checklist = example ? await request("/repair-checklist/sample")
        : await sendJson("/repair-checklist", "POST", { scenario: scenario.trim(), document_ids: documentIds });
      setResult({ checklist, example, selection });
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <PageTitle title="Repair Estimate Checklist">Track which photos, documents, and approvals a repair estimate needs.</PageTitle>
    <section aria-label="Fictional workshop case" className="panel mb-4 flex flex-wrap items-center justify-between gap-3 border-teal-200 bg-mint p-4 sm:p-5">
      <div>
        <h2 className="font-semibold">Sample case · Front bumper replacement</h2>
        <p className="mt-1 text-sm text-muted">The estimate rises by EUR 450 after teardown.</p>
      </div>
      <Button disabled={busy || !mode} onClick={() => run(true)}><Play size={16} aria-hidden="true" />Run sample case</Button>
    </section>
    <form className="panel p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); if (canGenerate) void run(false); }}>
      <h2 className="font-semibold">Your own repair case</h2>
      <p className="mt-2 text-sm text-muted wrap-anywhere">
        {mode === "demo" ? "Enable OpenAI mode to generate a checklist from your files."
          : documentIds.length ? `Using ${documents.map((item) => item.filename).join(", ")}`
            : "Select the current procedure files in the document library."}
      </p>
      <label htmlFor="repair-scenario" className="sr-only">Repair scenario</label>
      <textarea id="repair-scenario" value={scenario} maxLength={2000} minLength={10} required disabled={busy}
        className="field mt-3 min-h-23 w-full resize-y p-3" onChange={(event) => setScenario(event.target.value)}
        placeholder="Describe the repair, the change in cost, and the facts that affect approval." />
      <Button className="mt-3" variant="primary" type="submit" disabled={!canGenerate}>
        <ClipboardCheck size={16} aria-hidden="true" />Generate checklist
      </Button>
    </form>
    {error && <div className="mt-4"><ErrorMessage>{error}</ErrorMessage></div>}
    {busy && <Loading>Preparing checklist…</Loading>}
    {visible && <ChecklistResults checklist={result.checklist} example={result.example} />}
  </>;
}
