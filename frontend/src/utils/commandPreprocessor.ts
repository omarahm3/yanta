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
  selectedPaths: string[] = [],
): string {
  const pathCommandSet = new Set(["archive", "unarchive", "delete"]);
  const tokens = command.split(/\s+/);
  const rawCommand = tokens[0] ?? "";
  const commandLower = rawCommand.toLowerCase();

  if (
    selectedPaths.length > 0 &&
    pathCommandSet.has(commandLower) &&
    rawCommand.length > 0
  ) {
    const args = tokens.slice(1);
    const nonFlagArgs = args.filter((arg) => !arg.startsWith("-"));
    if (nonFlagArgs.length === 0) {
      const flags = args.filter((arg) => arg.startsWith("-"));
      const joinedPaths = selectedPaths.join(",");
      return [rawCommand, joinedPaths, ...flags].join(" ").trim();
    }
  }

  const singleNumberPattern = /^([\w-]+)\s+(\d+)(\s+.*)?$/;
  const multiNumberPattern = /^([\w-]+)\s+([\d,\s]+)(\s+.*)?$/;

  const singleMatch = command.match(singleNumberPattern);
  if (singleMatch) {
    const [, cmd, numStr, flags = ""] = singleMatch;

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

    return `${cmd} ${doc.path}${flags}`.trim();
  }

  const multiMatch = command.match(multiNumberPattern);
  if (multiMatch) {
    const [, cmd, numsStr, flags = ""] = multiMatch;

    if (!COMMANDS_WITH_NUMERIC_SHORTCUTS.includes(cmd.toLowerCase())) {
      return command;
    }

    const numbers = numsStr
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => parseInt(s, 10));

    if (numbers.some((n) => isNaN(n) || n < 1 || n > documents.length)) {
      return command;
    }

    const paths = numbers
      .map((n) => documents[n - 1])
      .filter((doc) => doc !== undefined)
      .map((doc) => doc.path);

    if (paths.length === 0) {
      return command;
    }

    return `${cmd} ${paths.join(",")}${flags}`.trim();
  }

  return command;
}
