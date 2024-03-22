/* @jsxImportSource preact */

import { Scene } from '@motion-canvas/core';
import { useContext, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { findAndOpenFirstUserFile, useApplication, usePreviewSettings, useSubscribableValue } from '@motion-canvas/ui';

import styles from './Timeline.module.scss';

import { SerializedClip } from '../Types';
import { TimelineContext } from './TimelineContext';
import EventLabel from './EventLabel';
import { ComponentChildren, VNode } from 'preact';
import clsx from 'clsx';

interface ClipProps {
	clip: SerializedClip;
	range: [ number, number ];
	class?: string;

	children?: ComponentChildren | ((range: [ number, number ]) => ComponentChildren);
	labelChildren?: ComponentChildren;
}

function Clip(props: ClipProps) {
  const { player, meta } = useApplication();
  const { framesToPixels, pixelsToFrames, offset } = useContext(TimelineContext);

  const labelStyle = useMemo(() => {
    const sceneOffset = framesToPixels(props.range[0]);
    return offset > sceneOffset ? { paddingLeft: `${offset - sceneOffset}px`} : {};
  }, [ offset, props.range[0], framesToPixels]);

	const [ range, setRange ] = useState<[ number, number ]>([ props.range[0], props.range[1] ]);
	const moveSide = useRef<'left' | 'right'>('left');

	function handleSeek(e: MouseEvent) {
		e.stopPropagation();
		meta.shared.range.set([
			player.status.framesToSeconds(props.range[0]),
			player.status.framesToSeconds(props.range[1]),
		]);
	}

	function handleMouseDown(e: MouseEvent) {
		if (e.button === 1) e.preventDefault();
	}

	function handleMouseUp(e: MouseEvent) {
		if (e.button === 1) handleSeek(e);
	}

	function handlePointerDown(e: PointerEvent, side: 'left' | 'right') {
		e.preventDefault();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		moveSide.current = side;
	}

	function handlePointerMove(e: PointerEvent) {
		if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
		e.stopPropagation();
		const diff = pixelsToFrames(e.movementX);
		const newRange: [ number, number ] = [ range[0], range[1] ];
		if (moveSide.current === 'left') newRange[0] = range[0] + diff;
		else newRange[1] = range[1] + diff;
		setRange(newRange);
	}

	function handlePointerUp(e: PointerEvent) {
		if (e.button !== 0) return;
		(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		setRange([ props.range[0], props.range[1] ]);
	}

	const width = framesToPixels(range[1] - range[0]);

  return (
    <div
      class={[ styles.clip, (props.class ?? '').split(' ') ].join(' ')}
      style={{ width: `${width}px` }}
    >
			<div class={styles.clip_inner}>
				<div
					class={styles.clip_handle}
					onMouseDown={handleMouseDown}
					onMouseUp={handleMouseUp}
				>

					<div className={styles.container}>
						<div className={styles.label} style={labelStyle}>
							{props.labelChildren}
						</div>
					</div>

					{typeof props.children === 'function' ? props.children(range) : props.children}

					{props.clip.range[0] !== 0 && <svg class={clsx(styles.crop, styles.left)}
						width={5} height={40} viewBox='0 0 1.3291207 10.5'>
						<path fill='currentColor' d='M 1.3291178,10.583333 2.8541667e-8,9.2562824 1.317749,7.9385334 2.8541667e-8,6.6207843 1.3291178,5.2916666 2.8541667e-8,3.9646158 1.317749,2.6468668 2.8541667e-8,1.3291178 1.3291178,0 h -2.3874511 v 10.583333 z'/>
					</svg>}

					{props.clip.range[1] !== 0 && <svg class={clsx(styles.crop, styles.right)}
						width={5} height={40} viewBox='0 0 1.3291207 10.5'>
						<path fill='currentColor' d='M 1.3291178,10.583333 2.8541667e-8,9.2562824 1.317749,7.9385334 2.8541667e-8,6.6207843 1.3291178,5.2916666 2.8541667e-8,3.9646158 1.317749,2.6468668 2.8541667e-8,1.3291178 1.3291178,0 h -2.3874511 v 10.583333 z'/>
					</svg>}

					<div class={clsx(styles.range_select, styles.left)}
						onPointerDown={(e) => handlePointerDown(e, 'left')}
						onPointerMove={handlePointerMove}
						onPointerUp={handlePointerUp}
					/>
					<div class={clsx(styles.range_select, styles.right)}
						onPointerDown={(e) => handlePointerDown(e, 'right')}
						onPointerMove={handlePointerMove}
						onPointerUp={handlePointerUp}
					/>
	      </div>
			</div>
    </div>
  );
}

interface SceneClipProps {
	scene: Scene;
	clip: SerializedClip;
	range: [ number, number ];
}

export function SceneClip({ scene, clip, range }: SceneClipProps) {
  const events = useSubscribableValue(scene.timeEvents.onChanged);
	const { player } = useApplication();

	async function handleGoToSource(e: MouseEvent) {
		e.stopPropagation();
		if (!scene.creationStack) return;
		await findAndOpenFirstUserFile(scene.creationStack);
	}

	return (
    <Clip
			clip={clip}
			range={range}
			labelChildren={
				<div className={styles.name} title='Go to source'
					onPointerDown={e => e.stopPropagation()}
					onPointerUp={handleGoToSource}>
					{scene.name}
				</div>
			}>
				{(xRange) => {
					return events
					.filter(event => xRange[1] === 0 || player.status.secondsToFrames(event.initialTime) < xRange[1])
					.map(event => <EventLabel key={event.name} event={event} scene={scene} clip={clip} offset={xRange[0] - range[0]}/>)}
				}
    </Clip>
  );
}

interface MissingClipProps {
	clip: SerializedClip;
	range: [ number, number ];
}

export function MissingClip({ clip, range }: MissingClipProps) {
  const { framesToPixels, offset } = useContext(TimelineContext);
	const { fps } = usePreviewSettings();

	return (
    <Clip
			clip={clip}
			range={range}
    >
			<div className={styles.container}>
				<div
					className={styles.name}
				>
					Missing Clip
				</div>
			</div>
    </Clip>
  );
}

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 24;
const CHONKYNESS = 3;
const LAYERS = 4;

interface AudioClipProps {
	clip: SerializedClip;
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

    // context.beginPath();
    // context.moveTo(0, 20);

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



    // for (let index = start; index < end; index += step * 128) {
    //   const offset = index - start;
    //   const sample = Math.round(flooredStart + offset);
    //   if (sample >= audioData.peaks.length) break;

    //   // context.lineTo(
    //   //   ((padding + offset) / length) * CANVAS_WIDTH,
    //   //   (audioData.peaks[sample] / audioData.absoluteMax) * 20 + 20,
    //   // );
    //   // context.lineTo(
    //   //   ((padding + offset + step) / length) * CANVAS_WIDTH,
    //   //   (audioData.peaks[sample + 1] / audioData.absoluteMax) * 20 + 20,
    //   // );

		// 	let a = (audioData.peaks[sample] / audioData.absoluteMax) * CANVAS_HEIGHT / 2;
		// 	let b = (audioData.peaks[sample + 1] / audioData.absoluteMax) * CANVAS_HEIGHT / 2;
		// 	let min = Math.min(a, b);
		// 	let max = Math.max(a, b);

		// 	if (index === start + step * 30) console.log(min, max);

		// 	context.fillRect(
		// 		((padding + offset) / length) * CANVAS_WIDTH,
		// 		CANVAS_HEIGHT / 2 - max,
		// 		CELL_WIDTH,
		// 		-min + max
		// 	)
    // }
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
