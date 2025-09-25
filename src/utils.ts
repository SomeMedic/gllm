// Utility functions for file naming and language detection

export function safeName(s: string) {
  return s.replace(/[/\\\s]+/g, "__").replace(/[^0-9A-Za-z._\-@]/g, "");
}

export function guessLangByExt(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    "py": "python",
    "js": "javascript",
    "ts": "typescript",
    "java": "java",
    "go": "go",
    "rb": "ruby",
    "rs": "rust",
    "c": "c",
    "cpp": "cpp",
    "h": "c",
    "json": "json",
    "md": "markdown",
    "sh": "bash",
    "yml": "yaml",
    "yaml": "yaml",
    "html": "html",
    "css": "css"
  };
  return map[ext] || "";
}