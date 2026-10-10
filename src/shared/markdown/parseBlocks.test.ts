import { describe, expect, test } from "vitest";

import type { MarkdownBlock } from "./MarkdownBlock";
import { parseBlocks } from "./parseBlocks";

describe("parseBlocks", () => {
  test.each<{ condition: string; source: string; expected: MarkdownBlock[] }>([
    {
      condition: "the doc has a heading and a two-line paragraph",
      source: "# Title\n\nPara one\nline two\n",
      expected: [
        oneLineBlock(1, "Title"),
        {
          endLine: 4,
          lineOffsets: [
            { line: 3, offset: 0 },
            { line: 4, offset: 9 },
          ],
          startLine: 3,
          text: "Para one\nline two",
          exactLines: true,
          wholeBlockOnly: false,
        },
      ],
    },
    {
      condition: "a setext heading's underline is on the next line",
      source: "Title\n=====\n",
      expected: [{ ...oneLineBlock(1, "Title"), endLine: 2 }],
    },
    {
      condition: "the list is loose, so each item is followed by a blank line",
      source: "- one\n\n- two\n\n  more\n",
      expected: [oneLineBlock(1, "one"), oneLineBlock(3, "two"), oneLineBlock(5, "more")],
    },
    {
      condition: "a tight list has a nested list",
      source: "- a\n  - b\n\n- c\n",
      expected: [oneLineBlock(1, "a"), oneLineBlock(2, "b"), oneLineBlock(4, "c")],
    },
    {
      condition: "the list items are tasks",
      source: "- [ ] todo *one*\n- [x] done\n",
      expected: [oneLineBlock(1, " todo one"), oneLineBlock(2, " done")],
    },
    {
      condition: "a blockquote holds two paragraphs",
      source: "> a\n>\n> b\n",
      expected: [oneLineBlock(1, "a"), oneLineBlock(3, "b")],
    },
    {
      condition: "a GitHub alert holds a paragraph",
      source: "> [!NOTE]\n> Cache for **24h**.\n",
      expected: [oneLineBlock(2, "Cache for 24h.")],
    },
    {
      condition: "an alert's marker has nothing after it",
      source: "> [!NOTE]\n",
      expected: [oneLineBlock(1, "[!NOTE]")],
    },
    {
      condition: "a table has a header row and a body row",
      source: "| a | b |\n|---|---|\n| 1 | `2` |\n",
      expected: [oneLineBlock(1, "a\tb"), oneLineBlock(3, "1\t2")],
    },
    {
      condition: "a code span hides the line break inside it",
      source: "Use `a\nb` here\nand more\n",
      expected: [
        {
          endLine: 3,
          exactLines: false,
          lineOffsets: [
            { line: 1, offset: 0 },
            { line: 2, offset: 13 },
          ],
          startLine: 1,
          text: "Use a b here\nand more",
          wholeBlockOnly: false,
        },
      ],
    },
    {
      condition: "a paragraph holds entities, inline HTML, an image and a code span",
      source: "A &copy; <b>B</b> ![alt](i.png) `c`\n",
      expected: [oneLineBlock(1, "A © B  c")],
    },
    {
      condition: "a paragraph holds an HTML tag the browser moves out of the paragraph",
      source: "Wrap the form in a <div> element so it lays out.\n",
      expected: [{ ...oneLineBlock(1, "Wrap the form in a  element so it lays out."), wholeBlockOnly: true }],
    },
    {
      condition: "a heading holds a script tag the sanitizer removes with its content",
      source: "# Run <script>setUp()</script> first\n",
      expected: [{ ...oneLineBlock(1, "Run setUp() first"), wholeBlockOnly: true }],
    },
    {
      condition: "a fence holds two lines of code",
      source: "```ts\nconst a = 1;\nconst b = 2;\n```\n",
      expected: [
        {
          endLine: 4,
          lineOffsets: [
            { line: 2, offset: 0 },
            { line: 3, offset: 13 },
          ],
          startLine: 1,
          text: "const a = 1;\nconst b = 2;",
          exactLines: true,
          wholeBlockOnly: false,
        },
      ],
    },
    {
      condition: "a fence is never closed and ends in a blank line",
      source: "```\ncode\n\n",
      expected: [
        {
          endLine: 2,
          lineOffsets: [{ line: 2, offset: 0 }],
          startLine: 1,
          text: "code\n",
          exactLines: true,
          wholeBlockOnly: false,
        },
      ],
    },
    {
      condition: "a fence is empty, so it has no visible text",
      source: "```\n```\n",
      expected: [
        {
          endLine: 2,
          exactLines: true,
          lineOffsets: [
            { line: 1, offset: 0 },
            { line: 2, offset: 4 },
          ],
          startLine: 1,
          text: "```\n```",
          wholeBlockOnly: true,
        },
      ],
    },
    {
      condition: "a paragraph holds only an image, so it has no visible text",
      source: "![Architecture diagram](arch.png)\n",
      expected: [{ ...oneLineBlock(1, "![Architecture diagram](arch.png)"), wholeBlockOnly: true }],
    },
    {
      condition: "a fence holds a Mermaid diagram",
      source: "```mermaid\ngraph TD\n```\n",
      expected: [
        {
          endLine: 3,
          lineOffsets: [{ line: 2, offset: 0 }],
          startLine: 1,
          text: "graph TD",
          exactLines: true,
          wholeBlockOnly: true,
        },
      ],
    },
    {
      condition: "an indented code block holds a blank line",
      source: "    one\n\n    two\n",
      expected: [
        {
          endLine: 3,
          lineOffsets: [
            { line: 1, offset: 0 },
            { line: 2, offset: 4 },
            { line: 3, offset: 5 },
          ],
          startLine: 1,
          text: "one\n\ntwo",
          exactLines: true,
          wholeBlockOnly: false,
        },
      ],
    },
    {
      condition: "an HTML block spans three lines",
      source: "<div>\n<b>x</b>\n</div>\n",
      expected: [
        {
          endLine: 3,
          lineOffsets: [
            { line: 1, offset: 0 },
            { line: 2, offset: 6 },
            { line: 3, offset: 15 },
          ],
          startLine: 1,
          text: "<div>\n<b>x</b>\n</div>",
          exactLines: true,
          wholeBlockOnly: true,
        },
      ],
    },
    {
      condition: "the doc starts with frontmatter",
      source: "---\ntitle: Plan\ntags: [a, b]\n---\n\n# Plan\n",
      expected: [
        {
          endLine: 4,
          exactLines: true,
          lineOffsets: [
            { line: 2, offset: 0 },
            { line: 3, offset: 12 },
          ],
          startLine: 1,
          text: "title: Plan\ntags: [a, b]",
          wholeBlockOnly: true,
        },
        oneLineBlock(6, "Plan"),
      ],
    },
    {
      condition: "the frontmatter has Windows line endings",
      source: "---\r\ntitle: Plan\r\n---\r\n\r\n# Plan\r\n",
      expected: [
        {
          endLine: 3,
          exactLines: true,
          lineOffsets: [{ line: 2, offset: 0 }],
          startLine: 1,
          text: "title: Plan",
          wholeBlockOnly: true,
        },
        oneLineBlock(5, "Plan"),
      ],
    },
    {
      condition: "the frontmatter is empty, so it has no visible text",
      source: "---\n---\n# Plan\n",
      expected: [
        {
          endLine: 2,
          exactLines: true,
          lineOffsets: [
            { line: 1, offset: 0 },
            { line: 2, offset: 4 },
          ],
          startLine: 1,
          text: "---\n---",
          wholeBlockOnly: true,
        },
        oneLineBlock(3, "Plan"),
      ],
    },
    {
      condition: "the doc starts with a horizontal rule and has another one later",
      source: "---\n\n# Plan\n\n---\n",
      expected: [oneLineBlock(3, "Plan")],
    },
    {
      condition: "the doc's first --- is never closed",
      source: "---\ntitle: Plan\n",
      expected: [oneLineBlock(2, "title: Plan")],
    },
    {
      condition: "the doc's first --- is not on its first line",
      source: "\n---\ntitle: Plan\n---\n",
      expected: [{ ...oneLineBlock(3, "title: Plan"), endLine: 4 }],
    },
    {
      condition: "a blockquote at the start of the doc holds --- lines",
      source: "> ---\n> title: Plan\n> ---\n",
      expected: [{ ...oneLineBlock(2, "title: Plan"), endLine: 3 }],
    },
    {
      condition: "the source has Windows line endings",
      source: "a\r\nb\r\n\r\nc\r\n",
      expected: [
        {
          endLine: 2,
          lineOffsets: [
            { line: 1, offset: 0 },
            { line: 2, offset: 2 },
          ],
          startLine: 1,
          text: "a\nb",
          exactLines: true,
          wholeBlockOnly: false,
        },
        oneLineBlock(4, "c"),
      ],
    },
  ])("must find the blocks, their lines and their text when $condition", ({ source, expected }) => {
    expect(parseBlocks(source)).toEqual(expected);
  });
});

function oneLineBlock(line: number, text: string): MarkdownBlock {
  return {
    endLine: line,
    lineOffsets: [{ line, offset: 0 }],
    startLine: line,
    text,
    exactLines: true,
    wholeBlockOnly: false,
  };
}
