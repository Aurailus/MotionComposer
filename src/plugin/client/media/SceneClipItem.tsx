/* @jsxImportSource preact */

import { Scene, DependencyContext } from '@motion-canvas/core';
import { useApplication } from '@motion-canvas/ui';
import { useRef, useLayoutEffect } from 'preact/hooks';

import styles from './Media.module.scss';

import * as Icon from '../icon';
import MotionComposer from '../MotionComposer';
import ClipItem, { ClipItemChildProps } from './ClipItem';

const SRC_CANVAS = document.createElement('canvas');
const SRC_CTX = SRC_CANVAS.getContext('2d')!;
const DST_CANVAS = document.createElement('canvas');
const DST_CTX = DST_CANVAS.getContext('2d')!;

const PREVIEW_WIDTH = 240;
const RESOLUTION_MULT = 2;
const PREVIEW_FRAME_OFFSET = 30;
const BLANK_IMG_SRC = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

export default function SceneClipItem(props: ClipItemChildProps) {
	const { player } = useApplication();
	const imgRef = useRef<HTMLImageElement>(null);

	const srcRef = useRef<string>(BLANK_IMG_SRC);

	useLayoutEffect(() => {
		const scene = props.source.scene;
		if (!scene) return;

		async function genThumbnail() {
			// try {
			// 	await new Promise<void>(res => setTimeout(res, 0));
			// 	const currentClip = MotionComposer.getCurrentClip();

			// 	const moveBackFrames = (currentClip?.cache && currentClip.cache.source?.scene === scene)
			// 		? Math.max(player.playback.frame - currentClip.cache.clipRange[0], 0)
			// 		: 0;

			// 	// await DependencyContext.consumePromises();
			// 	await scene.reset();
			// 	// await DependencyContext.consumePromises();
			// 	const size = scene.getSize();

			// 	const framesInScene = scene.lastFrame - scene.firstFrame;
			// 	const maxFrameOffset = Math.floor(framesInScene / 2);
			// 	for (let i = 0; i < Math.min(PREVIEW_FRAME_OFFSET, maxFrameOffset); i++) await scene.next();

			// 	SRC_CANVAS.width = size.x;
			// 	SRC_CANVAS.height = size.y;
			// 	DST_CANVAS.width = PREVIEW_WIDTH * RESOLUTION_MULT;
			// 	DST_CANVAS.height = PREVIEW_WIDTH * (size.y / size.x) * RESOLUTION_MULT;

			// 	// await DependencyContext.consumePromises();
			// 	await scene.render(SRC_CTX);
			// 	// await DependencyContext.consumePromises();
			// 	DST_CTX.drawImage(SRC_CANVAS, 0, 0, DST_CANVAS.width, DST_CANVAS.height);
			// 	srcRef.current = DST_CANVAS.toDataURL();
			// 	imgRef.current!.src = srcRef.current;

			// 	await scene.reset();
			// 	// await DependencyContext.consumePromises();
			// 	for (let i = 0; i < moveBackFrames; i++) await scene.next();
			// 	// await DependencyContext.consumePromises();
			// }
			// catch (e) {
			// 	console.error('error while rendering thumbnail');
			// 	srcRef.current = BLANK_IMG_SRC;
			// 	imgRef.current!.src = srcRef.current;
			// }
		}

		return scene.onCacheChanged.subscribe(genThumbnail);
	}, [ imgRef.current, props.source.scene ]);

	return (
		<ClipItem
			{...props}
			class={styles.scene}
			name={props.source.name}
			duration={props.source.duration}
			icon={Icon.Scene}
			thumbnail={<img ref={imgRef} src={srcRef.current} class={styles.thumbnail}/>}
		/>
	);
}
