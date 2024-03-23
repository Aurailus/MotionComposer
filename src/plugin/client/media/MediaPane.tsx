/* @jsxImportSource preact */

import { useScenes, MotionCanvas, usePlayerState, useApplication, formatDuration} from '@motion-canvas/ui';
import styles from './Media.module.scss';
import { VNode } from 'preact';
import { Scene } from '@motion-canvas/core';

function SceneItem({ scene }: { scene: Scene }) {
	const { player } = useApplication();

	return (
		<div class={styles.media_item}>
			<div class={styles.thumbnail}>
				<MotionCanvas/>
				<p>{formatDuration(player.status.framesToSeconds(scene.lastFrame - scene.firstFrame))}</p>
			</div>
			<p>{scene.name}</p>
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
