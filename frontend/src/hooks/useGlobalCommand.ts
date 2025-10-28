import { useCallback } from "react";
import { useProjectContext } from "../contexts";
import { projectFromModel } from "../types";
import * as GlobalCommands from "../../wailsjs/go/commandline/GlobalCommands";
import { commandline } from "../../wailsjs/go/models";

const GLOBAL_COMMANDS = ["switch", "sync"];

export const useGlobalCommand = () => {
  const { setCurrentProject, loadProjects } = useProjectContext();

  const executeGlobalCommand = useCallback(
    async (
      command: string,
    ): Promise<{
      handled: boolean;
      success?: boolean;
      message?: string;
      result?: commandline.GlobalResult;
    }> => {
      const trimmedCommand = command.trim().toLowerCase();

      const isGlobalCommand = GLOBAL_COMMANDS.some((cmd) =>
        trimmedCommand.startsWith(cmd),
      );

      if (!isGlobalCommand) {
        return { handled: false };
      }

      try {
        const result = await GlobalCommands.Parse(command);

        if (result.success && result.data?.project) {
          const project = projectFromModel(result.data.project);
          setCurrentProject(project);
          await loadProjects();
        }

        return {
          handled: true,
          success: result.success,
          message: result.message,
          result,
        };
      } catch (err) {
        console.error("Global command execution error:", err);
        return {
          handled: true,
          success: false,
          message: err instanceof Error ? err.message : "Command failed",
        };
      }
    },
    [setCurrentProject, loadProjects],
  );

  return {
    executeGlobalCommand,
    isGlobalCommand: (command: string) => {
      const trimmedCommand = command.trim().toLowerCase();
      return GLOBAL_COMMANDS.some((cmd) => trimmedCommand.startsWith(cmd));
    },
  };
};
