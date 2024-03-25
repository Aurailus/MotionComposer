/* @jsxImportSource preact */

import { useSignal } from '@preact/signals';
import { PluginContext, PluginContextData } from './Context';
import { PlaybackState, PlaybackStatus, ProjectMetadata, Scene, Vector2, endPlayback, endScene, startPlayback, startScene } from '@motion-canvas/core';
import { useApplication, useCurrentScene, useScenes, useStorage } from '@motion-canvas/ui';
import { ComponentChildren } from 'preact';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { CachedClipInfo, SerializedClip } from './Types';
import PluginSettings from './Settings';
import { useSignalish } from './Signalish';
import { ensure, useStore } from './Util';

function metaPluginSettings(meta: ProjectMetadata) {
	return {
		get<T extends keyof PluginSettings>(field: T, def?: PluginSettings[T]): PluginSettings[T] {
			return (meta.get() as any)['motion-composer']?.[field] ?? def;
		},
		set<T extends keyof PluginSettings>(field: T, value: PluginSettings[T]) {
			meta.set({ 'motion-composer': { ...(meta.get() as any)['motion-composer'] ?? {}, [field]: value } } as any);
		}
	}
};

export default function StateManager({ children }: { children: ComponentChildren }) {
	const [ mediaTabVisible, setMediaTabVisible ] = useState(false);

  const scenes = useScenes();
	const { project, player } = useApplication();
	const settings = metaPluginSettings(project.meta);

	const clipsStore = useStore<SerializedClip[][]>([]);
	const clipsCache = useStore<Map<SerializedClip, CachedClipInfo>>(new Map());
	const sceneSubscriptions = useRef<Map<Scene, (() => void)>>(new Map());

	const range = useSignal<[ number, number ]>([ 0, 0 ]);
	const userRange = useSignal<[ number, number ]>([ 0, 0 ]);

	/**
	 * Refresh cached clip data, including frame ranges and scene subscriptions.
	 * Scene subscriptions are needed to re-call this function when a scene's event timings change,
	 * as this will change the scene's frame ranges.
	 */

	const refreshClipsCache = useCallback(() => {
		console.warn('REFRESHING CLIPS CACHE');

		const hangingScenes = new Set<Scene>([ ...sceneSubscriptions.current.keys() ]);

		const newCache = new Map<SerializedClip, CachedClipInfo>(clips().flatMap((arr) => {

			let lastEndFrames = -1;

			return arr.map((clip): [ SerializedClip, CachedClipInfo ] => {
				let scene = clip.type === 'scene' && scenes.find(s => s.name === clip.path) || undefined;
				ensure(scene, 'Scene is missing, or tried to cache a non-scene clip.');

				const offsetFrames = scene.playback.secondsToFrames(clip.offset);
				const startFrames = scene.playback.secondsToFrames(clip.start);
				const lengthFrames = scene.playback.secondsToFrames(clip.length);

				// console.log({ lastEndFrames, offsetFrames, startFrames, lengthFrames })

				ensure(offsetFrames > lastEndFrames, 'Clips must not overlap.');
				lastEndFrames = offsetFrames + lengthFrames - 1;

				const sceneRange = [ scene.firstFrame, scene.lastFrame ] as [ number, number ];
				const rawClipRange = [ sceneRange[0] + 1 + startFrames,
					sceneRange[0] + 1 + startFrames + lengthFrames ] as [ number, number ];
				const clipRange = [ offsetFrames, offsetFrames + lengthFrames - 1 ] as [ number, number ];


				// console.log({ clip, sceneRange, rawClipRange, clipRange })

				ensure(sceneRange[0] >= 0 && sceneRange[1] - sceneRange[0] > 0, 'Scenes frame range invalid.');
				ensure(startFrames >= 0 && startFrames < sceneRange[1], 'Clip range start out of bounds.');
				ensure(lengthFrames > 0 && startFrames + lengthFrames < sceneRange[1], 'Clips range length out of bounds.')
				ensure(rawClipRange[0] > sceneRange[0] && rawClipRange[1] < sceneRange[1], 'Raw clip range out of bounds.');
				ensure(clipRange[0] >= 0 && clipRange[1] > clipRange[0], 'Clip range invalid.')

				// console.log(clip);

				const cached: CachedClipInfo = {
					clipRange,
					rawClipRange,
					sceneRange,
					scene
				};

				if (hangingScenes.has(scene)) hangingScenes.delete(scene);

				if (!sceneSubscriptions.current.has(scene)) {
					/** `onCacheChanged` triggers immediately when subscribed, so discard the first call. */
					let firstTrigger = true;
					sceneSubscriptions.current.set(scene, scene.onCacheChanged.subscribe(() => {
						if (firstTrigger) firstTrigger = false;
						else refreshClipsCache();
					}));
				}

				hangingScenes.forEach(scene => {
					sceneSubscriptions.current.get(scene)?.();
					sceneSubscriptions.current.delete(scene);
				});

				return [
					clip,
					cached
				];
			});
		}, 1));

		let endTime = 0;
		clips().forEach(ch => ch.forEach(c => endTime = Math.max(endTime, c.offset + c.length)));

		const userRangeAtEnd = userRange.value[1] === range.value[1];
		range.value = [ 0, endTime ];
		if (userRangeAtEnd) userRange.value = [ 0, endTime ];
		else userRange.value = [ userRange.value[0], Math.min(userRange.value[1], range.value[1]) ];

		clipsCache(newCache);
	}, []);

	const clips = useSignalish(() => clipsStore(), useCallback((clips: SerializedClip[][]) => {
		console.warn('SETTING CLIPS');
		clipsStore(clips);
		refreshClipsCache();
		settings.set('clips', clips);
		return clips;
	}, []));

	const currentClip = useRef<SerializedClip>(null);

	useLayoutEffect(() => {
		currentClip.current = clipsStore()?.[0]?.[0] ?? null;

		/** Override PlaybackManager.getNextScene() method to find the clip's next scene. */

		(player.playback as any).getNextScene = (function() {
			const clips = clipsStore()?.[0] ?? [];
			const cache = clipsCache();

			const ind = clips.indexOf(currentClip.current) + 1;
			const nextClip = clips[ind];

			if (!nextClip) return null;
			currentClip.current = nextClip;
			return cache.get(nextClip).scene;
		}).bind(player.playback);


		/** Override PlaybackManager.findBestScene() method to find the best scene from the clips array.  */

		const empty = scenes.find(s => s.name === 'EmptyTimelineScene');

		(player.playback as any).findBestScene = (function(frame: number) {
			const clips = clipsStore()?.[0] ?? [];
			const cache = clipsCache();

			for (let clip of clips) {
				let cached = cache.get(clip);
				if (frame >= cached.clipRange[0] && frame < cached.clipRange[1] + 1) {
					currentClip.current = clip;
					return cached.scene;
				}
			}

			currentClip.current = null;
			return empty;
		}).bind(player.playback);

		/** Override PlaybackManager.next() to detect clip endings and request the next scene properly. */

		(player.playback as any).next = (async function() {
			// Animate the previosu scene if it still exists, until the current scene stops.
			if (this.previousScene) {
				await this.previousScene.next();
				if (this.currentScene.isFinished()) this.previousScene = null;
			}

			// Move the frame counter.
			this.frame += this.speed;

			const currentClipEndFrame = player.status.secondsToFrames(
				currentClip.current.offset + currentClip.current.length);

			// What is this for??
			if (this.currentScene.isFinished()) {
				return true;
			}

			// Compute the next frame in the scene.
			await this.currentScene.next();

			// If the current scene is done transitioning, clear the previous scene.
			if (this.previousScene && this.currentScene.isAfterTransitionIn()) this.previousScene = null;

			// If the current scene is over, or the current clip is over, locate the next scene and move to it.
			if (this.currentScene.canTransitionOut() || this.frame >= currentClipEndFrame) {
				this.previousScene = this.currentScene;
				const nextScene = this.getNextScene(this.previousScene);
				if (nextScene) {
					this.currentScene = nextScene;
					await this.currentScene.reset(this.previousScene);
				}
				if (!nextScene || this.currentScene.isAfterTransitionIn()) this.previousScene = null;
			}

			return this.currentScene.isFinished();
		}).bind(player.playback);

		/** Override PlaybackManager.seek() method to swap to the right clip and shift its start frame. */

		(player.playback as any).seek = (async function(frame: number) {
			this.frame = frame;
			const scene = this.findBestScene(frame);
			if (scene !== this.currentScene) {
				this.previousScene = null;
				this.currentScene = scene;
				await this.currentScene.reset();
			}

			// // Find the best scene and seek to it properly.
			// if (frame <= this.frame || (currentClip.current
			// 	&& player.status.secondsToFrames(currentClip.current.offset + currentClip.current.length)) < frame) {
			// 	const scene = this.findBestScene(frame);
			// 	const clipStartFrame = player.status.secondsToFrames(currentClip.current?.start ?? 0);

			// 	// If the scene is different, update the current scene, and then shift the scene in to the `start`.
			// 	if (scene !== this.currentScene) {
			// 		this.previousScene = null;
			// 		this.currentScene = scene;
			// 		this.frame = this.currentScene.firstFrame;
			// 		await this.currentScene.reset();
			// 	}

			// 	// If the scene isn't different, but we're too far ahead, reset the scene and seek forwards.
			// 	else if (this.frame >= frame) {
			// 		this.previousScene = null;
			// 		this.frame = this.currentScene.firstFrame;
			// 		await this.currentScene.reset();
			// 	}

			// 	this.frame = frame;
			// 	const numFramesToRender = clipStartFrame;
			// 	for (let i = 0; i < numFramesToRender; i++) {
			// 		this.finished = await this.next();
			// 		if (this.finished) break;
			// 	}
			// }

			// const cached = clipsCache().get(currentClip.current);
			// if (!cached) {
			// 	console.warn('uncached clip');
			// 	this.frame = frame;
			// 	return;
			// }

			// // Seek to the right frame in the scene.
			// this.finished = false;
			// while (this.frame < frame && !this.finished) this.finished = await this.next();

		}).bind(player.playback);


		/* Augment Player.prepare() to set the right final duration. */

		const oldPlayerPrepare = (player as any).prepare.bind(player);

		(player as any).prepare = (async function() {
			const playerState = await oldPlayerPrepare();
			const cache = clipsCache();
			const duration = clipsStore()?.[0]?.reduce((lastMax, clip) =>
				Math.max(lastMax, cache.get(clip).clipRange[1]), 0) ?? 0;
			this.duration.current = duration;
			return playerState;
		}).bind(player);
	}, []);

	useEffect(() => {
		let cancel: () => void;
		cancel = player.onDurationChanged.subscribe((duration) => {
			if (duration <= 0) return;
			cancel();
			clips(settings.get('clips') ?? []);
		});
		return cancel;
	}, []);

	const getClipFrameRange = useCallback((clip: SerializedClip) => {
		return clipsCache().get(clip).clipRange;
	}, []);

	// const getClipRawFrameRange = useCallback((clip: SerializedClip) => {
	// 	return clipsCache().get(clip).rawClipRange;
	// }, []);

	const getClipScene = useCallback((clip: SerializedClip) => {
		return clipsCache().get(clip).scene;
	}, []);

	const getSceneFrameLength = useCallback((scene: Scene) => {
		return scene.lastFrame - scene.firstFrame;
	}, []);


	const ctx: PluginContextData = {
		handleMediaTabVisibilityChange: setMediaTabVisible,
		clips,
		getClipFrameRange,
		getClipScene,
		getSceneFrameLength,
	};

	return (
		<PluginContext.Provider value={ctx}>
			{children}
		</PluginContext.Provider>
	);
}
