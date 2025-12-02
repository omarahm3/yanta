import type { LinkToolbarProps } from "@blocknote/react";
import {
	DeleteLinkButton,
	EditLinkButton,
	LinkToolbarController,
	useComponentsContext,
	useDictionary,
} from "@blocknote/react";
import { Browser } from "@wailsio/runtime";
import { useCallback } from "react";
import { RiExternalLinkFill } from "react-icons/ri";

const resolveUrl = (url: string, baseUrl: string): string => {
	try {
		return new URL(url, baseUrl).href;
	} catch {
		return url;
	}
};

const openLinkExternally = (url: string): void => {
	Browser.OpenURL(url).catch(() => {
		window.open(url, "_blank", "noopener,noreferrer");
	});
};

const CustomOpenLinkButton = ({ url }: Pick<LinkToolbarProps, "url">) => {
	const Components = useComponentsContext()!;
	const dict = useDictionary();

	const handleClick = useCallback(() => {
		openLinkExternally(resolveUrl(url, window.location.href));
	}, [url]);

	return (
		<Components.LinkToolbar.Button
			className="bn-button"
			mainTooltip={dict.link_toolbar.open.tooltip}
			label={dict.link_toolbar.open.tooltip}
			isSelected={false}
			onClick={handleClick}
			icon={<RiExternalLinkFill />}
		/>
	);
};

const CustomLinkToolbar = (props: LinkToolbarProps) => {
	const Components = useComponentsContext()!;

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
