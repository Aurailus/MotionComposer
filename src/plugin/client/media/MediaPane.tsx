/* @jsxImportSource preact */

import { useScenes, MotionCanvas, usePlayerState, useApplication, formatDuration} from '@motion-canvas/ui';
import styles from './Media.module.scss';
import { VNode } from 'preact';
import { useRef, useLayoutEffect } from 'preact/hooks';
import { Scene, usePlayback } from '@motion-canvas/core';

function SceneItem({ scene }: { scene: Scene }) {
	const { player } = useApplication();
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useLayoutEffect(() => {
		function genThumbnail() {
			scene.reset();
			const framesToRender = player.playback.frame - scene.firstFrame;
			const ctx = canvasRef.current!.getContext('2d');
			(scene as any).draw(ctx);
			for (let i = 0; i < framesToRender; i++) scene.next();
		}
		return scene.onCacheChanged.subscribe(genThumbnail);
	}, [ canvasRef.current, scene ]);

	return (
		<div class={styles.media_item}>
			<div class={styles.thumbnail}>
				<canvas ref={canvasRef} width={1920} height={1080} class={styles.canvas}/>
			</div>
			<div class={styles.description}>
				<MotionCanvas/>
				<p class={styles.name}>{scene.name}</p>
				<p class={styles.duration}>{formatDuration(player.status.framesToSeconds(scene.lastFrame - scene.firstFrame))}</p>
			</div>
		</div>
	)
}

function VideoItem() {

}

// function ImageItem() {

// }

function AudioItem() {

}

export default function MediaPane() {
  const scenes = useScenes();

	const allMedia = ([
		...scenes
		.filter(s => s.name !== 'MissingClipScene' && s.name !== 'EmptyTimelineScene')
		.map(s => [ `\\scene\\${s.name}`, <SceneItem key={`\\scene\\${s.name}`} scene={s}/> ])
	] as [ string, VNode ][])
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([_, v]) => v);

	return (
		<div class={styles.media_grid}>
			{allMedia}
		</div>
	);
}
