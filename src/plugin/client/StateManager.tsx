/* @jsxImportSource preact */

import { useSignal } from '@preact/signals';
import { PluginContext, PluginContextData } from './Context';
import { PlaybackState, PlaybackStatus, ProjectMetadata, Scene, Vector2, endPlayback, endScene, startPlayback, startScene } from '@motion-canvas/core';
import { useApplication, useCurrentScene, useScenes, useStorage, useDuration } from '@motion-canvas/ui';
import { ComponentChildren } from 'preact';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { ClipInfo, Clip } from './Types';
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

	const clipsStore = useStore<Clip[][]>([]);
	const clipsCache = useStore<Map<Clip, ClipInfo>>(new Map());
	const sceneSubscriptions = useRef<Map<Scene, (() => void)>>(new Map());

	const clip = useSignal<Clip | null>(null);
	const clipInfo = useSignal<ClipInfo | null>(null);

	/**
	 * Refresh cached clip data, including frame ranges and scene subscriptions.
	 * Scene subscriptions are needed to re-call this function when a scene's event timings change,
	 * as this will change the scene's frame ranges.
	 */

	const refreshClipsCache = useCallback(() => {
		console.warn('REFRESHING CLIPS CACHE');

		const hangingScenes = new Set<Scene>([ ...sceneSubscriptions.current.keys() ]);

		const newCache = new Map<Clip, ClipInfo>(clips().flatMap((arr) => {

			let lastEndFrames = -1;

			return arr.map((clip): [ Clip, ClipInfo ] => {
				let scene = clip.type === 'scene' && scenes.find(s => s.name === clip.path) || undefined;
				ensure(scene, 'Scene is missing, or tried to cache a non-scene clip.');

				const offsetFrames = scene.playback.secondsToFrames(clip.offset);
				const startFrames = scene.playback.secondsToFrames(clip.start);
				const lengthFrames = scene.playback.secondsToFrames(clip.length);

				ensure(offsetFrames > lastEndFrames, 'Clips must not overlap.');
				lastEndFrames = offsetFrames + lengthFrames - 1;

				const clipRange = [ offsetFrames, offsetFrames + lengthFrames - 1 ] as [ number, number ];

				ensure(startFrames >= 0 && startFrames < scene.lastFrame - scene.firstFrame,
					'Clip start out of bounds.');
				ensure(lengthFrames > 0 && startFrames + lengthFrames < scene.lastFrame - scene.firstFrame,
					'Clips length out of bounds.')
				ensure(clipRange[0] >= 0 && clipRange[1] > clipRange[0],
					'Clip must not end before it begins.');

				const cached: ClipInfo = {
					clipRange,
					lengthFrames,
					startFrames,
					scene
				};

				if (hangingScenes.has(scene)) hangingScenes.delete(scene);

				if (!sceneSubscriptions.current.has(scene)) {
					sceneSubscriptions.current.set(scene, scene.onCacheChanged.subscribe(() => {
						refreshClipsCache();
					}, false));
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

		clipsCache(newCache);
	}, []);

	const clips = useSignalish(() => clipsStore(), useCallback((clips: Clip[][]) => {
		console.warn('SETTING CLIPS');
		clipsStore(clips);
		refreshClipsCache();
		settings.set('clips', clips);
		return clips;
	}, []));

	useLayoutEffect(() => {
		const EMPTY_TIMELINE_SCENE = scenes.find(s => s.name === 'EmptyTimelineScene') ?? null;
		const EMPTY_TIMELINE_CLIP: Clip = {
			type: 'scene',
			path: 'EmptyTimelineScene',
			length: 1,
			offset: 0,
			start: 0,
			volume: 0
		};

		clip.value = clipsStore()?.[0]?.[0] ?? null;
		clipInfo.value = clipsCache().get(clip.value) ?? null;


		/** Helper function to get the best clip for a current frame, and update the current clip & cached clip data. */

		function getBestClip(frame: number): Clip {
			const clips = clipsStore()?.[0] ?? [];
			const cache = clipsCache();

			let prev: Clip | null = null;
			let next: Clip | null = null;

			for (let candidate of clips) {
				let cached = cache.get(candidate);
				ensure(cached, 'Uncached clip found!');
				if (cached.clipRange[1] < frame) prev = candidate;
				if (frame >= cached.clipRange[0] && frame < cached.clipRange[1] + 1) {
					clip.value = candidate;
					clipInfo.value = cached;
					return clip.value;
				}
				else if (frame < cached.clipRange[0]) {
					next = candidate;
					break;
				}
			}

			clip.value = EMPTY_TIMELINE_CLIP;
			const clipRange: [ number, number ] = [
				prev ? cache.get(prev).clipRange[1] + 1 : 0,
				next ? cache.get(next).clipRange[0] - 1 : (player as any).endFrame ];
			clipInfo.value = {
				clipRange,
				lengthFrames: clipRange[1] - clipRange[0],
				startFrames: 0,
				scene: EMPTY_TIMELINE_SCENE
			}
			return clip.value
		}

		/** Helper method used by overridden PlaybackManager.seek() and PlaybackManager.next() to advance scene frames. */

		async function advanceSceneWithoutSeek(scene: Scene, frames: number) {
			for (let i = 0; i < frames / player.status.speed; i++) {
				await scene.next();
				ensure(!scene.isFinished(), 'Tried to advance past the end of a scene.');
			}
		}

		/** Override PlaybackManager.getNextScene() method to find the clip's next scene. */

		(player.playback as any).getNextScene = (function() {
			getBestClip(clipInfo.value?.clipRange[1] + 1 ?? 0);
			if (!clip.value) return null;
			return clipInfo.value.scene;
		}).bind(player.playback);


		/** Override PlaybackManager.findBestScene() method to find the best scene from the clips array.  */

		(player.playback as any).findBestScene = (function(frame: number) {
			getBestClip(frame);
			return clipInfo.value.scene;
		}).bind(player.playback);

		/** Override PlaybackManager.next() to detect clip endings and request the next scene properly. */

		(player.playback as any).next = (async function() {
			// Animate the previous scene if it still exists, until the current scene stops.
			if (this.previousScene) {
				await this.previousScene.next();
				if (this.currentScene.isFinished()) this.previousScene = null;
			}

			// Move the frame counter.
			this.frame += this.speed;

			// What is this for??
			if (this.currentScene.isFinished()) {
				return true;
			}

			// Compute the next frame in the scene.
			if (this.currentScene !== EMPTY_TIMELINE_SCENE) await this.currentScene.next();

			// If the current scene is done transitioning, clear the previous scene.
			if (this.previousScene && this.currentScene.isAfterTransitionIn()) this.previousScene = null;

			// If the current scene is over, or the current clip is over, locate the next scene and move to it.
			if (this.currentScene.canTransitionOut() || this.frame > clipInfo.value.clipRange[1]) {
				this.previousScene = this.currentScene;
				const nextScene = this.getNextScene(this.previousScene);
				if (nextScene) {
					this.currentScene = nextScene;
					await this.currentScene.reset(this.previousScene);
					await advanceSceneWithoutSeek(this.currentScene, clipInfo.value.startFrames);
				}
				if (!nextScene || this.currentScene.isAfterTransitionIn()) this.previousScene = null;
			}

			return this.currentScene.isFinished();
		}).bind(player.playback);

		/** Override PlaybackManager.seek() method to swap to the right clip and shift its start frame. */

		(player.playback as any).seek = (async function (frame: number) {
			// Frame is too high, we need to skip back to the start.
			if (this.frame > frame) {
				// Update the current scene if we need to.
				const scene = this.findBestScene(frame);
				if (scene !== this.currentScene) {
					this.previousScene = null;
					this.currentScene = scene;
				}

				if (scene !== EMPTY_TIMELINE_SCENE) {
					this.frame = clipInfo.value.clipRange[0] ?? 0;

					// Reset the current scene.
					await this.currentScene.reset();
					await advanceSceneWithoutSeek(this.currentScene, clipInfo.value.startFrames);
				}
				else {
					await this.currentScene.reset();
					this.frame = frame;
				}
			}

			// Frame is too low, we need to skip forward to the right frame.
			// next() will handle swapping the scene if necessary.
			while (this.frame < frame && !this.finished) {
				const finished = await this.next();
				if (finished) break;
			}
		}).bind(player.playback);


		/* Augment Player.prepare() to set the right final duration. */
		// hypothetically, it would be better to override PlaybackManager.recalculate() instead of Player.prepare(),
		// but when I tried to do that I got funky results.

		const oldPlayerPrepare = (player as any).prepare.bind(player);

		(player as any).prepare = (async function() {
			const playerState = await oldPlayerPrepare();
			const cache = clipsCache();
			const duration = clipsStore()?.[0]?.reduce((lastMax, clip) =>
				Math.max(lastMax, cache.get(clip).clipRange[1]), 0) ?? 0;
			this.duration.current = duration;
			this.playback.duration = duration;
			return playerState;
		}).bind(player);

		// const oldPlaybackRecalculate = player.playback.recalculate.bind(player.playback);
		// (player.playback as any).recalculate = (async function() {
		// 	await oldPlaybackRecalculate();
		// 	const cache = clipsCache();
		// 	const duration = clipsStore()?.[0]?.reduce((lastMax, clip) =>
		// 		Math.max(lastMax, cache.get(clip).clipRange[1]), 0) ?? 0;
		// 	this.duration = duration;
		// 	console.log(this.duration);
		// }).bind(player.playback);
	}, []);

	useEffect(() => {
		player.playback.recalculate();
	}, [ clipsStore() ]);


	useEffect(() => {
		let cancel: () => void;
		cancel = player.onDurationChanged.subscribe((duration) => {
			if (duration <= 0) return;
			cancel();
			clips(settings.get('clips') ?? []);
		});
		return cancel;
	}, []);

	const getClipFrameRange = useCallback((clip: Clip) => {
		return clipsCache().get(clip).clipRange;
	}, []);

	const getClipScene = useCallback((clip: Clip) => {
		return clipsCache().get(clip).scene;
	}, []);

	const getSceneFrameLength = useCallback((scene: Scene) => {
		return scene.lastFrame - scene.firstFrame;
	}, []);


	const ctx: PluginContextData = {
		handleMediaTabVisibilityChange: setMediaTabVisible,
		clips,
		clip,
		clipInfo,
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
