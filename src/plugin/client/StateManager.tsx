/* @jsxImportSource preact */

import { ComponentChildren } from 'preact';
import { useSignal } from '@preact/signals';
import { ProjectMetadata, Scene } from '@motion-canvas/core';
import { useApplication, useScenes, } from '@motion-canvas/ui';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo } from 'preact/hooks';

import { ensure } from './Util';
import { useSignalish } from './Signalish';
import { Clip, ClipSource, PluginSettings } from './Types';
import { getUUIDNext, setUUIDNext, useStore } from './Hooks';
import { ClipsContext, CurrentClipContext, UIContext } from './Contexts';

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
	const settings = useMemo(() => {
		const settings = metaPluginSettings(project.meta)
		setUUIDNext(settings.get('uuidNext') ?? 0);
		return settings;
	}, [ project.meta ]);

	const clipsStore = useStore<Clip[][]>([]);
	const sceneSubscriptions = useRef<Map<Scene, (() => void)>>(new Map());

	const clip = useSignal<Clip | null>(null);

	const dragging = useSignal<ClipSource | null>(null);

	/**
	 * Refresh cached clip data, including frame ranges and scene subscriptions.
	 * Scene subscriptions are needed to re-call this function when a scene's event timings change,
	 * as this will change the scene's frame ranges.
	 */

	const cacheClipData = useCallback((immediate = false) => {
		console.warn('REFRESHING CLIPS CACHE');

		let endTime = 0;
		const hangingScenes = new Set<Scene>([ ...sceneSubscriptions.current.keys() ]);

		clips().forEach((layer) => {
			let lastEndFrames = -1;

			layer.forEach((clip) => {
				let scene = clip.type === 'scene' && scenes.find(s => s.name === clip.path) || undefined;
				ensure(scene, 'Scene is missing, or tried to cache a non-scene clip.');

				const sourceFrames = scene.lastFrame - scene.firstFrame;
				const offsetFrames = scene.playback.secondsToFrames(clip.offset);
				const startFrames = scene.playback.secondsToFrames(clip.start);
				const lengthFrames = scene.playback.secondsToFrames(clip.length);

				ensure(offsetFrames >= lastEndFrames, 'Clips must not overlap.');
				lastEndFrames = offsetFrames + lengthFrames;

				const clipRange = [ offsetFrames, offsetFrames + lengthFrames ] as [ number, number ];

				ensure(startFrames >= 0 && startFrames < sourceFrames,
					'Clip start out of bounds.');
				ensure(lengthFrames > 0 && startFrames + lengthFrames <= sourceFrames,
					'Clips length out of bounds.')
				ensure(clipRange[0] >= 0 && clipRange[1] > clipRange[0],
					'Clip must not end before it begins.');

				clip.cache = {
					clipRange,
					lengthFrames,
					startFrames,
					sourceFrames,
					scene
				};

				if (hangingScenes.has(scene)) hangingScenes.delete(scene);

				if (!sceneSubscriptions.current.has(scene)) {
					sceneSubscriptions.current.set(scene, scene.onRecalculated.subscribe(() => {
						cacheClipData();
					}));
				}

				hangingScenes.forEach(scene => {
					sceneSubscriptions.current.get(scene)?.();
					sceneSubscriptions.current.delete(scene);
				});

				endTime = Math.max(endTime, clip.offset + clip.length);
			});
		});

		if (!immediate) clips([ ...clips() ]);
	}, []);

	const clips = useSignalish(() => clipsStore(), useCallback((clips: Clip[][]) => {
		console.warn('SETTING CLIPS');
		clipsStore(clips);
		cacheClipData(true);
		settings.set('clips', [ ...clips ].map(channel => [ ...channel.map(clip => ({ ...clip, cache: undefined })) ]));
		settings.set('uuidNext', getUUIDNext());
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
			volume: 0,
			uuid: -1
		};

		clip.value = clipsStore()?.[0]?.[0] ?? null;

		/** Helper function to get the best clip for a current frame, and update the current clip & cached clip data. */

		function getBestClip(frame: number): Clip {
			const clips = clipsStore()?.[0] ?? [];

			let prev: Clip | null = null;
			let next: Clip | null = null;

			for (let candidate of clips) {
				ensure(candidate.cache, 'Uncached clip found!');
				if (candidate.cache.clipRange[1] < frame) prev = candidate;
				if (frame >= candidate.cache.clipRange[0] && frame < candidate.cache.clipRange[1]) {
					clip.value = candidate;
					return clip.value;
				}
				else if (frame < candidate.cache.clipRange[0]) {
					next = candidate;
					break;
				}
			}

			clip.value = EMPTY_TIMELINE_CLIP;
			const clipRange: [ number, number ] = [
				prev ? prev.cache.clipRange[1] : 0,
				next ? next.cache.clipRange[0] : (player as any).endFrame ];
			clip.value.cache = {
				clipRange,
				lengthFrames: clipRange[1] - clipRange[0],
				startFrames: 0,
				sourceFrames: clipRange[1] - clipRange[0],
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
			getBestClip(clip.value?.cache.clipRange[1] ?? 0);
			if (!clip.value) return null;
			return clip.value.cache.scene;
		}).bind(player.playback);


		/** Override PlaybackManager.findBestScene() method to find the best scene from the clips array.  */

		(player.playback as any).findBestScene = (function(frame: number) {
			getBestClip(frame);
			return clip.value.cache.scene;
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
			if (this.currentScene.canTransitionOut() || this.frame >= clip.value.cache.clipRange[1]) {
				this.previousScene = this.currentScene;
				const nextScene = this.getNextScene(this.previousScene);
				if (nextScene) {
					this.currentScene = nextScene;
					await this.currentScene.reset(this.previousScene);
					await advanceSceneWithoutSeek(this.currentScene, clip.value.cache.startFrames);
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
					this.frame = clip.value.cache.clipRange[0] ?? 0;

					// Reset the current scene.
					await this.currentScene.reset();
					await advanceSceneWithoutSeek(this.currentScene, clip.value.cache.startFrames);
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
			const duration = (clipsStore()?.[0]?.reduce((lastMax, clip) =>
				Math.max(lastMax, clip.cache.clipRange[1]), 0) ?? 0);
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

	const uiContextData = useMemo(() => ({
		mediaTabOpen: mediaTabVisible,
		updateMediaTabOpen: setMediaTabVisible,
		dragging
	}), [ mediaTabVisible ]);

	const clipsContextData = useMemo(() => ({ clips }), [ clips() ]);
	const currentClipContextData = useMemo(() => ({ clip }), []);

	return (
		<UIContext.Provider value={uiContextData}>
			<ClipsContext.Provider value={clipsContextData}>
				<CurrentClipContext.Provider value={currentClipContextData}>
					{children}
				</CurrentClipContext.Provider>
			</ClipsContext.Provider>
		</UIContext.Provider>
	);
}
