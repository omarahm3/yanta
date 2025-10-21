import React from "react";
import { cn } from "../../lib/utils";

export interface TableColumn {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "center" | "right";
}

export interface TableRow {
  id: string;
  [key: string]: any;
}

export interface TableProps {
  columns: TableColumn[];
  rows: TableRow[];
  selectedRowId?: string;
  onRowSelect?: (row: TableRow) => void;
  onRowDoubleClick?: (row: TableRow) => void;
  className?: string;
}

export const Table: React.FC<TableProps> = ({
  columns,
  rows,
  selectedRowId,
  onRowSelect,
  onRowDoubleClick,
  className,
}) => {
  const getColumnStyles = (column: TableColumn) => {
    const baseStyles = "px-3 py-2";
    const alignStyles = {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    };
    return cn(baseStyles, alignStyles[column.align || "left"]);
  };

  const gridTemplateColumns = columns.map((c) => c.width || "1fr").join(" ");

  return (
    <div className={cn("w-full", className)}>
      {/* Table Header */}
      <div
        className="grid mb-2 border-b border-border"
        style={{ gridTemplateColumns }}
      >
        {columns.map((column) => (
          <div
            key={column.key}
            className={cn(
              "px-3 py-2 text-text-dim text-xs uppercase tracking-wider font-medium",
              getColumnStyles(column),
            )}
          >
            {column.label}
          </div>
        ))}
      </div>

      {/* Table Rows */}
      <div className="space-y-0.5">
        {rows.map((row) => (
          <div
            key={row.id}
            className={cn(
              "grid rounded cursor-pointer transition-all duration-100 items-center",
              "hover:bg-surface focus:outline-none focus:ring-2 focus:ring-accent focus:ring-opacity-50",
              selectedRowId === row.id && "bg-surface border-l-2 border-accent",
            )}
            style={{ gridTemplateColumns }}
            tabIndex={0}
            onClick={() => onRowSelect?.(row)}
            onDoubleClick={() => onRowDoubleClick?.(row)}
          >
            {columns.map((column) => (
              <div
                key={column.key}
                className={cn("px-3 py-2.5 text-sm", getColumnStyles(column))}
              >
                {row[column.key]}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
