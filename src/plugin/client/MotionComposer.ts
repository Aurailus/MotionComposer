import { Video } from '@motion-canvas/2d';
import { Player, Project, ProjectMetadata, Scene, ValueDispatcher } from '@motion-canvas/core';

import { ensure } from './Util';
import { getUUIDNext, setUUIDNext } from './Hooks';
import AudioProxy from './audio/AudioProxy';
import { setVideo } from './scenes/VideoClipScene';
import { setImage } from './scenes/ImageClipScene';
import AudioController from './audio/AudioController';
import { getSources, onSourcesChanged, updateSceneSources } from './Sources';
import { Clip, ClipInfo, ClipSource, PluginSettings, Track } from './Types';

import VideoClipScene from './scenes/VideoClipScene?scene';
import ImageClipScene from './scenes/ImageClipScene?scene';
import MissingClipScene from './scenes/MissingClipScene?scene';
import EmptyTimelineScene from './scenes/EmptyTimelineScene?scene';

const INTERNAL_CLIP_NAMES = [ 'EmptyTimeline', 'MissingClip', 'VideoClip', 'ImageClip' ] as const;
type InternalClipName = typeof INTERNAL_CLIP_NAMES[number];

type SettingsWrapper = {
	get<T extends keyof PluginSettings>(field: T, def?: PluginSettings[T]): PluginSettings[T];
	set<T extends keyof PluginSettings>(field: T, value: PluginSettings[T]): void;
}

export class MotionComposer {

	// Public properties.

	public readonly audio = new AudioController();

	// Internals.

	private player: Player = null;
	private settings: SettingsWrapper = null;
	private internalClips: Record<InternalClipName, Clip> = null;
	private sceneSubscriptions = new Map<Scene, (() => void)>();

	// Synchronized state accessed through getters, subscribers, and setters.

	private readonly tracks = new ValueDispatcher<Track[]>([]);
	private readonly targetTrack = new ValueDispatcher<number | null>(1);
	private readonly clips = new ValueDispatcher<Clip[][]>([]);
	private readonly currentClip = new ValueDispatcher<Clip | null>(null);

	public get onTracksChanged() { return this.tracks.subscribable; }
	public get onTargetTrackChanged() { return this.targetTrack.subscribable; }
	public get onClipsChanged() { return this.clips.subscribable; }
	public get onCurrentClipChanged() { return this.currentClip.subscribable; }

	getTracks() { return this.tracks.current; }
	getTargetTrack() { return this.targetTrack.current; }
	getClips() { return this.clips.current; }
	getCurrentClip() { return this.currentClip.current; }

	constructor() {
		// Recompute everything when the sources change.
		onSourcesChanged.subscribe(() => {
			if (this.clips.current.length <= 0) return;
			this.targetTrack.current = this.settings.get('targetTrack') ?? 1;
			this.tracks.current = this.settings.get('tracks') ?? [];
			this.updateClipCaches(true);
		});
	}

	/**
	 * Sets the project's clips, and updates the internal state, cache, and audio.
	 *
	 * @param clips - The clips to set.
	 */

	setClips(clips: readonly Clip[][]): void {
		console.warn('SETTING CLIPS');

		// Set the value without triggering a change event, since `updateClipCaches` will.
		(this.clips as any).value = clips;
		this.updateClipCaches(true);

		// Update the persistent settings data.
		this.settings.set('clips', [ ...clips ].map(channel =>
			[ ...channel.map(clip => ({ ...clip, cache: undefined })) ]));
		this.settings.set('uuidNext', getUUIDNext());

		// Update the audio's copy of the clips.
		this.audio.setClips(clips.flat(1));
	}

	/**
	 * Sets the project's tracks, and updates the internal state and cache.
	 *
	 * @param tracks - The tracks to set.
	 */

	setTracks(tracks: Track[]): void {
		console.warn('SETTING TRACKS');

		this.tracks.current = tracks;
		this.settings.set('tracks', tracks);
		this.audio.setTracks(tracks);
	}

	/**
	 * Sets the target track, i.e. the track that new clips will be added to.
	 * This is only for Audio, as there can be only one video track.
	 *
	 * @param targetTrack - The target track index.
	 */

	setTargetTrack(targetTrack: number): void {
		console.warn('SETTING TARGET TRACK');
		this.targetTrack.current = targetTrack;
		this.settings.set('targetTrack', targetTrack);
	}

	/**
	 * Patch and modify the Motion Canvas project before Motion Canvas starts.
	 *
	 * @param project - The project.
	 * @returns the modified project.
	 */

	patchProject(project: Project) {
		// Add internal scenes.
		project.scenes.push(EmptyTimelineScene);
		project.scenes.push(MissingClipScene);
		project.scenes.push(VideoClipScene);
		project.scenes.push(ImageClipScene);

		// Wipe audio property from the project.
		if (project.audio) console.warn('Project.audio is not supported. Please add your audio to the timeline.')
		project.audio = null;

		// Patch the video pool.
		this.patchVideo();
		// Create the settings wrapper.
		this.settings = this.createSettingsWrapper(project.meta);

		// Return the modified project.
		return project;
	}

	/**
	 * Patches the existing video element to work properly with Motion Composer.
	 */

	private patchVideo() {
		// Make all videos muted.
		const pool = (Video as any).pool as Record<string, HTMLVideoElement>;

		(Video as any).pool = new Proxy(pool, {
			get(target, prop, receiver) {
				if (prop === '__raw__') return pool;
				return Reflect.get(target, prop, receiver);
			},
			set(target, prop, value, receiver) {
				Reflect.set(target, prop, value, receiver);
				value.muted = true;
				return true;
			}
		});

		// Set the video playback rate to match the player speed.
		const composer = this;
		const oldSeekedVideo = (Video.prototype as any).seekedVideo;
		const oldFastSeekedVideo = (Video.prototype as any).fastSeekedVideo;

		(Video.prototype as any).seekedVideo = (function() {
			const video = oldSeekedVideo.call(this);
			video.playbackRate *= composer.player.status.speed;
			return video;
		});
		(Video.prototype as any).fastSeekedVideo = (function() {
			const video = oldFastSeekedVideo.call(this);
			video.playbackRate *= composer.player.status.speed;
			return video;
		});
	}

	/**
	 * Creates the settings wrapper object, which allows Motion Composer to modify
	 * persistent properties in project.meta's `motion-composer` field.
	 *
	 * @param meta - The project meta object.
	 * @returns the settings wrapper object.
	 */

	private createSettingsWrapper(meta: ProjectMetadata) {
		return {
			get<T extends keyof PluginSettings>(field: T, def?: PluginSettings[T]): PluginSettings[T] {
				return (meta.get() as any)['motion-composer']?.[field] ?? def;
			},
			set<T extends keyof PluginSettings>(field: T, value: PluginSettings[T]) {
				meta.set({ 'motion-composer': { ...(meta.get() as any)['motion-composer'] ?? {}, [field]: value } } as any);
			}
		}
	};

	/**
	 * Patches the Motion Canvas player and playback manager to work with Motion Composer clips. This stuff modifies
	 * a lot of internal behaviour, and is prone to breaking with Motion Canvas updates. I've done my best to silo
	 * all breakable functionality in this function, so if something stops working, you know where to look.
	 *
	 * @param player - The player object.
	 */

	patchPlayer(player: Player) {
		// Store the player object.
		this.player = player;

		// Update scene sources when they change.
		player.playback.onScenesRecalculated.subscribe(scenes => updateSceneSources(scenes), true);

		function makeInternalClip(name: InternalClipName): Clip {
			const sceneName = `${name}Scene`;
			const scene = (player.playback as any).scenes.value.find((s: Scene) => s.name === sceneName);
			ensure(scene, `Internal MotionComposer scene not found: ${sceneName}`)
			const source: ClipSource = { type: 'scene', path: sceneName, name: sceneName, duration: 1, scene };
			const cache: ClipInfo = { source } as any;
			const clip: Clip = { type: 'scene', path: sceneName, length: 1, offset: 0, start: 0, volume: 0, uuid: -1, cache };
			return clip;
		}

		// Populate the internal clips object with the internal clips.
		this.internalClips = Object.fromEntries(INTERNAL_CLIP_NAMES.map((name) => [ name, makeInternalClip(name) ])) as any;

		// Store a reference to this object, since we're binding our overridden methods to the class we're overriding.
		const composer = this;

		/** Helper method used by overridden PlaybackManager.seek() and PlaybackManager.next() to advance scene frames. */
		async function advanceSceneWithoutSeek(scene: Scene, frames: number) {
			for (let i = 0; i < frames / player.status.speed; i++) {
				await scene.next();
				ensure(!scene.isFinished(), 'Tried to advance past the end of a scene.');
			}
		}

		/** Override PlaybackManager.getNextScene() method to find the clip's next scene. */
		(player.playback as any).getNextScene = (function() {
			const clip = composer.updateCurrentClip(composer.currentClip.current?.cache.clipRange[1] ?? 0);
			return clip ? clip.cache.source.scene : null;
		}).bind(player.playback);

		/** Override PlaybackManager.findBestScene() method to use this.updateCurrent().  */
		(player.playback as any).findBestScene = (function(frame: number) {
			const clip = composer.updateCurrentClip(frame);
			return clip.cache.source.scene;
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
			if (this.currentScene.isFinished()) return true;

			// Compute the next frame in the scene.
			if (this.currentScene !== composer.internalClips.EmptyTimeline.cache.source.scene &&
				this.currentScene !== composer.internalClips.MissingClip.cache.source.scene) await this.currentScene.next();

			// If the current scene is done transitioning, clear the previous scene.
			if (this.previousScene && this.currentScene.isAfterTransitionIn()) this.previousScene = null;

			// If the current scene is over, or the current clip is over, locate the next scene and move to it.
			if (this.currentScene.canTransitionOut() || this.frame >= composer.currentClip.current.cache.clipRange[1]) {
				this.previousScene = this.currentScene;
				const nextScene = this.getNextScene(this.previousScene);
				if (nextScene) {
					this.currentScene = nextScene;
					await this.currentScene.reset(this.previousScene);
					await advanceSceneWithoutSeek(this.currentScene, composer.currentClip.current.cache.startFrames);
				}
				if (!nextScene || this.currentScene.isAfterTransitionIn()) this.previousScene = null;
			}

			return this.currentScene.isFinished();
		}).bind(player.playback);

		/** Override PlaybackManager.seek() method to swap to the correct clip and shift its start frame. */
		(player.playback as any).seek = (async function (frame: number) {
			// Frame is too high, we need to skip back to the start of the clip.
			if (this.frame > frame) {
				// Update the current scene if we need to.
				const scene = this.findBestScene(frame);
				if (scene !== this.currentScene) {
					this.previousScene = null;
					this.currentScene = scene;
				}

				// If the scene is not the EmptyTimeline or MissingClip scene,
				// we need to reset the scene and then advance it to the beginning of the clip.
				if (scene !== composer.internalClips.EmptyTimeline.cache.source.scene &&
					scene !== composer.internalClips.MissingClip.cache.source.scene) {
					// Update the frame to the start of the clip.
					this.frame = composer.currentClip.current.cache.clipRange[0] ?? 0;
					// Reset the current scene.
					await this.currentScene.reset();
					// Advance the scene to the start frame of the clip.
					await advanceSceneWithoutSeek(this.currentScene, composer.currentClip.current.cache.startFrames);
				}
				// Otherwise, we just need to reset the scene and update the frame.
				else {
					await this.currentScene.reset();
					this.frame = frame;
				}
			}

			// While the frame is too low, we need to advance the playback state.
			// PlaybackManager.next() will handle swapping the scene if necessary.
			while (this.frame < frame && !this.finished) {
				const finished = await this.next();
				if (finished) break;
			}
		}).bind(player.playback);

		/** Compute the final frame count properly based on the clips. */
		const oldPlaybackRecalculate = player.playback.recalculate.bind(player.playback);
		(player.playback as any).recalculate = (async function() {
			await oldPlaybackRecalculate();
			const duration = (composer.clips.current[0] ?? []).reduce((lastMax, clip) =>
				Math.max(lastMax, clip.cache.clipRange[1]), 0);
			if (duration === 0) return;
			this.frame = duration;
			this.duration = duration;
		}).bind(player.playback);


		// Override the audio properties to use an AudioProxy object.
		(player.audio as any).setSource = () => { /* no-op */ }
		(player.audio as any).source = 'SOURCE_EXISTS';
		(player.audio as any).audioElement = new AudioProxy(this.audio);

		// Recalculate the player's duration and stuff when the clips change.
		this.onClipsChanged.subscribe(() => (player as any).requestRecalculation());

		// Load the initial state from the settings.
		this.tracks.current = this.settings.get('tracks') ?? [];
		this.audio.setTracks(this.tracks.current);
		this.targetTrack.current = this.settings.get('targetTrack') ?? 1;
		setUUIDNext(this.settings.get('uuidNext') ?? 0);
		this.setClips(this.settings.get('clips') ?? []);

		// Update the current clip to the one that will be seeked to.
		// This is necessary for the scene previews to render correctly on initial load.
		this.updateCurrentClip((this.player as any).requestedSeek ?? 0);

		// Force update the player's speed, as although it's loaded by Motion Canvas,
		// it doesn't actually update the playback properly.
		const desiredSpeed = (player as any).playerState.current.speed ?? 1;
		(player as any).playerState.current.speed = 1;
		player.setSpeed(desiredSpeed);
	}

	/**
	 * Updates all clip caches, and updates scene subscriptions. Called by `setClips`, and when a scene changes.
	 * Also manages subscribing and unsubscribing to scene events as needed to re-call this function.
	 */

	private updateClipCaches(dispatchEvent: boolean) {
		console.warn('REFRESHING CLIPS CACHE');

		const hangingScenes = new Set<Scene>([ ...this.sceneSubscriptions.keys() ]);
		const sources = getSources();

		this.clips.current.forEach((layer, channel) => {
			let lastEndFrames = -1;

			for (let clip of layer) {
				let source = sources.find(s => s.name === clip.path && s.type === clip.type);

				const sourceFrames = source
					? this.player.status.secondsToFrames(source.duration)
					: undefined;
				const offsetFrames = this.player.status.secondsToFrames(clip.offset);
				const startFrames = this.player.status.secondsToFrames(clip.start);
				const lengthFrames = this.player.status.secondsToFrames(clip.length);

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
					source,
					channel
				};

				if (source?.scene && hangingScenes.has(source.scene)) hangingScenes.delete(source.scene);

				if (source?.scene && !this.sceneSubscriptions.has(source.scene))
					this.sceneSubscriptions.set(source.scene,
						source.scene.onRecalculated.subscribe(() => this.updateClipCaches(true)));

				hangingScenes.forEach(scene => {
					this.sceneSubscriptions.get(scene)?.();
					this.sceneSubscriptions.delete(scene);
				});
			}
		});

		if (dispatchEvent) this.clips.current = [ ...this.clips.current ];

		const numAudioTracks = Math.max(this.clips.current.length - 1, 1);
		while (this.tracks.current.length - 1 < numAudioTracks)
			this.tracks.current.push({ solo: false, muted: false, locked: false });
		if (this.tracks.current.length - 1 > numAudioTracks) (this.tracks as any).value =
			this.tracks.current.slice(0, numAudioTracks + 1);
		if (dispatchEvent) this.tracks.current = [ ...this.tracks.current ];
		if (this.targetTrack.current >= numAudioTracks + 1 || this.targetTrack.current < 1) this.targetTrack.current = 1;
	}

	/**
	 * Sets the current clip to the clip that should be rendered at the specified frame.
	 * Called by the player's method overrides when the frame changes.
	 *
	 * @param frame - The frame to find the clip for.
	 */

	private updateCurrentClip(frame: number): Clip {
		let prev: Clip | null = null;
		let next: Clip | null = null;
		let found: Clip | null = null;

		// We want to find the previous, current, and next clips for the current frame.
		// The previous and next are used when creating the empty timeline scene, as it should know
		// how long it should exist for.
		for (let candidate of this.clips.current[0] ?? []) {
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

		// If we found a clip, we need to make sure that it has a scene property,
		// or add one, or set it to the MissingClip scene if the source doesn't exist.
		// And then we return it.
		if (found) {
			// If the clip is missing, we want to return a MissingClip clip instead.
			if (!found.cache.source) {
				const clip = this.internalClips.MissingClip;
				clip.cache = {
					clipRange: found.cache.clipRange,
					lengthFrames: found.cache.lengthFrames,
					startFrames: 0,
					sourceFrames: found.cache.sourceFrames,
					source: clip.cache.source,
					channel: 0
				};
				this.currentClip.current = clip;
				return clip;
			}

			// If the clip is a video type, we want to return the video clip scene,
			// and we want to set the clip scene to the video clip scene.
			if (found.cache.source?.type === 'video') {
				setVideo(`/media/${found.cache.source.name!}`, found.cache.source.duration, found.length + found.start);
				found.cache.source.scene = this.internalClips.VideoClip.cache.source.scene;
			}
			else if (found.cache.source?.type === 'image') {
				setImage(`/media/${found.cache.source.name!}`, found.length + found.start);
				found.cache.source.scene = this.internalClips.ImageClip.cache.source.scene;
			}

			// Set the current clip to the found clip, and return it
			this.currentClip.current = found;
			return found;
		}
		// If we couldn't find a clip, we want to return the EmptyTimeline clip.
		// The EmptyTimelineClip should last for the total duration between the previous and next clips.
		else {
			const clip = this.internalClips.EmptyTimeline;
			const clipRange: [ number, number ] = [
				prev ? prev.cache.clipRange[1] : 0,
				next ? next.cache.clipRange[0] : (this.player as any).endFrame ];
			clip.cache = {
				clipRange,
				lengthFrames: clipRange[1] - clipRange[0],
				startFrames: 0,
				sourceFrames: clipRange[1] - clipRange[0],
				source: clip.cache.source,
				channel: 0
			}
			this.currentClip.current = clip;
			return clip;
		}
	}
}

const Instance = new MotionComposer();
export default Instance;
