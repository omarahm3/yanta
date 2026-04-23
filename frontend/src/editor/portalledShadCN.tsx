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
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ShadCNDefaultComponents } from "@blocknote/shadcn";
import type { ComponentProps } from "react";

const DefaultDropdownMenuContent = ShadCNDefaultComponents.DropdownMenu.DropdownMenuContent;
const DefaultDropdownMenuSubContent = ShadCNDefaultComponents.DropdownMenu.DropdownMenuSubContent;
const DefaultPopoverContent = ShadCNDefaultComponents.Popover.PopoverContent;

function PortalledDropdownMenuContent(
	props: ComponentProps<typeof DefaultDropdownMenuContent>,
) {
	return (
		<DropdownMenuPrimitive.Portal>
			<DefaultDropdownMenuContent {...props} />
		</DropdownMenuPrimitive.Portal>
	);
}

function PortalledDropdownMenuSubContent(
	props: ComponentProps<typeof DefaultDropdownMenuSubContent>,
) {
	return (
		<DropdownMenuPrimitive.Portal>
			<DefaultDropdownMenuSubContent {...props} />
		</DropdownMenuPrimitive.Portal>
	);
}

function PortalledPopoverContent(props: ComponentProps<typeof DefaultPopoverContent>) {
	return (
		<PopoverPrimitive.Portal>
			<DefaultPopoverContent {...props} />
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
