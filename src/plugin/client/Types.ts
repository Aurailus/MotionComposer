import { Scene } from "@motion-canvas/core";

export type ClipType = 'scene' | 'video' | 'image' | 'audio';

export interface ClipSource {
	type: ClipType;

	path: string;

	thumbnail?: string;

	peaks?: number[];

	length: number;
}

export interface ClipInfo {
	/** The number of frames into the scene that this clip should start at. */
	startFrames: number;

	/** The length of the clip in frames. */
	lengthFrames: number;

	/** The frame range for the clip in the timeline. */
	clipRange: [ number, number ];

	/** The length of the source in frames. */
	sourceFrames: number;

	/** The clip's scene, if it has one. */
	scene?: Scene;
}

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

	/** Cached clip info. */
	cache?: ClipInfo;
}

export function copyClip(clip: Clip): Clip {
	const cacheSafe = { ...clip.cache };
	delete cacheSafe.scene;
	const newClip = JSON.parse(JSON.stringify({ ...clip, cache: cacheSafe }));
	newClip.cache.scene = clip.cache.scene;
	return newClip;
}
