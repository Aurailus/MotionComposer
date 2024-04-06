import { EditorPlugin, makeEditorPlugin } from '@motion-canvas/ui';
import { OverlayConfig } from './overlay/OverlayConfig';
import { MediaTabConfig } from './media/MediaTabConfig';
import StateManager from './StateManager';
import EmptyTimelineScene from './scenes/EmptyTimelineScene?scene';
import MissingClipScene from './scenes/MissingClipScene?scene';
import VideoClipScene from './scenes/VideoClipScene?scene';
import ImageClipScene from './scenes/ImageClipScene?scene';
import { Video } from '@motion-canvas/2d';
import { Project } from '@motion-canvas/core';

export default class MotionComposer {
	constructor() {

	}

	makePlugin(): EditorPlugin {
		return makeEditorPlugin({
			name: 'motion-composer',
			previewOverlay: OverlayConfig,
			tabs: [MediaTabConfig],
			provider: StateManager,
			project: this.patchProject.bind(this),
			player: this.patchPlayer.bind(this)
		});
	}

	/**
	 * Patch and modify the Motion Canvas project before Motion Canvas starts.
	 * @param project - The project.
	 * @returns the modified project.
	 */

	private patchProject(project: Project) {
		// Add internal scenes.
		project.scenes.push(EmptyTimelineScene);
		project.scenes.push(MissingClipScene);
		project.scenes.push(VideoClipScene);
		project.scenes.push(ImageClipScene);

		// Wipe audio property from the project.
		if (project.audio) console.warn('Project.audio is not supported. Please add your audio to the timeline.')
		project.audio = null;

		// Patch the video pool.
		this.patchVideoPool();

		// Return the modified project.
		return project;
	}

	/**
	 * Patch `Video.pool`, the internal cache where all scene Videos are stored,
	 * to mute all videos on creation, to prevent audio from playing.
	 */

	private patchVideoPool() {
		const pool = (Video as any).pool as Record<string, HTMLVideoElement>;

		(Video as any).pool = new Proxy(pool, {
			get(target, prop, receiver) {
				return Reflect.get(target, prop, receiver);
			},
			set(target, prop, value, receiver) {
				Reflect.set(target, prop, value, receiver);
				value.muted = true;
				return true;
			}
		});
	}

	/**
	 * Patch the Motion Canvas player and playback manager to work with Motion Composer clips. This stuff modifies
	 * a lot of internal behaviour, and is prone to breaking with Motion Canvas updates. I've done my best to silo
	 * all breakable functionality in this function, so if something stops working, you know where to look.
	 */

	private patchPlayer() {

	}
}
