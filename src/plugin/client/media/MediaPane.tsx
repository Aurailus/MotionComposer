/* @jsxImportSource preact */

import { useScenes, MotionCanvas, usePlayerState, useApplication, formatDuration, Button, ButtonSelect, useStorage} from '@motion-canvas/ui';
import clsx from 'clsx';
import { VNode } from 'preact';
import { useRef, useLayoutEffect, useEffect, useState, useMemo, useContext } from 'preact/hooks';
import { Scene, Vector2, all, usePlayback } from '@motion-canvas/core';

import styles from './Media.module.scss';

import * as Icon from '../icon';
import { useCurrentClip } from '../Contexts';

const src = document.createElement('canvas');
const srcCtx = src.getContext('2d')!;
const dst = document.createElement('canvas');
const dstCtx = dst.getContext('2d')!;

const PREVIEW_WIDTH = 240;
const RESOLUTION_MULT = 2;
const PREVIEW_FRAME_OFFSET = 30;

function SceneItem({ scene }: { scene: Scene }) {
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
	}, [ imgRef.current, scene ]);

	return (
		<div class={clsx(styles.media_item, styles.scene)}>
			<img ref={imgRef} class={styles.thumbnail}/>
			<Icon.Scene class={styles.icon}/>
			<p class={styles.name}>{scene.name}</p>
			<p class={styles.duration}>{formatDuration(player.status.framesToSeconds(scene.lastFrame - scene.firstFrame))}</p>
		</div>
	)
}

function VideoItem({ video }: { video: any }) {
	return (
		<div class={clsx(styles.media_item, styles.video)}>
			<img class={styles.thumbnail} src={video.thumbnail}/>
			<Icon.Video class={styles.icon}/>
			<p class={styles.name} title={video.name}>{video.name}</p>
			<p class={styles.duration}>{formatDuration(video.length)}</p>
		</div>
	);
}

function ImageItem({ image }: { image: any }) {
	return (
		<div class={clsx(styles.media_item, styles.image)}>
			<img class={styles.thumbnail} src={image.thumbnail}/>
			<Icon.Image class={styles.icon}/>
			<p class={styles.name} title={image.name}>{image.name}</p>
			<p class={styles.duration}>--:--:--</p>
		</div>
	);
}

function AudioItem({ audio }: { audio: any }) {
	const imgRef = useRef<HTMLImageElement>(null);
	const [ imgData, setImgData ] = useState<string>();

	useLayoutEffect(() => {
		const W = 109;
		const H = 109 * (11/16);
		const PIXELS_PER_WAVE = 3;
		const POW = 1;

		const numBlocks = Math.floor(W / PIXELS_PER_WAVE);
		const samplesPerBlock = Math.floor(audio.peaks.length / 2 / numBlocks);

		dst.width = W;
		dst.height = H;
    dstCtx.clearRect(0, 0, W, H);

		dstCtx.fillStyle = getComputedStyle(imgRef.current).getPropertyValue('fill');
		dstCtx.fillStyle = `color-mix(in hsl, ${dstCtx.fillStyle} ${1/samplesPerBlock*4*100}%, transparent)`;

    dstCtx.beginPath();

		for (let i = 0; i < numBlocks; i++) {
			for (let j = 0; j < samplesPerBlock; j++) {
				let minPeak = -audio.peaks[(i * samplesPerBlock + j) * 2] / 32768;
				let maxPeak = -audio.peaks[(i * samplesPerBlock + j) * 2 + 1] / 32768;
				if (minPeak > maxPeak) {
					const temp = minPeak;
					minPeak = maxPeak;
					maxPeak = temp;
				}

				const minPos = Math.pow(Math.abs(minPeak), POW) * (minPeak < 0 ? -1 : 1) * 3/2 * H/2;
				const maxPos = Math.pow(Math.abs(maxPeak), POW) * (maxPeak < 0 ? -1 : 1) * 3/2 * H/2;
				dstCtx.fillRect(i * PIXELS_PER_WAVE, H/2 + minPos, PIXELS_PER_WAVE, maxPos - minPos);
			}
		}

		dstCtx.fill();
		setImgData(dst.toDataURL());
	}, [ audio ]);

	return (
		<div class={clsx(styles.media_item, styles.audio)}>
			<img ref={imgRef} class={styles.thumbnail} src={imgData}/>
			<Icon.Audio class={styles.icon}/>
			<p class={styles.name} title={audio.name}>{audio.name}</p>
			<p class={styles.duration}>{formatDuration(audio.length)}</p>
		</div>
	);
}

const AUDIO_FILES = import.meta.glob(`/media/*.(wav|mp3|ogg|flac)`);
const VIDEO_FILES = import.meta.glob(`/media/*.(mp4|mkv|webm)`);
const IMAGE_FILES = import.meta.glob(`/media/*.(png|jpg|jpeg|webp)`);

export default function MediaPane() {
  const scenes = useScenes();

	const [ view, setView ] = useStorage<'lg' | 'md' | 'sm' | 'list'>('md');

	const [ resolvedAudio, setResolvedAudio ] = useState<any[]>([]);
	const [ resolvedVideo, setResolvedVideo ] = useState<any[]>([]);
	const [ resolvedImages, setResolvedImages ] = useState<any[]>([]);

	useEffect(() => {
		Promise.all(Object.values(AUDIO_FILES).map(async f => (await f() as any).default)).then(setResolvedAudio);
	}, [])
	useEffect(() => {
		Promise.all(Object.values(VIDEO_FILES).map(async f => (await f() as any).default)).then(setResolvedVideo);
	}, [])
	useEffect(() => {
		Promise.all(Object.values(IMAGE_FILES).map(async f => (await f() as any).default)).then(setResolvedImages);
	}, [])

	const allMedia = useMemo(() => {
		return ([
			...scenes
				.filter(s => s.name !== 'MissingClipScene' && s.name !== 'EmptyTimelineScene')
				.map(s => [ `${s.name}\\scene\\`, <SceneItem key={`\\scene\\${s.name}`} scene={s}/> ]),
			...resolvedAudio
				.map(s => [ `${s.id}\\audio\\`, <AudioItem key={`\\audio\\${s.id}`} audio={s}/> ]),
			...resolvedVideo
				.map(s => [ `${s.id}\\video\\`, <VideoItem key={`\\video\\${s.id}`} video={s}/> ]),
			...resolvedImages
				.map(s => [ `${s.id}\\image\\`, <ImageItem key={`\\image\\${s.id}`} image={s}/> ]),
		] as [ string, VNode ][])
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([_, v]) => v);
	}, [ resolvedAudio, resolvedVideo, resolvedImages, scenes ]);

	return (
		<div class={styles.media_pane}>
			<div class={styles.view}>
				<Button onClick={() => setView('lg')} title='Large View'><Icon.ViewLg/></Button>
				<Button onClick={() => setView('md')} title='Medium View'><Icon.ViewMd/></Button>
				<Button onClick={() => setView('sm')} title='Small View'><Icon.ViewSm/></Button>
				<Button onClick={() => setView('list')} title='List View'><Icon.ViewList/></Button>
			</div>
			<div class={clsx(styles.media_container, styles[view])}>
				{[...allMedia ]}
			</div>
		</div>
	);
}
