import { preprocessCommand } from "../../utils/commandPreprocessor";
import { Document } from "../../types/Document";

const makeDoc = (path: string): Document => ({
  path,
  projectAlias: "proj",
  title: path,
  blocks: [],
  tags: [],
  created: new Date(),
  updated: new Date(),
});

describe("preprocessCommand", () => {
  const documents: Document[] = [
    makeDoc("projects/proj/doc-1.json"),
    makeDoc("projects/proj/doc-2.json"),
    makeDoc("projects/proj/doc-3.json"),
  ];

  it("fills selected document paths when archive has no args", () => {
    const selected = [documents[0].path, documents[2].path];
    const result = preprocessCommand("archive", documents, selected);
    expect(result).toBe(
      `archive ${documents[0].path},${documents[2].path}`,
    );
  });

  it("fills selected document paths before --hard flag", () => {
    const selected = [documents[1].path];
    const result = preprocessCommand("delete --hard", documents, selected);
    expect(result).toBe(`delete ${documents[1].path} --hard`);
  });

  it("keeps original command when arguments already provided", () => {
    const selected = [documents[0].path];
    const result = preprocessCommand(
      `archive ${documents[2].path}`,
      documents,
      selected,
    );
    expect(result).toBe(`archive ${documents[2].path}`);
  });

  it("converts numeric shortcuts when no selection", () => {
    const result = preprocessCommand("archive 2", documents);
    expect(result).toBe(`archive ${documents[1].path}`);
  });
});
