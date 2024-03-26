import { Signal } from '@preact/signals';
import { createContext } from 'preact';
import { Signalish } from './Signalish';
import { Clip, ClipInfo } from './Types';
import { Scene } from '@motion-canvas/core';

export interface PluginContextData {
	/** All of the clips in the scene. Index 0 is video, everything else is audio. */
	clips: Signalish<readonly Clip[][]>;

	/** The currently active clip. */
	clip?: Signal<Clip>;

	/** Called by the media tab -- hides the timeline media pane if the media tab is open. */
	handleMediaTabVisibilityChange: (visible: boolean) => void;

	/** Returns the frame range in the timeline that a clip occupies. */
	getClipFrameRange(clip: Clip): [ number, number ];

	/** Returns the underlying scene a clip renders, if it's a scene clip. */
	getClipScene(clip: Clip): Scene | undefined;

	/** Returns the frame length of a scene. */
	getSceneFrameLength(scene: Scene): number;
}

export const PluginContext = createContext<PluginContextData>({} as PluginContextData);
