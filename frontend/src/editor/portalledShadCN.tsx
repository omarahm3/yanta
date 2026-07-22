/**
 * BlockNote's default shadcn components render Radix `Content` elements
 * inline (no Portal wrapper). Inline means the menu is a child of whatever
 * editor container holds it — so any `overflow: hidden / auto / scroll` or
 * transform ancestor in our layout clips or drifts the menu. The previous
 * workaround (manual repositioning, removing overflow on `.bn-container`)
 * only ever papered over the symptom.
 *
 * The proper fix: wrap `DropdownMenuContent` and `PopoverContent` in their
 * respective Radix Portal primitives. The portal renders the menu at the
 * document body, bypassing every editor-tree clipping ancestor and letting
 * Floating UI position the menu purely against the viewport.
 *
 * We pass this map to `<BlockNoteView shadCNComponents={...} />`.
 */

import { ShadCNDefaultComponents } from "@blocknote/shadcn";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ComponentProps, ReactNode } from "react";
import { useResolvedTheme } from "../shared/stores/theme.store";

const DefaultDropdownMenuContent = ShadCNDefaultComponents.DropdownMenu.DropdownMenuContent;
const DefaultDropdownMenuSubContent = ShadCNDefaultComponents.DropdownMenu.DropdownMenuSubContent;
const DefaultPopoverContent = ShadCNDefaultComponents.Popover.PopoverContent;

/**
 * Portalling menus to the document body escapes the editor's `.bn-root`
 * ancestor, which is where BlockNote scopes all of its CSS variables
 * (`.bn-root` / `.bn-root[data-color-scheme=dark]`) and descendant rules
 * (`.bn-root .bn-color-icon`, `.bn-shadcn .bn-menu-dropdown`). Without it,
 * the `--bn-colors-highlights-*` variables never resolve and the color
 * picker swatches render as plain inherited text (MRG-459). This frame
 * recreates the same class/attribute context around the portalled content.
 */
function BnRootFrame({ children }: { children: ReactNode }) {
	const theme = useResolvedTheme();
	return (
		<div className="bn-root bn-shadcn" data-color-scheme={theme}>
			{children}
		</div>
	);
}

function PortalledDropdownMenuContent(props: ComponentProps<typeof DefaultDropdownMenuContent>) {
	return (
		<DropdownMenuPrimitive.Portal>
			<BnRootFrame>
				<DefaultDropdownMenuContent {...props} />
			</BnRootFrame>
		</DropdownMenuPrimitive.Portal>
	);
}

function PortalledDropdownMenuSubContent(
	props: ComponentProps<typeof DefaultDropdownMenuSubContent>,
) {
	return (
		<DropdownMenuPrimitive.Portal>
			<BnRootFrame>
				<DefaultDropdownMenuSubContent {...props} />
			</BnRootFrame>
		</DropdownMenuPrimitive.Portal>
	);
}

function PortalledPopoverContent(props: ComponentProps<typeof DefaultPopoverContent>) {
	return (
		<PopoverPrimitive.Portal>
			<BnRootFrame>
				<DefaultPopoverContent {...props} />
			</BnRootFrame>
		</PopoverPrimitive.Portal>
	);
}

export const portalledShadCNComponents = {
	DropdownMenu: {
		...ShadCNDefaultComponents.DropdownMenu,
		DropdownMenuContent: PortalledDropdownMenuContent,
		DropdownMenuSubContent: PortalledDropdownMenuSubContent,
	},
	Popover: {
		...ShadCNDefaultComponents.Popover,
		PopoverContent: PortalledPopoverContent,
	},
};
