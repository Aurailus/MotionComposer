import { createContext } from 'preact';
import { Signal } from '@preact/signals';
import { Vector2 } from '@motion-canvas/core';
import { useContext, useState, useEffect } from 'preact/hooks';

import { Signalish } from './Signalish';
import { Clip, ClipSource } from './Types';

export const ClipsContext = createContext<{ clips: Signalish<readonly Clip[][]> }>({} as any);

export function useClips() {
	return useContext(ClipsContext).clips;
}

export const CurrentClipContext = createContext<{ clip: Signal<Clip> }>({} as any);

export function useCurrentClip() {
	const currentClipSignal = useContext(CurrentClipContext).clip;
	const [ clip, setClip ] = useState<Clip>(currentClipSignal.peek());
	useEffect(() => currentClipSignal.subscribe(setClip), [ currentClipSignal ]);
	return clip;
}

export interface UIContextData {
	mediaTabOpen: boolean;

	updateMediaTabOpen: (open: boolean) => void;

	addSource: Signal<ClipSource>;
	addSourceDragPos: Signal<Vector2>;
}

export const UIContext = createContext<UIContextData>({} as any);

export function useUIContext() {
	return useContext(UIContext);
}
