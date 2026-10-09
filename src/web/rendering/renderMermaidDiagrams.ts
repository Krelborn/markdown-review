const definitionAttribute = "data-mermaid-definition";

let renderCount = 0;

interface Diagram {
  definition: string;

  /**
   * What a new drawing replaces: the diagram's source, or its last drawing
   */
  drawing: Element;
}

/**
 * Tells whether a rendered doc has Mermaid diagrams, drawn or not
 *
 * @param container the rendered doc
 * @returns true when the doc has a diagram, whether its source or its drawing is showing
 */
export function hasMermaidDiagrams(container: Element): boolean {
  return findDiagrams(container).length > 0;
}

/**
 * Draws a rendered doc's Mermaid diagrams in the colours of the current light or dark mode, in place of their source
 * or their last drawing, loading Mermaid only when the doc has a diagram
 *
 * @param container the rendered doc
 * @returns once every diagram is drawn; a diagram Mermaid cannot read keeps showing what it showed
 */
export async function renderMermaidDiagrams(container: Element): Promise<void> {
  const diagrams = findDiagrams(container);
  if (diagrams.length === 0) {
    return;
  }
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    securityLevel: "strict",
    startOnLoad: false,
    theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default",
  });
  for (const { definition, drawing } of diagrams) {
    if ((await mermaid.parse(definition, { suppressErrors: true })) === false) {
      continue;
    }
    const { svg } = await mermaid.render(nextRenderId(), definition);
    const diagram = document.createElement("template");
    diagram.innerHTML = svg;
    drawing.parentElement?.setAttribute(definitionAttribute, definition);
    drawing.replaceWith(diagram.content);
  }
}

/**
 * Mermaid removes the element that has the id it renders with, so each rendering needs an id no drawing already has
 */
function nextRenderId(): string {
  renderCount += 1;
  return `mermaid-diagram-${renderCount}`;
}

function findDiagrams(container: Element): Diagram[] {
  const sources = [...container.querySelectorAll("pre > code.language-mermaid")].flatMap((code): Diagram[] =>
    code.parentElement === null ? [] : [{ definition: code.textContent, drawing: code.parentElement }]
  );
  const drawn = [...container.querySelectorAll(`[${definitionAttribute}] > svg`)].flatMap((svg): Diagram[] => {
    const definition = svg.parentElement?.getAttribute(definitionAttribute) ?? null;
    return definition === null ? [] : [{ definition, drawing: svg }];
  });
  return [...sources, ...drawn];
}
