import { createContext } from 'preact';
import { Signalish } from './Signalish';
import { SerializedClip } from './Types';
import { Scene } from '@motion-canvas/core';

export interface PluginContextData {
	clips: Signalish<readonly SerializedClip[][]>;

	/** Called by the media tab -- hides the timeline media pane if the media tab is open. */
	handleMediaTabVisibilityChange: (visible: boolean) => void;

	/** Returns the frame range in the timeline that a clip occupies. */
	getClipFrameRange(clip: SerializedClip): [ number, number ];

	/** Returns the frame range in underlying motion canvas project that a clip occupies. Only if it's a scene clip. */
	getClipRawFrameRange(clip: SerializedClip): [ number, number ] | undefined;

	/** Returns the underlying scene a clip renders, if it's a scene clip. */
	getClipScene(clip: SerializedClip): Scene | undefined;

	/** Returns the frame length of a scene. */
	getSceneFrameLength(scene: Scene): number;
}

export const PluginContext = createContext<PluginContextData>({} as PluginContextData);
