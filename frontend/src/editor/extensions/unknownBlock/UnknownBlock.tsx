import { createReactBlockSpec } from "@blocknote/react";
import { UNKNOWN_BLOCK_TYPE } from "./constants";
import "./unknownBlock.css";

export const unknownBlockSpec = createReactBlockSpec(
	{
		type: UNKNOWN_BLOCK_TYPE,
		propSchema: {
			originalType: { default: "" },
			originalJson: { default: "" },
		},
		content: "none",
	},
	{
		render: ({ block }) => {
			const originalType = block.props.originalType;
			return (
				<div className="yanta-unknown-block" contentEditable={false}>
					<span className="yanta-unknown-block__icon" aria-hidden="true">
						⚠
					</span>
					<span>
						Unsupported block
						{originalType ? (
							<>
								: <span className="yanta-unknown-block__type">{originalType}</span>
							</>
						) : null}
					</span>
				</div>
			);
		},
	},
)();
