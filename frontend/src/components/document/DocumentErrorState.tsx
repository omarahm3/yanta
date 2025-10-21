import React from "react";
import { Layout } from "../Layout";
import { SidebarSection } from "../ui";

interface DocumentErrorStateProps {
  sidebarSections: SidebarSection[];
  onNavigate?: (
    page: string,
    state?: Record<string, string | number | boolean | undefined>,
  ) => void;
}

export const DocumentErrorState: React.FC<DocumentErrorStateProps> = React.memo(
  ({ sidebarSections, onNavigate }) => (
    <Layout
      sidebarSections={sidebarSections}
      currentPage="document"
      showCommandLine={false}
    >
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-xl text-red">❌ Document Not Found</div>
        <div className="text-text-dim">
          Document could not be loaded. It may have been deleted or doesn't
          exist.
        </div>
        <button
          onClick={() => onNavigate?.("dashboard")}
          className="px-6 py-2 mt-4 font-medium transition-colors rounded bg-accent text-bg hover:bg-accent/90"
        >
          ← Back to Dashboard
        </button>
      </div>
    </Layout>
  ),
);

DocumentErrorState.displayName = "DocumentErrorState";
