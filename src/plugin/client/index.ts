import { makeEditorPlugin } from '@motion-canvas/ui';

import Provider from './Provider';
import MotionComposer from './MotionComposer';
import { MediaTabConfig } from './media/MediaTabConfig';
import { OverlayConfig } from './overlay/OverlayConfig';

export default makeEditorPlugin({
	name: 'motion-composer',
	previewOverlay: OverlayConfig,
	tabs: [ MediaTabConfig ],
	provider: Provider,
	project: MotionComposer.patchProject.bind(MotionComposer),
	player: MotionComposer.patchPlayer.bind(MotionComposer)
});

export { useStore, useLazyRef, useUUID, getUUID, useClips, useCurrentClip, useTracks } from './Hooks';
export type { Clip, ClipInfo, ClipSource, ClipType } from './Types';
