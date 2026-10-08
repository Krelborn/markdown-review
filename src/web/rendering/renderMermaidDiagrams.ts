/**
 * Draws a rendered doc's Mermaid diagrams in place of their source, loading Mermaid only when the doc has a diagram
 *
 * @param container the rendered doc
 * @returns once every diagram is drawn; a diagram Mermaid cannot read keeps showing its source
 */
export async function renderMermaidDiagrams(container: Element): Promise<void> {
  const sources = [...container.querySelectorAll("pre > code.language-mermaid")];
  if (sources.length === 0) {
    return;
  }
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    securityLevel: "strict",
    startOnLoad: false,
    theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default",
  });
  for (const [index, source] of sources.entries()) {
    const definition = source.textContent;
    if ((await mermaid.parse(definition, { suppressErrors: true })) === false) {
      continue;
    }
    const { svg } = await mermaid.render(`mermaid-diagram-${index}`, definition);
    const diagram = document.createElement("template");
    diagram.innerHTML = svg;
    source.parentElement?.replaceWith(diagram.content);
  }
}
