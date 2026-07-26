// Downloads a plain-text string as a file, without depending on any extra
// library: creates a Blob, a temporary <a>, and simulates the click. Same
// pattern as downloadJson.ts, generalized to any text mime type (CSV,
// Markdown) since those aren't JSON.stringify-able the same way.
export function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
