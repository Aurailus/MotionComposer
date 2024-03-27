import { createContext } from 'preact';
import { useContext, useState, useEffect } from 'preact/hooks';
import { Signal } from '@preact/signals';

import { Clip } from './Types';
import { Signalish } from './Signalish';

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
}

export const UIContext = createContext<UIContextData>({} as any);

export function useUIContext() {
	return useContext(UIContext);
}
