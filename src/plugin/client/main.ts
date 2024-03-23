import { makeEditorPlugin } from '@motion-canvas/ui';

import { MediaTabConfig } from './media/MediaTabConfig';
import { TrackBarOverlayConfig } from './timeline/TimelineOverlayConfig';
import StateManager from './StateManager';
import { MetaField, MetaFile, ProjectMetadata } from '@motion-canvas/core';

// const videos = import.meta.glob('/clips/*.mkv');

// console.log(videos);

import MissingClipScene from './MissingClipScene?scene';
import EmptyTimelineScene from './EmptyTimelineScene?scene';

export default makeEditorPlugin({
	name: 'motion-composer',
	previewOverlay: TrackBarOverlayConfig,
	tabs: [ MediaTabConfig ],
	provider: StateManager,
	project(project) {
		project.scenes.push(EmptyTimelineScene);
		project.scenes.push(MissingClipScene);
		return project;
	}
})
