/* @jsxImportSource preact */

import clsx from 'clsx';
import { ComponentChildren, VNode } from 'preact';
import { useContext, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useApplication, usePreviewSettings, useSubscribableValue } from '@motion-canvas/ui';

import styles from './Clip.module.scss';

import { Clip, copyClip } from '../../Types';
import { Store } from '../../Util';
import { TimelineContext } from '../TimelineContext';

export interface ClipChildProps {
	clip: Clip;

	onMove: (frames: number) => void;
	onResize: (side: 'left' | 'right', offset: number) => void;
	onCommit: () => void;
}

interface ClipProps {
	clip: Clip;

	onMove: (frames: number) => void;
	onResize: (side: 'left' | 'right', offset: number) => void;
	onCommit: () => void;

	attachedChildren?: ComponentChildren;
	labelChildren?: ComponentChildren;

	class?: string;
}

export default function Clip({ clip, ...props }: ClipProps) {
  const { player, meta } = useApplication();
  const { framesToPixels, pixelsToFrames, offset } = useContext(TimelineContext);

	const moveSide = useRef<'left' | 'right'>('left');
	const moveOffset = useRef(0);

	function handleSeek(e: MouseEvent) {
		e.stopPropagation();
		meta.shared.range.set([
			player.status.framesToSeconds(clip.cache.clipRange[0]),
			player.status.framesToSeconds(clip.cache.clipRange[1]),
		]);
	}

	function handleMoveStart(e: PointerEvent) {
		e.preventDefault();
		e.stopPropagation();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		moveOffset.current = 0;
	}

	function handleMoveMove(e: PointerEvent) {
		if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
		e.preventDefault();
		e.stopPropagation();

		moveOffset.current += pixelsToFrames(e.movementX);
		props.onMove(Math.round(moveOffset.current));
	}

	function handleMoveEnd(e: PointerEvent) {
		props.onCommit();
		(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
	}

	function handleResizeStart(e: PointerEvent, side: 'left' | 'right') {
		e.preventDefault();
		e.stopPropagation();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		moveSide.current = side;
		moveOffset.current = 0;
	}

	function handleResizeMove(e: PointerEvent) {
		if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
		e.preventDefault();
		e.stopPropagation();

		moveOffset.current += pixelsToFrames(e.movementX);
		props.onResize(moveSide.current, Math.round(moveOffset.current));
	}

	function handleResizeEnd(e: PointerEvent) {
		props.onCommit();
		(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
	}

	const width = framesToPixels(clip.cache.clipRange[1] - clip.cache.clipRange[0]);

	const croppedLeft = clip.start > 0;
	const croppedRight = clip.cache.lengthFrames < clip.cache.sourceFrames - clip.cache.startFrames;

  return (
    <div
      class={clsx(styles.clip, props.class,
				croppedLeft && styles.cropped_left,
				croppedRight && styles.cropped_right
			)}
      style={{ width: `${width}px`, left: `${framesToPixels(clip.cache.clipRange[0])}px` }}
    >
			<div class={styles.clip_wrapper}>
				<div
					class={styles.clip_inner}
					onPointerDown={handleMoveStart}
					onPointerMove={handleMoveMove}
					onPointerUp={handleMoveEnd}
				>
					<div className={styles.clip_container}>
						<div className={styles.clip_label} style={{
    					paddingLeft: `${Math.max(offset - framesToPixels(clip.cache.clipRange[0]), 0)}px`
						}}>
							{props.labelChildren}
						</div>
					</div>

					<div class={clsx(styles.clip_drag, styles.left, croppedLeft && styles.can_extend)}
						onPointerDown={(e) => handleResizeStart(e, 'left')}
						onPointerMove={handleResizeMove}
						onPointerUp={handleResizeEnd}
					/>
					<div class={clsx(styles.clip_drag, styles.right, croppedRight && styles.can_extend)}
						onPointerDown={(e) => handleResizeStart(e, 'right')}
						onPointerMove={handleResizeMove}
						onPointerUp={handleResizeEnd}
					/>
	      </div>

				{props.attachedChildren}
			</div>
    </div>
  );
}

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 24;
const CHONKYNESS = 3;
const LAYERS = 4;

interface AudioClipProps {
	clip: Clip;
	range: [ number, number ];
}

export function AudioClip({ clip, range }: AudioClipProps) {
	const { player } = useApplication();

	const containerRef = useRef<HTMLDivElement>();
	const canvasRef = useRef<HTMLCanvasElement>();
	const context = useMemo(() => canvasRef.current?.getContext('2d'), [ canvasRef.current ]);
	const { pixelsToFrames, framesToPixels } = useContext(TimelineContext);

	const audioData = useSubscribableValue(player.audio.onDataChanged);
	const {
		density,
		firstVisibleFrame,
		lastVisibleFrame
	} = useContext(TimelineContext);

	useLayoutEffect(() => {
    if (!context) return;
    context.clearRect(0, 0, CANVAS_WIDTH, 40);
    if (!audioData) return;

		context.fillStyle = getComputedStyle(context.canvas).getPropertyValue('fill');

    const start =
      (player.status.framesToSeconds(firstVisibleFrame) - 0) *
      audioData.sampleRate;
    const end =
      (player.status.framesToSeconds(lastVisibleFrame) - 0) *
      audioData.sampleRate;

    const flooredStart = Math.floor(start);
    const padding = flooredStart - start;
    const length = end - start;
    const step = Math.ceil(density);


		const timePerChonk = player.status.framesToSeconds(pixelsToFrames(CHONKYNESS));
		const samplesPerChonk = timePerChonk * audioData.sampleRate;

		for (let i = 0; i < CANVAS_WIDTH / CHONKYNESS; i++) {
			let start = i * samplesPerChonk;

			for (let j = 0; j < LAYERS; j++) {
				const offset = Math.floor(start + samplesPerChonk / LAYERS * j / 2) * 2;
				const a = (audioData.peaks[offset] / audioData.absoluteMax) * CANVAS_HEIGHT / 2;
				const b = (audioData.peaks[offset + 1] / audioData.absoluteMax) * CANVAS_HEIGHT / 2;
				const min = Math.min(a, b);
				const max = Math.max(a, b);

				context.fillRect(
					i * CHONKYNESS,
					CANVAS_HEIGHT / 2 - max,
					CHONKYNESS,
					-min + max
				);
			}
		}
  }, [,
    context,
    audioData,
    density,
    firstVisibleFrame,
    lastVisibleFrame,
	]);

	return (
    <Clip
			class={styles.audio_clip}
			clip={clip}
			range={range}
			labelChildren={
				<div className={styles.name} title='Go to source'>
					Audio
				</div>
			}>
				<div ref={containerRef} className={styles.audio_container}>
					<canvas ref={canvasRef} className={styles.audio_waveform} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}/>
				</div>
    </Clip>
  );
}

export { default as SceneClip } from './SceneClip';
export { default as MissingClip } from './MissingClip';
