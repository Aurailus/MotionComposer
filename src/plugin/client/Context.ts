import { Signal } from '@preact/signals';
import { createContext } from 'preact';
import { Signalish } from './Signalish';
import { SerializedClip } from './Types';
import { Scene, Subscribable } from '@motion-canvas/core';

export interface PluginContextData {
	/** All of the clips in the scene. Index 0 is video, everything else is audio. */
	clips: Signalish<readonly SerializedClip[][]>;

	/** The length of the project in frames. */
	range: Signal<[ number, number ]>;

	/** The length of the user-selected playback range in frames.  */
	userRange: Signal<[ number, number ]>;

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

	/** The playhead's position in the Motion Composer timeline. */
	playheadPos: Signalish<number>;

	/** The playhead's position in the raw Motion Canvas project. */
	rawPlayheadPos: Signalish<number>;

	/** Get a raw timeline position from a motion composer timeline position. */
	getRawPos(pos: number): number;
}

export const PluginContext = createContext<PluginContextData>({} as PluginContextData);
