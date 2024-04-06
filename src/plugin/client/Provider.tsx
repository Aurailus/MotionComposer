/* @jsxImportSource preact */

import { ComponentChildren } from 'preact';
import { useSignal } from '@preact/signals';
import { Vector2 } from '@motion-canvas/core';
import { useEffect, useState, useMemo } from 'preact/hooks';

import { ClipSource } from './Types';
import { addEventListener } from './Util';
import { UIContext, ShortcutsContext } from './Contexts';
import { ShortcutModule } from './shortcut/ShortcutMappings';

export default function Provider({ children }: { children: ComponentChildren }) {
	const [ mediaTabVisible, setMediaTabVisible ] = useState(false);

	const addSource = useSignal<ClipSource | null>(null);
	const addSourceDragPos = useSignal<Vector2>(new Vector2());

	const shortcutModule = useState<ShortcutModule>('global');

	// Display viewport shortcuts.

	const viewport = document.querySelector('[class^="_viewport_"]');
	useEffect(() => {
		const toRemove: (() => void)[] = [];
		if (!viewport) return;
		toRemove.push(addEventListener(viewport, 'mouseenter', () => shortcutModule[1]('viewport')));
		toRemove.push(addEventListener(viewport, 'mouseleave', () => shortcutModule[1]('global')));
		return () => toRemove.forEach(fn => fn());
	}, [ viewport ]);

	// All the context values (so many).

	const uiContextData = useMemo(() => ({
		mediaTabOpen: mediaTabVisible,
		updateMediaTabOpen: setMediaTabVisible,
		addSource,
		addSourceDragPos
	}), [ mediaTabVisible ]);

	const shortcutsContextData = useMemo(() => ({
		currentModule: shortcutModule[0], setCurrentModule: shortcutModule[1] }), [ shortcutModule ]);

	return (
		<UIContext.Provider value={uiContextData}>
			<ShortcutsContext.Provider value={shortcutsContextData}>
				{children}
			</ShortcutsContext.Provider>
		</UIContext.Provider>
	);
}
