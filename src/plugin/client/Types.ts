import { Scene } from "@motion-canvas/core";

export type ClipType = 'scene' | 'video' | 'image' | 'audio';

export interface SerializedClip {
	/** The type of this clip. */
	type: ClipType;

	/**
	 * The relative filepath of the source in the media directory if `type` is 'Media', or
	 * the name of the scene if `type` is 'Scene'.
	 */

	path: string;

	/** The beginning and end times of the source in seconds. If the end time is zero, the clip goes to the end of the source. */
	range: [ number, number ];

	/** The volume of the clip, as a multiplier from 0 to 1. */
	volume: number;
}

export interface CachedClipInfo {
	rawFrameRange: [ number, number ];
	frameRange: [ number, number ];
	scene?: Scene;
}
