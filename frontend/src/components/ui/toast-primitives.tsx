import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import type React from "react";
import { forwardRef } from "react";
import { cn } from "../../lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = forwardRef<
	React.ElementRef<typeof ToastPrimitives.Viewport>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
	<ToastPrimitives.Viewport
		ref={ref}
		className={cn(
			"fixed z-50 flex flex-col gap-2 p-4 pointer-events-none max-h-screen w-full sm:max-w-lg",
			className,
		)}
		{...props}
	/>
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
	"pointer-events-auto w-full min-w-[280px] sm:min-w-[340px] max-w-[calc(100vw-2rem)] sm:max-w-lg overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 text-gray-900 shadow-2xl ring-1 ring-black/5 backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/95 dark:text-slate-100 transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full sm:data-[state=open]:slide-in-from-right-full",
	{
		variants: {
			variant: {
				default: "border-l-4 border-sky-400/80",
				success: "border-l-4 border-emerald-400/80",
				error: "border-l-4 border-rose-400/80",
				warning: "border-l-4 border-amber-300/80",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

const Toast = forwardRef<
	React.ElementRef<typeof ToastPrimitives.Root>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
	return (
		<ToastPrimitives.Root
			ref={ref}
			className={cn(toastVariants({ variant }), className)}
			{...props}
		/>
	);
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = forwardRef<
	React.ElementRef<typeof ToastPrimitives.Action>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
	<ToastPrimitives.Action
		ref={ref}
		className={cn(
			"inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
			className,
		)}
		{...props}
	/>
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = forwardRef<
	React.ElementRef<typeof ToastPrimitives.Close>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
	<ToastPrimitives.Close
		ref={ref}
		className={cn(
			"inline-flex p-1 text-gray-400 bg-transparent rounded-md hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-white dark:text-slate-500 dark:hover:text-slate-300 dark:focus:ring-offset-slate-900",
			className,
		)}
		toast-close=""
		{...props}
	>
		<X className="h-5 w-5" />
	</ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = forwardRef<
	React.ElementRef<typeof ToastPrimitives.Title>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
	<ToastPrimitives.Title
		ref={ref}
		className={cn("text-base font-semibold text-gray-900 dark:text-slate-50", className)}
		{...props}
	/>
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = forwardRef<
	React.ElementRef<typeof ToastPrimitives.Description>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
	<ToastPrimitives.Description
		ref={ref}
		className={cn(
			"mt-1 text-sm leading-relaxed text-gray-600 dark:text-slate-300 whitespace-pre-wrap",
			className,
		)}
		{...props}
	/>
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;
type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
	type ToastProps,
	type ToastActionElement,
	ToastProvider,
	ToastViewport,
	Toast,
	ToastTitle,
	ToastDescription,
	ToastClose,
	ToastAction,
};
