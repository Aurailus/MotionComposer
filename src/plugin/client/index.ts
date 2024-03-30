import { makeEditorPlugin } from "@motion-canvas/ui";

import { MediaTabConfig } from "./media/MediaTabConfig";
import { OverlayConfig } from "./overlay/OverlayConfig";
import StateManager from "./StateManager";

import ImageClipScene from "./scenes/ImageClipScene?scene";
import VideoClipScene from "./scenes/VideoClipScene?scene";
import MissingClipScene from "./scenes/MissingClipScene?scene";
import EmptyTimelineScene from "./scenes/EmptyTimelineScene?scene";
import { Video } from "@motion-canvas/2d";

function patchVideoPool() {
	const pool = (Video as any).pool as Record<string, HTMLVideoElement>;

	const proxy = new Proxy(pool, {
		get(target, prop, receiver) {
			return Reflect.get(target, prop, receiver);
		},
		set(target, prop, value, receiver) {
			Reflect.set(target, prop, value, receiver);
			value.muted = true;
			return true;
		}
	});

	(Video as any).pool = proxy;
}

export default makeEditorPlugin({
  name: "motion-composer",
  previewOverlay: OverlayConfig,
  tabs: [MediaTabConfig],
  provider: StateManager,
  project(project) {
    project.scenes.push(EmptyTimelineScene);
    project.scenes.push(MissingClipScene);
    project.scenes.push(VideoClipScene);
    project.scenes.push(ImageClipScene);

    console.log((Video as any).pool);
		patchVideoPool();

    return project;
  },
});

export { useClips, useCurrentClip } from "./Contexts";
export { useStore, useLazyRef, useUUID, getUUID } from "./Hooks";
export type { Clip, ClipInfo, ClipSource, ClipType } from "./Types";
