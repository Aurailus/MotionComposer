import { Scene } from "@motion-canvas/core";

export type ClipType = 'scene' | 'video' | 'image' | 'audio';

export interface SerializedClip {

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
}

export interface CachedClipInfo {
	/** The number of frames into the scene that this clip should start at. */
	startFrames: number;

	/** The length of the clip in frames. */
	lengthFrames: number;

	/** The frame range for the clip in the timeline. */
	clipRange: [ number, number ];

	/** The clip's scene, if it has one. */
	scene?: Scene;
}
