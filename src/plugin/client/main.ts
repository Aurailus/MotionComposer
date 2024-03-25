import { makeEditorPlugin } from '@motion-canvas/ui';

import { MediaTabConfig } from './media/MediaTabConfig';
import { OverlayConfig } from './OverlayConfig';
import StateManager from './StateManager';

// const videos = import.meta.glob('/clips/*.mkv');

// console.log(videos);

import MissingClipScene from './MissingClipScene?scene';
import EmptyTimelineScene from './EmptyTimelineScene?scene';

export default makeEditorPlugin({
	name: 'motion-composer',
	previewOverlay: OverlayConfig,
	tabs: [ MediaTabConfig ],
	provider: StateManager,
	project(project) {
		project.scenes.push(EmptyTimelineScene);
		project.scenes.push(MissingClipScene);
		return project;
	}
})
