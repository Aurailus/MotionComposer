/* @jsxImportSource preact */

import { PluginContext, PluginContextData } from './Context';
import { ProjectMetadata, Scene, Vector2 } from '@motion-canvas/core';
import { useApplication, useScenes, useStorage } from '@motion-canvas/ui';
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

	/**
	 * Refresh cached clip data, including frame ranges and scene subscriptions.
	 * Scene subscriptions are needed to re-call this function when a scene's event timings change,
	 * as this will change the scene's frame ranges.
	 */

	const refreshClipsCache = useCallback(() => {
		console.warn('REFRESHING CLIPS CACHE');

		let accumulatedLength = 0;

		const hangingScenes = new Set<Scene>([ ...sceneSubscriptions.current.keys() ]);

		const newCache = new Map<SerializedClip, CachedClipInfo>(clips().flatMap(arr => arr.map((clip) => {
			let scene = clip.type === 'scene' && scenes.find(s => s.name === clip.path) || undefined;

			let frameLength = 0;
			let rawFrameRange: [ number, number ] | undefined = undefined;

			ensure(clip.range[0] >= 0, 'Clips must have a non-negative start time.');
			ensure(clip.range[1] >= 0, 'Clips must have a non-negative end time.');

			if (clip.type === 'scene') {
				frameLength = clip.range[1] === 0 ? scene.lastFrame - scene.firstFrame :
					scene.playback.secondsToFrames(clip.range[1] - clip.range[0]);

				if (scene) {
					const frameRangeIn = scene.playback.secondsToFrames(clip.range[0]);
					const frameRangeOut = scene.playback.secondsToFrames(clip.range[1]);
					const rawFrameRange = [ scene.firstFrame + frameRangeIn,
						frameRangeOut === 0 ? scene.lastFrame : scene.firstFrame + frameRangeOut ];
					ensure(rawFrameRange[0] >= scene.firstFrame, 'Raw frame range start out of bounds.');
					ensure(rawFrameRange[1] <= scene.firstFrame + scene.lastFrame, 'Raw frame range end out of bounds.');
					ensure(rawFrameRange[0] < rawFrameRange[1], 'Raw frame range flipped.');

					if (hangingScenes.has(scene)) {
						hangingScenes.delete(scene);
					}

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
				}
			}
			else {
				ensure(clip.range[1] !== 0, 'Non-scene clips must have an explicit length.');
				frameLength = player.status.secondsToFrames(clip.range[1] - clip.range[0]);
			}

			ensure(frameLength > 0, 'Clips must have a positive length.');

			const frameRange: [ number, number ] = [ accumulatedLength, accumulatedLength + frameLength ];
			accumulatedLength += frameLength;

			return [
				clip,
				{
					scene,
					frameRange,
					rawFrameRange
				}
			];
		})));

		clipsCache(newCache);
	}, []);

	const clips = useSignalish(() => clipsStore(), useCallback((clips: SerializedClip[][]) => {
		console.warn('SETTING CLIPS');
		clipsStore(clips);
		refreshClipsCache();
		settings.set('clips', clips);
		return clips;
	}, []));

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
		return clipsCache().get(clip).frameRange;
	}, []);

	const getClipRawFrameRange = useCallback((clip: SerializedClip) => {
		return clipsCache().get(clip).rawFrameRange;
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
		getSceneFrameLength
	};

	return (
		<PluginContext.Provider value={ctx}>
			{children}
		</PluginContext.Provider>
	);
}
