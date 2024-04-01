import { Scene } from '@motion-canvas/core';

import SceneClipItem from './media/SceneClipItem';
import VideoClipItem from './media/VideoClipItem';
import ImageClipItem from './media/ImageClipItem';
import AudioClipItem from './media/AudioClipItem';

export const ClipTypes = [ 'scene', 'video', 'image', 'audio' ] as const;

export type ClipType = typeof ClipTypes[number];

export const ClipSourceComponents: Record<ClipType, typeof SceneClipItem> = {
	scene: SceneClipItem,
	video: VideoClipItem,
	image: ImageClipItem,
	audio: AudioClipItem,
} as const;

export interface PluginSettings {
	uuidNext: number;
	clips: Clip[][];
}

export interface ClipSource {
	/** The type of the clip source. */
	type: ClipType;

	/** The path of the clip source (in the filesystem, or the Scene name if it's a scene clip source.) */
	path: string;

	/** The name of the clip source. */
	name: string;

	/** The duration of the clip source. */
	duration: number;

	/** A thumbnail image for the clip source, if one exists. */
	thumbnail?: string;

	/** The audio peaks of the clip source, if it has audio. */
	peaks?: number[];

	/** The scene for this clip source, if the time is a scene. */
	scene?: Scene;
}

export type ClipInfo = {
	/** The number of frames into the scene that this clip should start at. */
	startFrames: number;

	/** The length of the clip in frames. */
	lengthFrames: number;

	/** The frame range for the clip in the timeline. */
	clipRange: [ number, number ];

	/** The channel index for this clip. */
	channel: number;

} & ({
	/** The clip's source. */
	source: ClipSource;

	/** The length of the source in frames. */
	sourceFrames: number;
} | {
	/** If the clip's source is undefined, don't have the sourceFrames property. */
	source: undefined;

	sourceFrames: undefined;
})

export interface Clip {
	/** A unique UUID for the clip. */
	uuid: number;

	/** The type of this clip. */
	type: ClipType;

	/** The path to the clip's resource. */
	path: string;

	/** The offset of the clip within its track. */
	offset: number;

	/** How far into the underlying resource this clip starts. */
	start: number;

	/** The length of the clip in seconds. */
	length: number;

	/** The volume of the clip, as a multiplier from 0 to 1. */
	volume: number;

	/** Cached clip info. This will exist if and only if the clip's source was resolved. */
	cache: ClipInfo;
}

export type EditorTool = 'select' | 'cut' | 'shift';
export type EditorMode = 'compose' | 'clip';

export function copyClip(clip: Clip): Clip {
	const cacheSafe = { ...clip.cache };
	delete cacheSafe.source;
	const newClip = structuredClone({ ...clip, cache: cacheSafe });
	newClip.cache.source = clip.cache.source;
	return newClip;
}
