/* @jsxImportSource preact */

import { ComponentChildren } from 'preact';
import { useSignal } from '@preact/signals';
import { ProjectMetadata, Scene, Vector2 } from '@motion-canvas/core';
import { useApplication, useScenes } from '@motion-canvas/ui';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo } from 'preact/hooks';

import { addEventListener, ensure } from './Util';
import { useSignalish } from './Signalish';
import { Clip, ClipSource, PluginSettings } from './Types';
import { getUUIDNext, setUUIDNext, useStore } from './Hooks';
import { ClipsContext, CurrentClipContext, UIContext, ShortcutsContext } from './Contexts';
import { getSources, updateSceneSources, useSources } from './Sources';
import { setVideo } from './scenes/VideoClipScene';
import { setImage } from './scenes/ImageClipScene';
import { ShortcutModule } from './shortcut/ShortcutMappings';

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
	useEffect(() => updateSceneSources(scenes), [ scenes ]);
	const sources = useSources();

	const { project, player } = useApplication();
	const settings = useMemo(() => {
		const settings = metaPluginSettings(project.meta)
		setUUIDNext(settings.get('uuidNext') ?? 0);
		return settings;
	}, [ project.meta ]);

	const clipsStore = useStore<Clip[][]>([]);
	const sceneSubscriptions = useRef<Map<Scene, (() => void)>>(new Map());

	const clip = useSignal<Clip | null>(null);

	const addSource = useSignal<ClipSource | null>(null);
	const addSourceDragPos = useSignal<Vector2>(new Vector2());

	const shortcutModule = useState<ShortcutModule>('global');

	/**
	 * Refresh cached clip data, including frame ranges and scene subscriptions.
	 * Scene subscriptions are needed to re-call this function when a scene's event timings change,
	 * as this will change the scene's frame ranges.
	 */

	const cacheClipData = useCallback((immediate = false) => {
		console.warn('REFRESHING CLIPS CACHE');

		let endTime = 0;
		const hangingScenes = new Set<Scene>([ ...sceneSubscriptions.current.keys() ]);
		const sources = getSources();

		clips().forEach((layer) => {
			let lastEndFrames = -1;

			for (let clip of layer) {
				let source = sources.find(s => s.name === clip.path && s.type === clip.type);

				const sourceFrames = source
					? player.status.secondsToFrames(source.duration)
					: undefined;
				const offsetFrames = player.status.secondsToFrames(clip.offset);
				const startFrames = player.status.secondsToFrames(clip.start);
				const lengthFrames = player.status.secondsToFrames(clip.length);

				ensure(offsetFrames >= lastEndFrames, 'Clips must not overlap.');
				lastEndFrames = offsetFrames + lengthFrames;

				const clipRange = [ offsetFrames, offsetFrames + lengthFrames ] as [ number, number ];

				ensure(!sourceFrames || (startFrames >= 0 && startFrames < sourceFrames),
					'Clip start out of bounds.');
				ensure(!sourceFrames || (lengthFrames > 0 && startFrames + lengthFrames <= sourceFrames),
					'Clips length out of bounds.')
				ensure(clipRange[0] >= 0 && clipRange[1] > clipRange[0],
					'Clip must not end before it begins.');

				clip.cache = {
					clipRange,
					lengthFrames,
					startFrames,
					sourceFrames,
					source
				};

				if (source?.scene && hangingScenes.has(source.scene)) hangingScenes.delete(source.scene);

				if (source?.scene && !sceneSubscriptions.current.has(source.scene)) {
					sceneSubscriptions.current.set(source.scene, source.scene.onRecalculated.subscribe(() => {
						cacheClipData();
					}));
				}

				hangingScenes.forEach(scene => {
					sceneSubscriptions.current.get(scene)?.();
					sceneSubscriptions.current.delete(scene);
				});

				endTime = Math.max(endTime, clip.offset + clip.length);
			}
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
		const MISSING_CLIP_SCENE = scenes.find(s => s.name === 'MissingClipScene');
		const EMPTY_TIMELINE_SCENE = scenes.find(s => s.name === 'EmptyTimelineScene');
		const VIDEO_CLIP_SCENE = scenes.find(s => s.name === 'VideoClipScene');
		const IMAGE_CLIP_SCENE = scenes.find(s => s.name === 'ImageClipScene');

		ensure(MISSING_CLIP_SCENE && EMPTY_TIMELINE_SCENE && VIDEO_CLIP_SCENE && IMAGE_CLIP_SCENE,
			'Internal MotionComposer scenes not found. Some other plugin is messing with the scene list!');

		const EMPTY_TIMELINE_CLIP: Clip = {
			type: 'scene',
			path: 'EmptyTimelineScene',
			length: 1,
			offset: 0,
			start: 0,
			volume: 0,
			uuid: -1,
			cache: {} as any
		};
		const EMPTY_TIMELINE_SOURCE: ClipSource = {
			type: 'scene',
			path: 'EmptyTimelineScene',
			name: 'Empty Timeline Scene',
			duration: 1,
			scene: EMPTY_TIMELINE_SCENE,
		};

		clip.value = clipsStore()?.[0]?.[0] ?? null;

		/** Helper function to get the best clip for a current frame, and update the current clip & cached clip data. */

		function getBestClip(frame: number): Clip {
			const clips = clipsStore()?.[0] ?? [];

			let prev: Clip | null = null;
			let next: Clip | null = null;
			let found: Clip | null = null;

			for (let candidate of clips) {
				ensure(candidate.cache, 'Uncached clip found!');
				if (candidate.cache.clipRange[1] < frame) prev = candidate;
				if (frame >= candidate.cache.clipRange[0] && frame < candidate.cache.clipRange[1]) {
					found = candidate;
					break;
				}
				else if (frame < candidate.cache.clipRange[0]) {
					next = candidate;
					break;
				}
			}

			if (found) {
				if (found.cache.source?.type === 'video') {
					setVideo(`/media/${found.cache.source.name!}`, found.cache.source.duration, found.length + found.start);
					found.cache.source.scene = VIDEO_CLIP_SCENE;
				}
				else if (found.cache.source?.type === 'image') {
					setImage(`/media/${found.cache.source.name!}`, found.length + found.start);
					found.cache.source.scene = IMAGE_CLIP_SCENE;
					// found.cache.source.duration = Infinity;
					// found.cache.sourceFrames = Infinity;
				}

				clip.value = found;
				return clip.value;
			}
			else {
				clip.value = EMPTY_TIMELINE_CLIP;
				const clipRange: [ number, number ] = [
					prev ? prev.cache.clipRange[1] : 0,
					next ? next.cache.clipRange[0] : (player as any).endFrame ];
				clip.value.cache = {
					clipRange,
					lengthFrames: clipRange[1] - clipRange[0],
					startFrames: 0,
					sourceFrames: clipRange[1] - clipRange[0],
					source: EMPTY_TIMELINE_SOURCE
				}
				return clip.value
			}
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
			return clip.value.cache.source?.scene ?? MISSING_CLIP_SCENE;
		}).bind(player.playback);


		/** Override PlaybackManager.findBestScene() method to find the best scene from the clips array.  */

		(player.playback as any).findBestScene = (function(frame: number) {
			getBestClip(frame);
			return clip.value.cache?.source?.scene ?? MISSING_CLIP_SCENE;
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
			if (this.currentScene !== EMPTY_TIMELINE_SCENE &&
				this.currentScene !== MISSING_CLIP_SCENE) await this.currentScene.next();

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
		if (clips().length > 0) cacheClipData();
	}, [ sources ]);

	// Recompute clips when the duration changes, i.e. when the scenes load.

	useEffect(() => {
		let cancel: () => void;
		cancel = player.onDurationChanged.subscribe((duration) => {
			if (duration <= 0) return;
			cancel();
			clips(settings.get('clips') ?? []);
		});
		return cancel;
	}, []);

	// Display viewport shortcuts.

	const viewport = document.querySelector('[class^="_viewport_"]');
	useEffect(() => {
		const toRemove: (() => void)[] = [];
		if (!viewport) return;
		toRemove.push(addEventListener(viewport, 'mouseenter', () => shortcutModule[1]('viewport')));
		toRemove.push(addEventListener(viewport, 'mouseleave', () => shortcutModule[1]('global')));
		return () => toRemove.forEach(fn => fn());
	}, [ viewport ]);

	// All the context values (so many).

	const uiContextData = useMemo(() => ({
		mediaTabOpen: mediaTabVisible,
		updateMediaTabOpen: setMediaTabVisible,
		addSource,
		addSourceDragPos
	}), [ mediaTabVisible ]);

	const clipsContextData = useMemo(() => ({ clips }), [ clips() ]);

	const currentClipContextData = useMemo(() => ({ clip }), []);

	const shortcutsContextData = useMemo(() => ({
		currentModule: shortcutModule[0], setCurrentModule: shortcutModule[1] }), [ shortcutModule ]);

	return (
		<UIContext.Provider value={uiContextData}>
			<ClipsContext.Provider value={clipsContextData}>
				<CurrentClipContext.Provider value={currentClipContextData}>
					<ShortcutsContext.Provider value={shortcutsContextData}>
						{children}
					</ShortcutsContext.Provider>
				</CurrentClipContext.Provider>
			</ClipsContext.Provider>
		</UIContext.Provider>
	);
}
