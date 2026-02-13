import type { LinkToolbarProps } from "@blocknote/react";
import {
	DeleteLinkButton,
	EditLinkButton,
	LinkToolbarController,
	useComponentsContext,
	useDictionary,
} from "@blocknote/react";
import { ExternalLink } from "lucide-react";
import { useCallback } from "react";
import { useNotification } from "../../../shared/hooks";
import { openExternalUrl } from "../../../shared/utils/openExternalUrl";

const CustomOpenLinkButton = ({ url }: Pick<LinkToolbarProps, "url">) => {
	const Components = useComponentsContext();
	if (!Components) throw new Error("Components context not found");
	const dict = useDictionary();
	const { error: notifyError } = useNotification();

	const handleClick = useCallback(() => {
		void openExternalUrl(url).then((result) => {
			if (!result.ok) {
				notifyError("Couldn't open link in your default browser.");
			}
		});
	}, [notifyError, url]);

	return (
		<Components.LinkToolbar.Button
			className="bn-button"
			mainTooltip={dict.link_toolbar.open.tooltip}
			label={dict.link_toolbar.open.tooltip}
			isSelected={false}
			onClick={handleClick}
			icon={<ExternalLink />}
		/>
	);
};

const CustomLinkToolbar = (props: LinkToolbarProps) => {
	const Components = useComponentsContext();
	if (!Components) throw new Error("Components context not found");

	return (
		<Components.LinkToolbar.Root className="bn-toolbar bn-link-toolbar">
			<EditLinkButton
				url={props.url}
				text={props.text}
				range={props.range}
				setToolbarFrozen={props.setToolbarFrozen}
				setToolbarOpen={props.setToolbarOpen}
			/>
			<CustomOpenLinkButton url={props.url} />
			<DeleteLinkButton range={props.range} setToolbarOpen={props.setToolbarOpen} />
		</Components.LinkToolbar.Root>
	);
};

export const CustomLinkToolbarController = () => {
	return <LinkToolbarController linkToolbar={CustomLinkToolbar} />;
};
