/* @jsxImportSource preact */

import { PluginContext, PluginContextData } from './Context';
import { PlaybackState, ProjectMetadata, Scene, Vector2 } from '@motion-canvas/core';
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

	const playbackPosStore = useStore(0);
	const rawPlayheadPos = useStore(0);

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


				console.log({ clip, sceneRange, rawClipRange, clipRange })

				ensure(sceneRange[0] >= 0 && sceneRange[1] - sceneRange[0] > 0, 'Scenes frame range invalid.');
				ensure(startFrames >= 0 && startFrames < sceneRange[1], 'Clip range start out of bounds.');
				ensure(lengthFrames > 0 && startFrames + lengthFrames < sceneRange[1], 'Clips range length out of bounds.')
				ensure(rawClipRange[0] > sceneRange[0] && rawClipRange[1] < sceneRange[1], 'Raw clip range out of bounds.');
				ensure(clipRange[0] >= 0 && clipRange[1] > clipRange[0], 'Clip range invalid.')

				console.log(clip);

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

		console.log(newCache);

		clipsCache(newCache);
	}, []);

	const clips = useSignalish(() => clipsStore(), useCallback((clips: SerializedClip[][]) => {
		console.warn('SETTING CLIPS');
		clipsStore(clips);
		refreshClipsCache();
		settings.set('clips', clips);
		return clips;
	}, []));

	const getRawPos = useCallback((pos: number) => {
		const clips = clipsStore()?.[0] ?? [];
		const cache = clipsCache();
		let posOffset = pos;

		for (let clip of clips) {
			let cached = cache.get(clip);
			if (cached.clipRange[0] <= pos && cached.clipRange[1] >= pos) {
				return cached.rawClipRange[0] + (pos - cached.clipRange[0]);
			}
		}
		console.warn('Couldn\'t find clip!');
		return 0;
	}, []);

	const playheadPos = useSignalish(() => playbackPosStore(), useCallback((pos: number) => {
		playbackPosStore(pos);
		rawPlayheadPos(getRawPos(pos));
		player.requestSeek(rawPlayheadPos());
		return pos;
	}, []));

	const scene = useCurrentScene();
	scene.

	useLayoutEffect(() => {
		// Hijack the player's frame changing behaviour.

		const playerAsAny = player as any;
		const oldReqPrevFrame = playerAsAny.requestPreviousFrame.bind(player);
		playerAsAny.requestPreviousFrame = () => {
			console.log('req previous');
			oldReqPrevFrame();
		};

		const unsub = player.onFrameChanged.subscribe((frame) => {

			// If the raw playhead is already at the right frame, this movement was triggered by our code,
			// and nothing else needs to be done.

			if (rawPlayheadPos() === frame) {
				console.warn('Playhead moved properly.');
				return;
			}

			// If the delta between the last frame and this frame is greater than one, we aren't pressing left / right,
			// and it's not running our functions (or they're not working.) Throw an error and a stack trace, and attempt
			// to reset to the playhead pos.

			const diff = frame - rawPlayheadPos();

			console.log(diff);

			if (Math.abs(diff) > 1) {
				console.error(`Improperly jumped by ${diff} frames! This is probably some editor behaviour that hasn\'t been accounted for yet!`);
				// playheadPos(0);
				// rawPlayheadPos(0);
			}

			// Otherwise, we need to check if the playhead has moved into the last or first frame of a clip,
			// and move it to the previous or next clip, as appropriate.

			const cache = clipsCache();
			const currentClip = (clips()?.[0] ?? []).find(clip => {
				const cached = cache.get(clip);
				if (!cached) return false;
				return cached.rawClipRange[0] <= frame + 1 && cached.rawClipRange[1] >= frame;
			});
			const cached = cache.get(currentClip);

			const movedToLastFrame = cached?.rawClipRange[1] === frame;
			const movedToFirstFrame = cached?.rawClipRange[0] === frame + 1;

			playbackPosStore(pos => pos + diff);

			if (movedToLastFrame) {
				const nextClip = (clips()?.[0] ?? []).find(clip => {
					const cached = cache.get(clip);
					if (!cached) return false;
					return cached.clipRange[0] <= playheadPos() && cached.clipRange[1] >= playheadPos();
				});

				if (nextClip) {
					const cached = cache.get(nextClip);
					rawPlayheadPos(cached.rawClipRange[0]);
					player.requestSeek(rawPlayheadPos());
				}
				else {
					console.warn('missing next clip!');
				}
			}
			else if (movedToFirstFrame) {
				const prevClip = (clips()?.[0] ?? []).find(clip => {
					const cached = cache.get(clip);
					if (!cached) return false;
					return cached.clipRange[0] <= playheadPos() && cached.clipRange[1] >= playheadPos();
				});

				if (prevClip) {
					const cached = cache.get(prevClip);
					rawPlayheadPos(cached.rawClipRange[1] - 1);
					player.requestSeek(rawPlayheadPos());
				}
				else {
					console.warn('missing next clip!');
				}
			}
			else {
				rawPlayheadPos(getRawPos(playheadPos()));
			}


			console.log(frame, playheadPos(), diff, currentClip, cached);
		});

		return unsub;
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

	const getClipRawFrameRange = useCallback((clip: SerializedClip) => {
		return clipsCache().get(clip).rawClipRange;
	}, []);

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
		getClipRawFrameRange,
		getClipScene,
		getSceneFrameLength,
		playheadPos,
		rawPlayheadPos,
		getRawPos
	};

	return (
		<PluginContext.Provider value={ctx}>
			{children}
		</PluginContext.Provider>
	);
}
