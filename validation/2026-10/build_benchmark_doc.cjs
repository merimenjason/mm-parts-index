// Writes Benchmark_statistic_recommendation_2026-10-16.docx: the "which average to use" write-up.
// Figures come from bench_compare.mjs on live_parts_2026-10-15.json.
const fs = require("fs");
const path = require("path");
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType,
  ShadingType, BorderStyle, AlignmentType, LevelFormat } = require("docx");

const FONT = "Calibri";
const TEAL = "0F4C5C";
const p = (text, opts = {}) => new Paragraph({ spacing: { after: 120 }, ...opts,
  children: (Array.isArray(text) ? text : [text]).map((t) => typeof t === "string" ? new TextRun(t) : new TextRun(t)) });
const h = (text, level) => new Paragraph({ heading: level, spacing: { before: 240, after: 120 }, children: [new TextRun(text)] });
const bullet = (runs, ref = "nums") => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 80 },
  children: runs.map((t) => new TextRun(t)) });

const border = { style: BorderStyle.SINGLE, size: 4, color: "BFC7CC" };
const borders = { top: border, bottom: border, left: border, right: border };
function table(widths, rows, boldRow = -1) {
  const total = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: rows.map((r, i) => new TableRow({
      tableHeader: i === 0,
      children: r.map((cell, j) => new TableCell({
        width: { size: widths[j], type: WidthType.DXA }, borders,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        shading: i === 0 ? { type: ShadingType.CLEAR, fill: TEAL, color: "auto" }
          : i === boldRow ? { type: ShadingType.CLEAR, fill: "E3F4E8", color: "auto" } : undefined,
        children: [new Paragraph({ alignment: j === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
          children: [new TextRun({ text: cell, bold: i === 0 || i === boldRow, color: i === 0 ? "FFFFFF" : undefined })] })],
      })),
    })),
  });
}

const children = [
  new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("Which average to use for the parts price benchmark")] }),
  p([{ text: "PartsIndex v1.18.0 · live data snapshot of 15 Oct 2026 · prepared 16 Oct 2026", color: "6B7280", italics: true }]),

  h("Short answer", HeadingLevel.HEADING_1),
  p([{ text: "Keep the median. ", bold: true }, "The app already uses it as the benchmark, and it is the right choice. We tested it against the other options on the live data, and none of them did better."]),

  h("How we tested it", HeadingLevel.HEADING_1),
  p("We used the 77 groups of matched parts that have 3 or more quotes (367 quotes in total). One at a time, we took each quote out, worked out the benchmark from the rest of its group, and measured how far the removed quote was from that benchmark. The better a method is, the closer real prices land to its benchmark. Gaps are measured as percentages, so a $40 clip and a $4,000 bumper count equally."),
  table([4200, 2400, 2400], [
    ["Method", "Typical gap to a real quote", "Quotes within ±25%"],
    ["Median", "22%", "55%"],
    ["Hodges–Lehmann (a robust middle value)", "25%", "52%"],
    ["Trimmed mean (top and bottom 20% dropped)", "26%", "49%"],
    ["Geometric mean", "27%", "48%"],
    ["Mean (simple average)", "29%", "49%"],
  ], 1),
  p(""),
  p("The mean does worst because one expensive quote drags it up. In 11 of the 45 groups with 4 or more quotes, the mean is more than 20% above the median. A trimmed mean is the usual fix, but with only 4–9 quotes per group, trimming 20% drops just 0–1 quotes from each end, so it ends up close to the mean anyway. The median handles this on its own and is the easiest to explain in a dispute: half the quotes were cheaper, half were dearer."),

  h("The bigger finding: matching matters more than the method", HeadingLevel.HEADING_1),
  table([4200, 2400, 2400], [
    ["Groups", "Typical gap", "Within ±25%"],
    ["Every quote has the same part number (7 groups)", "0% (all methods equal)", "93%"],
    ["Grouped by part name only (70 groups)", "25% (median) to 33% (mean)", "52%"],
  ]),
  p(""),
  p("When the quotes really are the same part, every method gives almost the same answer. The wide price ranges come from putting different parts in one group. The online price checks found this directly: 42 of the 106 lines checked were the same part name on a different car. No average can fix that. So the next agenda item, Matching Logic Improvement, is where accuracy will improve; changing the statistic will not help much."),

  h("Recommendations", HeadingLevel.HEADING_1),
  bullet([{ text: "Benchmark = median. ", bold: true }, "No change needed."]),
  bullet([{ text: "Show the typical range next to it: ", bold: true }, "the middle half of quotes (Q1 to Q3). The app already calculates this. It is a better guide than the lowest and highest price, which a single odd quote can stretch."]),
  bullet([{ text: "Flag outliers with the existing rule ", bold: true }, "(above Q3 + 1.5 × the Q1–Q3 width), but only when a group has 4 or more quotes that all share one part number. That is what the provisional \"treat name-matched benchmarks as unverified\" setting does, and the data above supports turning it on."]),
  bullet([{ text: "Be careful with small groups. ", bold: true }, "Only 45 of 949 groups have 4 or more quotes, and 726 have just one. Below 4 quotes, show the median as indicative only."]),
  bullet([{ text: "Possible later improvement: ", bold: true }, "the bills go back to 2016, so 2017 prices are mixed in with 2026 ones. Using only recent quotes (the app already has a maximum-age setting), or adjusting old prices for inflation, would help more than switching to a different average."]),

  h("Caveat", HeadingLevel.HEADING_1),
  p("These groups still contain the mismatches the reviewers have not yet confirmed, so the figures will change once matching is improved. The order of the methods is unlikely to change."),
  p([{ text: "Source: bench_compare.mjs run on live_parts_2026-10-15.json (read-only; nothing in the app or data was changed).", color: "6B7280", size: 18 }]),
];

const doc = new Document({
  creator: "PartsIndex", title: "Which average to use for the parts price benchmark",
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", run: { size: 36, bold: true, color: TEAL, font: FONT }, paragraph: { spacing: { after: 80 } } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 28, bold: true, color: TEAL, font: FONT }, paragraph: { outlineLevel: 0 } },
    ],
  },
  numbering: { config: [{ reference: "nums", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 360, hanging: 360 } } } }] }] },
  sections: [{ properties: { page: { margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } } }, children }],
});
const OUT = path.join(__dirname, "Benchmark_statistic_recommendation_2026-10-16.docx");
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(OUT, b); console.log(OUT); });
