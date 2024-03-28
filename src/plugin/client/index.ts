import { makeEditorPlugin } from '@motion-canvas/ui';

import { MediaTabConfig } from './media/MediaTabConfig';
import { OverlayConfig } from './overlay/OverlayConfig';
import StateManager from './StateManager';

import VideoClipScene from './scenes/VideoClipScene?scene';
import MissingClipScene from './scenes/MissingClipScene?scene';
import EmptyTimelineScene from './scenes/EmptyTimelineScene?scene';

export default makeEditorPlugin({
	name: 'motion-composer',
	previewOverlay: OverlayConfig,
	tabs: [ MediaTabConfig ],
	provider: StateManager,
	project(project) {
		project.scenes.push(EmptyTimelineScene);
		project.scenes.push(MissingClipScene);
		project.scenes.push(VideoClipScene);
		return project;
	}
})

export { useClips, useCurrentClip } from './Contexts';
export { useStore, useLazyRef, useUUID, getUUID } from './Hooks';
export type { Clip, ClipInfo, ClipSource, ClipType } from './Types';
