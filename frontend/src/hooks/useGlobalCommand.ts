import { useCallback } from "react";
import * as GlobalCommands from "../../bindings/yanta/internal/commandline/globalcommands";
import type * as commandlineModels from "../../bindings/yanta/internal/commandline/models";
import { useProjectContext } from "../contexts";
import { projectFromModel } from "../types";

const GLOBAL_COMMANDS = ["switch", "sync", "quit"];

export const useGlobalCommand = () => {
	const { setCurrentProject, loadProjects } = useProjectContext();

	const executeGlobalCommand = useCallback(
		async (
			command: string,
		): Promise<{
			handled: boolean;
			success?: boolean;
			message?: string;
			result?: commandlineModels.GlobalResult;
		}> => {
			const trimmedCommand = command.trim().toLowerCase();

			const isGlobalCommand = GLOBAL_COMMANDS.some((cmd) => trimmedCommand.startsWith(cmd));

			if (!isGlobalCommand) {
				return { handled: false };
			}

			try {
				const result = await GlobalCommands.Parse(command);

				if (!result) {
					return {
						handled: true,
						success: false,
						message: "Command returned null",
					};
				}

				if (result.success && result.data?.project) {
					const project = projectFromModel(result.data.project);
					setCurrentProject(project);
					await loadProjects();
				}

				return {
					handled: true,
					success: result.success,
					message: result.message,
					result: result || undefined,
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
