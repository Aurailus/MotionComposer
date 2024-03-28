import { ClipSource } from './Types';
import { signal } from '@preact/signals';
import { Scene } from '@motion-canvas/core';
import { useRef, useEffect } from 'preact/hooks';

const AUDIO_FILES = import.meta.glob(`/media/*.(wav|mp3|ogg|flac)`, { query: '?meta' });
const VIDEO_FILES = import.meta.glob(`/media/*.(mp4|mkv|webm)`, { query: '?meta' });
const IMAGE_FILES = import.meta.glob(`/media/*.(png|jpg|jpeg|webp)`, { query: '?meta' });

let sources = signal<ClipSource[]>([]);

function replaceSourcesOfType(type: string, insert: ClipSource[]) {
	const existingOfType = sources.peek().filter(s => s.type === type).sort((a, b) => a.path.localeCompare(b.path));
	const sortedInsert = [ ...insert ].sort((a, b) => a.path.localeCompare(b.path));

	let identical = existingOfType.length === sortedInsert.length;
	if (identical) {
		for (let i = 0; i < sortedInsert.length; i++) {
			const oldSc = existingOfType[i];
			const newSc = sortedInsert[i];
			if (oldSc.duration !== newSc.duration ||
				oldSc.name !== newSc.name ||
				oldSc.path !== newSc.path ||
				oldSc.scene !== newSc.scene) {
				identical = false;
				break;
			}
		}
	}

	if (identical) return;

	sources.value = [
		...sources.peek().filter(s => s.type !== type),
		...sortedInsert,
	];
}

const INTERNAL_SCENES = [ 'EmptyTimelineScene', 'MissingClipScene', 'VideoClipScene' ];

Promise.all(Object.values(AUDIO_FILES).map(async (f) =>
	(await f() as any).default)).then(sources => replaceSourcesOfType('audio', sources));

Promise.all(Object.values(VIDEO_FILES).map(async (f) =>
	(await f() as any).default)).then(sources => replaceSourcesOfType('video', sources));

Promise.all(Object.values(IMAGE_FILES).map(async (f) =>
	(await f() as any).default)).then(sources => replaceSourcesOfType('image', sources));

export function updateSceneSources(scenes: Scene[]) {
	console.warn('UPDATE SCENE SOURCES');
	replaceSourcesOfType('scene', scenes.filter(({ name }) => !INTERNAL_SCENES.includes(name)).map(scene => ({
		type: 'scene',
		path: scene.name,
		name: scene.name,
		duration: scene.playback.framesToSeconds(scene.lastFrame - scene.firstFrame),
		scene: scene,
	})));
}

export function getSources() {
	return sources.peek();
}

export function useSources() {
	return sources.value;
}
