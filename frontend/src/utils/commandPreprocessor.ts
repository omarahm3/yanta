import { Document } from "../types/Document";

const COMMANDS_WITH_NUMERIC_SHORTCUTS = [
  "doc",
  "archive",
  "unarchive",
  "delete",
];

export function preprocessCommand(
  command: string,
  documents: Document[],
): string {
  const trimmed = command.trim();

  const numberPattern = /^(\w+)\s+(\d+)$/;
  const match = trimmed.match(numberPattern);

  if (!match) {
    return command;
  }

  const [, cmd, numStr] = match;

  if (!COMMANDS_WITH_NUMERIC_SHORTCUTS.includes(cmd.toLowerCase())) {
    return command;
  }

  const num = parseInt(numStr, 10);

  if (num < 1 || num > documents.length) {
    return command;
  }

  const doc = documents[num - 1];
  if (!doc) {
    return command;
  }

  return `${cmd} ${doc.path}`;
}
