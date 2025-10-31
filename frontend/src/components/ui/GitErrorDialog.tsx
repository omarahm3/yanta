import React from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { ParsedGitError } from "../../utils/gitErrorParser";
import { cn } from "../../lib/utils";
import {
  RiCloseLine,
  RiErrorWarningLine,
  RiInformationLine,
  RiAlertLine,
} from "react-icons/ri";

export interface GitErrorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  error: ParsedGitError | null;
}

export const GitErrorDialog: React.FC<GitErrorDialogProps> = ({
  isOpen,
  onClose,
  error,
}) => {
  if (!error) return null;

  const getIcon = () => {
    switch (error.type) {
      case "CONFLICT":
        return <RiAlertLine className="text-3xl text-yellow-500" />;
      case "NETWORK":
        return <RiErrorWarningLine className="text-3xl text-red-500" />;
      case "INFO":
        return <RiInformationLine className="text-3xl text-blue-500" />;
      default:
        return <RiErrorWarningLine className="text-3xl text-red-500" />;
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-lg bg-surface border border-border shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-start justify-between px-6 py-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    {getIcon()}
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-semibold text-text-bright"
                    >
                      {error.title}
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-text-dim hover:text-text-bright transition-colors"
                  >
                    <RiCloseLine className="text-2xl" />
                  </button>
                </div>

                <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="bg-bg rounded-lg p-4 border border-border">
                    <pre className="text-xs text-text-dim font-mono whitespace-pre-wrap break-words leading-relaxed">
                      {error.technicalDetails}
                    </pre>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border flex justify-end">
                  <button
                    onClick={onClose}
                    className={cn(
                      "px-4 py-2 rounded-md font-medium transition-colors",
                      "bg-blue-600 hover:bg-blue-700 text-white",
                    )}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};
