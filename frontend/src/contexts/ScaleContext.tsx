import type React from "react";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { GetAppScale } from "../../bindings/yanta/internal/system/service";

interface ScaleContextValue {
	scale: number;
	setScale: (scale: number) => void;
}

const ScaleContext = createContext<ScaleContextValue>({
	scale: 1.0,
	setScale: () => {},
});

interface ScaleProviderProps {
	children: ReactNode;
}

export const ScaleProvider: React.FC<ScaleProviderProps> = ({ children }) => {
	const [scale, setScale] = useState(1.0);

	useEffect(() => {
		GetAppScale()
			.then((value) => {
				setScale(value);
				applyScale(value);
			})
			.catch((err) => {
				console.error("Failed to load app scale:", err);
				applyScale(1.0);
			});
	}, []);

	useEffect(() => {
		applyScale(scale);
	}, [scale]);

	const applyScale = (scaleValue: number) => {
		document.documentElement.style.fontSize = `${scaleValue * 100}%`;
	};

	return <ScaleContext.Provider value={{ scale, setScale }}>{children}</ScaleContext.Provider>;
};

export const useScale = () => useContext(ScaleContext);
