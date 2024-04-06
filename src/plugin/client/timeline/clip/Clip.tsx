/* @jsxImportSource preact */

import clsx from 'clsx';
import { useRef } from 'preact/hooks';
import { forwardRef } from 'preact/compat';
import { ComponentChildren } from 'preact';
import { useApplication } from '@motion-canvas/ui';

import styles from './Clip.module.scss';

import ImageClip from './ImageClip';
import SceneClip from './SceneClip';
import VideoClip from './VideoClip';
import AudioClip from './AudioClip';
import MissingClip from './MissingClip';
import { Clip, ClipType } from '../../Types';
import { useTimeline, useUIContext } from '../../Contexts';

export interface ClipChildProps {
	clip: Clip;

	onMove: (frames: number) => void;
	onResize: (side: 'left' | 'right', offset: number) => void;
	onCommit: () => void;
	onDragClip: (side: 'left' | 'right' | 'replace') => void;
}

interface ClipProps extends ClipChildProps {
	staticChildren?: ComponentChildren;
	stickyChildren?: ComponentChildren;

	class?: string;
}

export default forwardRef<HTMLDivElement, ClipProps>(function Clip({ clip, ...props }, ref) {
	const { addSource: dragging } = useUIContext();
  const { player, meta } = useApplication();
  const { framesToPixels, pixelsToFrames } = useTimeline();
	const { addSource } = useUIContext();

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
	const croppedRight = clip.cache.sourceFrames
		? clip.cache.lengthFrames < clip.cache.sourceFrames - clip.cache.startFrames
		: false;

  return (
    <div
			ref={ref}
      class={clsx(styles.clip, props.class,
				croppedLeft && styles.cropped_left,
				croppedRight && styles.cropped_right,
				addSource.value && styles.add_source,
			)}
      style={{ width: `${width}px`, marginLeft: `${framesToPixels(clip.cache.clipRange[0])}px` }}
    >
			<div class={styles.clip_wrapper}>
				<div
					class={styles.clip_inner}
					onPointerDown={handleMoveStart}
					onPointerMove={handleMoveMove}
					onPointerUp={handleMoveEnd}
				>
					{props.staticChildren}

					<div class={styles.clip_container}>
						<div class={styles.clip_label}>{props.stickyChildren}</div>
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
			</div>

			{addSource.value && <div class={clsx(styles.drop_targets)}>
				<div class={clsx(styles.drop_target, styles.left)}
				onDragOver={() => console.warn('dragOver')}
					onMouseOver={dragging && (() => props.onDragClip('left'))}/>
				<div class={clsx(styles.drop_target, styles.replace)}
					onMouseOver={dragging && (() => props.onDragClip('replace'))}/>
				<div class={clsx(styles.drop_target, styles.right)}
					onMouseOver={dragging && (() => props.onDragClip('right'))}/>
			</div>}
    </div>
  );
});

export { default as SceneClip } from './SceneClip';
export { default as ImageClip } from './ImageClip';
export { default as VideoClip } from './VideoClip';
export { default as MissingClip } from './MissingClip';
export { default as AudioClip } from './AudioClip';

export const ClipComponents: Record<ClipType, typeof MissingClip> = {
	image: ImageClip,
	scene: SceneClip,
	video: VideoClip,
	audio: AudioClip,
}
