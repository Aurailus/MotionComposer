import { createContext } from 'preact';
import { Signal } from '@preact/signals';
import { Vector2 } from '@motion-canvas/core';
import { useContext, useState, useEffect } from 'preact/hooks';

import { Signalish } from './Signalish';
import { Clip, ClipSource } from './Types';
import { ShortcutModule } from './shortcut/ShortcutMappings';

/** Clips Context. */

export const ClipsContext = createContext<{ clips: Signalish<readonly Clip[][]> }>({} as any);

export function useClips() {
	return useContext(ClipsContext).clips;
}

/** Current Clip Context. */

export const CurrentClipContext = createContext<{ clip: Signal<Clip> }>({} as any);

export function useCurrentClip() {
	const currentClipSignal = useContext(CurrentClipContext).clip;
	const [ clip, setClip ] = useState<Clip>(currentClipSignal.peek());
	useEffect(() => currentClipSignal.subscribe(setClip), [ currentClipSignal ]);
	return clip;
}

/** UI Context. */

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

/** Shortcuts Context. */

export interface ShortcutsContextData {
  currentModule: ShortcutModule;
  setCurrentModule: (module: ShortcutModule) => void;
};

export const ShortcutsContext = createContext<ShortcutsContextData>({} as any);

export function useShortcuts() {
  return useContext(ShortcutsContext);
}
