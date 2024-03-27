/* @jsxImportSource preact */

import clsx from 'clsx';
import { VNode } from 'preact';
import { useEffect, useState, useMemo, useCallback } from 'preact/hooks';
import { useScenes, Button, useStorage, useApplication} from '@motion-canvas/ui';

import styles from './Media.module.scss';

import * as Icon from '../icon';
import { ClipSource, ClipSourceComponents, ClipTypes } from '../Types';
import SceneClipItem from './SceneClipItem';
import AudioClipItem from './AudioClipItem';
import VideoClipItem from './VideoClipItem';
import ImageClipItem from './ImageClipItem';

const AUDIO_FILES = import.meta.glob(`/media/*.(wav|mp3|ogg|flac)`);
const VIDEO_FILES = import.meta.glob(`/media/*.(mp4|mkv|webm)`);
const IMAGE_FILES = import.meta.glob(`/media/*.(png|jpg|jpeg|webp)`);

export default function MediaPane() {
  const scenes = useScenes();
	const { player } = useApplication();

	const [ view, setView ] = useStorage<'lg' | 'md' | 'sm' | 'list'>('md');

	const [ clipSources, setClipSources ] = useState<ClipSource[]>([]);

	const replaceSourcesOfType = useCallback((type: string, insert: ClipSource[]) => {
		setClipSources(clipSources => [
			...clipSources.filter(s => s.type !== type),
			...insert,
		]);
	}, [])

	useEffect(() => void Promise.all(Object.values(AUDIO_FILES).map(async (f) =>
		(await f() as any).default)).then(sources => replaceSourcesOfType('audio', sources)), []);
	useEffect(() => void Promise.all(Object.values(VIDEO_FILES).map(async (f) =>
		(await f() as any).default)).then(sources => replaceSourcesOfType('video', sources)), []);
	useEffect(() => void Promise.all(Object.values(IMAGE_FILES).map(async (f) =>
		(await f() as any).default)).then(sources => replaceSourcesOfType('image', sources)), [])
	useEffect(() => void replaceSourcesOfType('scene', scenes.filter(({ name }) =>
		name !== 'EmptyTimelineScene' && name !== 'MissingClipScene').map(scene => ({
		type: 'scene',
		path: scene.name,
		name: scene.name,
		duration: player.status.framesToSeconds(scene.lastFrame - scene.firstFrame),
 	}))), [ scenes ]);

	const clipSourceElements = useMemo(() => {
		function onDragStart(source: ClipSource) {
			console.log('dragStart');
		}

		function onDragMove(source: ClipSource) {
			console.log('dragMove');
		}

		function onDragEnd(source: ClipSource) {
			console.log('dragEnd');
		}

		return clipSources
			.sort((a, b) => (ClipTypes.indexOf(a.type) - ClipTypes.indexOf(b.type)) || a.name.localeCompare(b.name))
			.map(s => {
				const Component = ClipSourceComponents[s.type];
				return (
					<Component
						key={s.path}
						source={s}
						onDragStart={() => onDragStart(s)}
						onDragMove={() => onDragMove(s)}
						onDragEnd={() => onDragEnd(s)}
					/>
				);
			});
	}, [ clipSources ]);

	return (
		<div class={styles.media_pane}>
			<div class={styles.view}>
				<Button onClick={() => setView('lg')} title='Large View'><Icon.ViewLg/></Button>
				<Button onClick={() => setView('md')} title='Medium View'><Icon.ViewMd/></Button>
				<Button onClick={() => setView('sm')} title='Small View'><Icon.ViewSm/></Button>
				<Button onClick={() => setView('list')} title='List View'><Icon.ViewList/></Button>
			</div>
			<div class={clsx(styles.media_container, styles[view])}>
				{clipSourceElements}
			</div>
		</div>
	);
}
