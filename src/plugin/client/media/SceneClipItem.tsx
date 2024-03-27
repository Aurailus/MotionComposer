/* @jsxImportSource preact */

import { Scene } from '@motion-canvas/core';
import { useApplication } from '@motion-canvas/ui';
import { useRef, useLayoutEffect } from 'preact/hooks';

import styles from './Media.module.scss';

import * as Icon from '../icon';
import { useCurrentClip } from '../Contexts';
import ClipItem, { ClipItemChildProps } from './ClipItem';

const PREVIEW_WIDTH = 240;
const RESOLUTION_MULT = 2;
const PREVIEW_FRAME_OFFSET = 30;

export default function SceneClipItem(props: ClipItemChildProps) {
	const { player } = useApplication();
	const imgRef = useRef<HTMLImageElement>(null);
	const clip = useCurrentClip();

	useLayoutEffect(() => {
		async function genThumbnail() {
	// 		console.log(clip.value.cache, player.playback.frame);
	// 		const moveBackFrames = (clip.value && clip.value.cache.scene === scene)
	// 			? player.playback.frame - clip.value.cache.clipRange[0]
	// 			: 0;

	// 		scene.reset();
	// 		const size = scene.getSize();

	// 		const framesInScene = scene.lastFrame - scene.firstFrame;
	// 		const maxFrameOffset = Math.floor(framesInScene / 2);
	// 		for (let i = 0; i < Math.min(PREVIEW_FRAME_OFFSET, maxFrameOffset); i++) await scene.next();

	// 		src.width = size.x;
	// 		src.height = size.y;
	// 		dst.width = PREVIEW_WIDTH * RESOLUTION_MULT;
	// 		dst.height = PREVIEW_WIDTH * (size.y / size.x) * RESOLUTION_MULT;

	// 		(scene as any).draw(srcCtx);
	// 		dstCtx.drawImage(src, 0, 0, dst.width, dst.height);
	// 		imgRef.current!.src = dst.toDataURL();

	// 		scene.reset();
	// 		if (moveBackFrames) {
	// 			console.log(moveBackFrames, framesInScene);
	// 			for (let i = 0; i < moveBackFrames; i++) await scene.next();
	// 		}
		}

	// 	return scene.onCacheChanged.subscribe(genThumbnail);
	}, [ imgRef.current, props.source.scene ]);

	return (
		<ClipItem
			{...props}
			class={styles.scene}
			name={props.source.name}
			duration={props.source.duration}
			icon={Icon.Scene}
			thumbnail={<img ref={imgRef} class={styles.thumbnail}/>}
		/>
	);
}
