export function markdownText(value) {
  // Escape Markdown punctuation so excerpts and notes render as text.
  return value.replace(/[\\`*_{}[\]<>()#+.!|~-]/g, "\\$&");
}

export function quote(text) {
  return text.split("\n").map((line) => `> ${markdownText(line)}`).join("\n");
}

export function downloadMarkdown(filename, sections) {
  const file = new Blob([sections.join("\n\n") + "\n"], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
