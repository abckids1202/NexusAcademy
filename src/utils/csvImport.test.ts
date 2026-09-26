import { describe, expect, it } from "vitest";
import { parseCsvRows, parseParticipantCsv, parseWheelOptionCsv } from "./csvImport";

describe("CSV wheel-option import", () => {
  it("parses quoted commas, escaped quotes, multiline fields, and a UTF-8 BOM", () => {
    expect(parseCsvRows('\uFEFFOption,Weight\r\n"Soup, salad",2\r\n"The ""Special""",3\r\n"First line\nSecond line",1')).toEqual([
      ["Option", "Weight"],
      ["Soup, salad", "2"],
      ['The "Special"', "3"],
      ["First line\nSecond line", "1"],
    ]);
  });

  it("previews weighted options, preserves duplicate labels, and reports invalid or blank rows", () => {
    expect(parseWheelOptionCsv("Name,Weight\nPizza,3\nPasta,1\npizza,2\n,4\nSoup,0\nToo,many,columns\n\n")).toEqual({
      options: [
        { label: "Pizza", weight: 3, line: 2 },
        { label: "Pasta", weight: 1, line: 3 },
        { label: "pizza", weight: 2, line: 4 },
      ],
      errors: [
        { line: 5, message: "Add an option label in the first column." },
        { line: 6, message: "Weight must be a positive number." },
        { line: 7, message: "Use only the label and optional weight columns." },
      ],
      blankRows: 1,
      duplicateCount: 1,
    });
  });

  it("accepts one-column lists and rejects an unclosed quoted field", () => {
    expect(parseWheelOptionCsv("Lunch\nDinner\nTakeout").options.map(({ label, weight }) => [label, weight])).toEqual([
      ["Lunch", 1], ["Dinner", 1], ["Takeout", 1],
    ]);
    expect(() => parseWheelOptionCsv('"Lunch,Dinner')).toThrow("A quoted CSV field is not closed.");
  });

  it("imports first-column participant names, removes case-insensitive duplicates, and reports missing names", () => {
    expect(parseParticipantCsv("Name,Email\nAvery,avery@example.test\nJordan,jordan@example.test\n aVERY,duplicate@example.test\n,missing@example.test\n\n")).toEqual({
      names: ["Avery", "Jordan"],
      errors: [{ line: 5, message: "Add a participant name in the first column." }],
      blankRows: 1,
      duplicateCount: 1,
    });
  });
});
