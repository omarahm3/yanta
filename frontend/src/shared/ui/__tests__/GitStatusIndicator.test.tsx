import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GitStatus } from "../../hooks/useGitStatus";
import { GitStatusIndicator } from "../GitStatusIndicator";

const baseStatus: GitStatus = {
	enabled: true,
	isRepo: true,
	clean: true,
	modified: [],
	untracked: [],
	staged: [],
	deleted: [],
	renamed: [],
	conflicted: [],
	ahead: 0,
	behind: 0,
};

describe("GitStatusIndicator", () => {
	it("renders nothing when git is not enabled", () => {
		const { container } = render(<GitStatusIndicator status={{ ...baseStatus, enabled: false }} />);
		expect(container.firstChild).toBeNull();
	});

	it("renders nothing when status is null", () => {
		const { container } = render(<GitStatusIndicator status={null} />);
		expect(container.firstChild).toBeNull();
	});

	it("renders clean state with check icon", () => {
		render(<GitStatusIndicator status={baseStatus} />);
		expect(screen.getByText("Clean")).toBeInTheDocument();
	});

	it("renders changes count when there are modified files", () => {
		const status: GitStatus = { ...baseStatus, clean: false, modified: ["file1.ts", "file2.ts"] };
		render(<GitStatusIndicator status={status} />);
		expect(screen.getByText("2 changes")).toBeInTheDocument();
	});

	it("renders conflicts with warning icon", () => {
		const status: GitStatus = { ...baseStatus, clean: false, conflicted: ["conflict.ts"] };
		render(<GitStatusIndicator status={status} />);
		expect(screen.getByText("1 conflict")).toBeInTheDocument();
	});

	it("renders ahead/behind counts", () => {
		const status: GitStatus = { ...baseStatus, ahead: 2, behind: 1 };
		render(<GitStatusIndicator status={status} />);
		expect(screen.getByText("2")).toBeInTheDocument();
		expect(screen.getByText("1")).toBeInTheDocument();
	});

	it("renders spinner when loading", () => {
		const { container } = render(<GitStatusIndicator status={baseStatus} isLoading />);
		const spinner = container.querySelector(".animate-spin");
		expect(spinner).toBeInTheDocument();
	});

	it("renders compact variant without text", () => {
		const { container } = render(<GitStatusIndicator status={baseStatus} compact />);
		expect(screen.queryByText("Clean")).not.toBeInTheDocument();
		expect(container.querySelector("button")).toBeInTheDocument();
	});

	it("has aria-label on compact variant", () => {
		const { container } = render(<GitStatusIndicator status={baseStatus} compact />);
		const button = container.querySelector("button");
		expect(button).toHaveAttribute("aria-label", "Git: Clean");
	});

	it("applies green color for clean state", () => {
		const { container } = render(<GitStatusIndicator status={baseStatus} />);
		const button = container.querySelector("button");
		expect(button).toHaveClass("text-green");
	});

	it("applies yellow color for changes", () => {
		const status: GitStatus = { ...baseStatus, clean: false, modified: ["file.ts"] };
		const { container } = render(<GitStatusIndicator status={status} />);
		const button = container.querySelector("button");
		expect(button).toHaveClass("text-yellow");
	});

	it("applies red color for conflicts", () => {
		const status: GitStatus = { ...baseStatus, clean: false, conflicted: ["file.ts"] };
		const { container } = render(<GitStatusIndicator status={status} />);
		const button = container.querySelector("button");
		expect(button).toHaveClass("text-red");
	});

	it("calls onClick when clicked", () => {
		const onClick = vi.fn();
		const { container } = render(<GitStatusIndicator status={baseStatus} onClick={onClick} />);
		const button = container.querySelector("button");
		button?.click();
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("shows tooltip with status details", () => {
		const status: GitStatus = {
			...baseStatus,
			clean: false,
			modified: ["file1.ts"],
			ahead: 1,
			behind: 2,
		};
		const { container } = render(<GitStatusIndicator status={status} />);
		const button = container.querySelector("button");
		expect(button).toHaveAttribute("title");
		expect(button?.getAttribute("title")).toContain("Modified: 1");
		expect(button?.getAttribute("title")).toContain("1 ahead, 2 behind");
	});
});
