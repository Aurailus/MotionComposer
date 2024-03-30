/* @jsxImportSource preact */

import { useSignal } from '@preact/signals';
import { useLayoutEffect, useMemo, useRef, useContext } from 'preact/hooks';
import { MouseButton, MouseMask, borderHighlight, clamp, labelClipDraggingLeftSignal, useApplication, useDuration, useKeyHold, usePlayerTime, usePreviewSettings, useScenes, useSharedSettings, useSize, useStateChange, useStorage } from '@motion-canvas/ui';

import styles from './Timeline.module.scss';

import { useStore } from '../Hooks';
import { Playhead } from './Playhead';
import { useClips } from '../Contexts';
import { Timestamps } from './Timestamps';
import { Clip, copyClip } from '../Types';
import { RangeSelector } from './RangeSelector';
import { TimelineContext, TimelineContextData } from './TimelineContext';
import { ImageClip, MissingClip, SceneClip, VideoClip } from './clip/Clip';
import Toolbar from './Toolbar';

const NUM_SNAP_FRAMES = 3;

const ZOOM_SPEED = 0.1;

const ZOOM_MIN = 0.5;

const MAX_FRAME_SIZE = 128;

const TIMESTAMP_SPACING = 32;

/** If the mouse is less than this many pixels from the left edge of the timeline,
 * the timeline start will not shift on zoom. */
const ZOOM_START_THRESHOLD = 48;

export default function Timeline() {
	const [ scale, setScale ] = useStorage('timeline-scale', 1);
	const [ offset, setOffset ] = useStorage('timeline-offset', 0);
	const { range } = useSharedSettings();
	const { player } = useApplication();
	const { fps } = usePreviewSettings();
	const time = usePlayerTime();
  const scenes = useScenes();
  const clips = useClips();

	const shiftHeld = useKeyHold('Shift');
	const ctrlHeld = useKeyHold('Control');

	const snap = !shiftHeld;
	const overwrite = ctrlHeld;

	const duration = useDuration();
	const tracksRef = useRef<HTMLDivElement>();
	const wrapperRef = useRef<HTMLDivElement>();
	const playheadRef = useRef<HTMLDivElement>();
	const rect = useSize(wrapperRef);
	const rangeRef = useRef<HTMLDivElement>();

	const modifiedClips = useStore<Clip[][]>(() => clips().map(arr => [ ...arr ]));
	useLayoutEffect(() => void modifiedClips(clips().map(arr => [ ...arr ])), [ clips ]);

	const warnedAboutRange = useRef(false);
	const seeking = useSignal<number | null>(null);

	/** Loaded the scene information. */
	const isReady = duration > 0;

	/** Set the initial scroll position once everything loads. */
  useLayoutEffect(() => void(wrapperRef.current.scrollLeft = offset), [ rect.width > 0 && isReady ]);

	const sizes = useMemo(() => ({
      viewLength: rect.width,
      paddingLeft: 0,
      fullLength: rect.width * scale + rect.width,
      playableLength: rect.width * scale,
    }),
    [rect.width, scale],
  );

  const zoomMax = (MAX_FRAME_SIZE / sizes.viewLength) * duration;

  const conversion = useMemo(
    () => ({
      framesToPixels: (value: number) =>
        (value / duration) * sizes.playableLength,
      framesToPercents: (value: number) => (value / duration) * 100,
      pixelsToFrames: (value: number) => (value / sizes.playableLength) * duration,
    }),
    [duration, sizes],
  );

  const state = useMemo<TimelineContextData>(() => {
    const density = Math.pow(2, Math.round(Math.log2(duration / sizes.playableLength)));
    const segmentDensity = Math.floor(TIMESTAMP_SPACING * density);
    const clampedSegmentDensity = Math.max(1, segmentDensity);
    const relativeOffset = offset - sizes.paddingLeft;
    const firstVisibleFrame = Math.floor(
      conversion.pixelsToFrames(relativeOffset) / clampedSegmentDensity) * clampedSegmentDensity;
    const lastVisibleFrame = Math.ceil(conversion.pixelsToFrames(
			relativeOffset + sizes.viewLength + TIMESTAMP_SPACING) / clampedSegmentDensity) * clampedSegmentDensity;
    const startPosition = sizes.paddingLeft + rect.x - offset;

    return {
      viewLength: sizes.viewLength,
      offset: relativeOffset,
      firstVisibleFrame,
      lastVisibleFrame,
      density,
      segmentDensity,
      pointerToFrames: (value: number) =>
        conversion.pixelsToFrames(value - startPosition),
      ...conversion,
    };
  }, [sizes, conversion, duration, offset]);

	useStateChange(([prevDuration, prevWidth]) => {
      const newDuration = duration / fps;
      let newScale = scale;
      if (prevDuration !== 0 && newDuration !== 0) {
        newScale *= newDuration / prevDuration;
      }
      if (prevWidth !== 0 && rect.width !== 0) {
        newScale *= prevWidth / rect.width;
      }
      if (!isNaN(newScale) && duration > 0) {
        setScale(clamp(ZOOM_MIN, zoomMax, newScale));
      }
    },
    [duration / fps, rect.width],
  );

	useLayoutEffect(() => {
    wrapperRef.current.scrollLeft = offset;
  }, [scale]);

	/** Updates the offset for horizontal scrolling. */
	const handleScroll = (evt: UIEvent) => {
		setOffset((evt.target as HTMLElement).scrollLeft);
	};

	/** Updates the scale of the timeline. */
	const handleWheel = (evt: WheelEvent) => {
		evt.stopPropagation();

		const isVertical = Math.abs(evt.deltaX) > Math.abs(evt.deltaY);
		if (evt.shiftKey || isVertical) return;

		evt.preventDefault();

		let ratio = 1 - Math.sign(evt.deltaY) * ZOOM_SPEED;
		let newScale = scale * ratio;
		if (newScale < ZOOM_MIN) {
			newScale = ZOOM_MIN;
			ratio = newScale / scale;
		}
		if (newScale > zoomMax) {
			newScale = zoomMax;
			ratio = newScale / scale;
		}
		if (newScale === scale) {
			return;
		}

		let pointer = offset - sizes.paddingLeft + evt.x - rect.x;
		if (evt.x - rect.x < ZOOM_START_THRESHOLD) pointer = offset;

		const newTrackSize = rect.width * newScale * +rect.width;
		const maxOffset = newTrackSize - rect.width;
		const newOffset = clamp(0, maxOffset, offset - pointer + pointer * ratio);

		wrapperRef.current.scrollLeft = newOffset;
		if (!isNaN(newScale)) setScale(newScale);
		if (!isNaN(newOffset)) setOffset(newOffset);

		playheadRef.current.style.left = `${evt.x - rect.x + newOffset}px`;
	};

	function scrub(pos: number) {
    const frame = Math.floor(state.pointerToFrames(pos));
		const minFrame = player.status.secondsToFrames(range[0]);
		const maxFrame = Math.min(player.status.secondsToFrames(range[1]), duration);

    seeking.value = clamp(minFrame, maxFrame, frame);
    if (time.frame !== seeking.value) player.requestSeek(seeking.value);

    const isInUserRange = player.isInUserRange(frame);
    const isOutOfRange = player.isInRange(frame) && !isInUserRange;
    if (!warnedAboutRange.current && isOutOfRange) {
      warnedAboutRange.current = true;
      rangeRef.current?.animate(borderHighlight(), { duration: 200 });
    }
    if (isInUserRange) warnedAboutRange.current = false;
	}

	function handleScrubStart(evt: PointerEvent) {
		if (evt.button === MouseButton.Left) {
			evt.preventDefault();
			(evt.currentTarget as any).setPointerCapture(evt.pointerId);
			playheadRef.current.style.display = 'none';
			scrub(evt.x);
		}
		else if (evt.button === MouseButton.Middle) {
			evt.preventDefault();
			(evt.currentTarget as any).setPointerCapture(evt.pointerId);
			wrapperRef.current.style.cursor = 'grabbing';
			playheadRef.current.style.display = 'none';
		}
	}

	function handleScrubMove(evt: PointerEvent) {
		if ((evt.currentTarget as any).hasPointerCapture(evt.pointerId)) {
			if (evt.buttons & MouseMask.Primary) {
				scrub(evt.x);
			}
			else if (evt.buttons & MouseMask.Auxiliary) {
				const newOffset = clamp(
					0,
					sizes.playableLength,
					offset - evt.movementX,
				);
				setOffset(newOffset);
				wrapperRef.current.scrollLeft = newOffset;
			}
		}
		else if (labelClipDraggingLeftSignal.value === null) {
			playheadRef.current.style.left = `${evt.x - rect.x + offset}px`;
		}
	}

	function handleScrubEnd(evt: PointerEvent) {
		if (labelClipDraggingLeftSignal.value === null) {
			playheadRef.current.style.left = `${evt.x - rect.x + offset}px`;
		}
		if (
			evt.button === MouseButton.Left ||
			evt.button === MouseButton.Middle
		) {
			seeking.value = null;
			// warnedAboutRange.current = false;
			(evt.currentTarget as any).releasePointerCapture(evt.pointerId);
			wrapperRef.current.style.cursor = '';
			playheadRef.current.style.display = '';
		}
	}

	function recomputeFromCache(clip: Clip) {
		clip.length = player.status.framesToSeconds(clip.cache.lengthFrames);
		clip.offset = player.status.framesToSeconds(clip.cache.clipRange[0]);
		clip.start = player.status.framesToSeconds(clip.cache.startFrames);
	}

	function fixOverlap(channel: Clip[], newClip: Clip, oldClip: Clip) {
		let toDelete = [];

		if (overwrite) {
			for (let i = 0; i < channel.length; i++) {
				let clip = channel[i];

				// Left side overlapping.
				if (newClip.cache.clipRange[1] > clip.cache.clipRange[0] &&
					newClip.cache.clipRange[0] < clip.cache.clipRange[0]) {

					const repl = channel[i] = copyClip(clip);
					const diff = newClip.cache.clipRange[1] - clip.cache.clipRange[0];
					repl.cache.clipRange[0] = newClip.cache.clipRange[1];
					repl.cache.startFrames += diff;
					repl.cache.lengthFrames = repl.cache.clipRange[1] - repl.cache.clipRange[0];
					recomputeFromCache(repl);

					if (repl.cache.lengthFrames <= 0) toDelete.push(repl);
				}

				// Right side overlapping.
				if (newClip.cache.clipRange[0] < clip.cache.clipRange[1] &&
					newClip.cache.clipRange[1] > clip.cache.clipRange[1]) {

					const repl = channel[i] = copyClip(clip);
					repl.cache.clipRange[1] = newClip.cache.clipRange[0];
					repl.cache.lengthFrames = repl.cache.clipRange[1] - repl.cache.clipRange[0];
					recomputeFromCache(repl);

					if (repl.cache.lengthFrames <= 0) toDelete.push(repl);
				}
			}
		}
		else {
			// Bring things back left.
			const backAmount = oldClip.cache.clipRange[0] - newClip.cache.clipRange[0];
			if (backAmount > 0) {
				let oldRange1 = oldClip.cache.clipRange[1];
				for (let i = 1; i < channel.length; i++) {
					let clip = channel[i];
					if (clip.cache.clipRange[0] < oldRange1) continue;
					if (clip.cache.clipRange[0] > oldRange1) break;

					oldRange1 = clip.cache.clipRange[1];
					const repl = channel[i] = copyClip(clip);
					repl.cache.clipRange[0] -= backAmount;
					repl.cache.clipRange[1] -= backAmount;
					recomputeFromCache(repl);
				}
			}

			// Push things right.
			for (let i = 1; i < channel.length; i++) {
				let clip = channel[i];
				let prevClip = channel[i - 1];

				if (prevClip.cache.clipRange[1] > clip.cache.clipRange[0]) {
					const repl = channel[i] = copyClip(clip);
					const diff = prevClip.cache.clipRange[1] - clip.cache.clipRange[0];
					repl.cache.clipRange[0] += diff;
					repl.cache.clipRange[1] += diff;
					recomputeFromCache(repl);
				}
			}
		}

		for (let clip of toDelete) {
			const ind = channel.indexOf(clip);
			if (ind !== -1) channel.splice(ind, 1);
		}
	}

	function handleClipResize(clip: Clip, side: 'left' | 'right', offset: number) {
		const newClips = clips().map(arr => [ ...arr ]);
		const newClipInd = newClips[0].findIndex(c => c.uuid === clip.uuid);
		if (newClipInd === -1) return;
		const oldClip = newClips[0][newClipInd];
		const newClip = newClips[0][newClipInd] = copyClip(oldClip);

		if (side === 'right') {
			const maxNewPos = newClip.cache.sourceFrames - newClip.cache.startFrames + newClip.cache.clipRange[0];
			let newPos = newClip.cache.clipRange[0] + newClip.cache.lengthFrames + offset;

			if (snap) {
				const nearbyClip = newClips[0].find(
					c => Math.abs(c.cache.clipRange[0] - newPos) <= NUM_SNAP_FRAMES &&
					c.cache.clipRange[0] <= maxNewPos);
				if (nearbyClip) newPos = nearbyClip.cache.clipRange[0];
			}

			newPos = Math.min(newPos, maxNewPos);
			newClip.cache.clipRange[1] = newPos;
			newClip.cache.lengthFrames = newClip.cache.clipRange[1] - newClip.cache.clipRange[0];
		}
		else if (side === 'left') {
			const oldPos = newClip.cache.clipRange[0];
			const minNewPos = newClip.cache.clipRange[0] - newClip.cache.startFrames;
			let newPos = newClip.cache.clipRange[0] + offset;

			if (snap) {
				const nearbyClip = newClips[0].find(c =>
					Math.abs(c.cache.clipRange[1] - newPos) <= NUM_SNAP_FRAMES &&
					c.cache.clipRange[1] >= minNewPos);
				if (nearbyClip) newPos = nearbyClip.cache.clipRange[1];
			}

			newPos = Math.max(newPos, minNewPos);
			const diff = newPos - oldPos;
			newClip.cache.clipRange[0] = newPos;
			newClip.cache.lengthFrames = newClip.cache.clipRange[1] - newClip.cache.clipRange[0];
			newClip.cache.startFrames = Math.max(newClip.cache.startFrames + diff, 0);
		}

		recomputeFromCache(newClip);
		fixOverlap(newClips[0], newClip, oldClip);
		modifiedClips(newClips);
	}

	function handleClipMove(clip: Clip, offset: number) {
		const newClips = clips().map(arr => [ ...arr ]);
		const newClipInd = newClips[0].findIndex(c => c.uuid === clip.uuid);
		if (newClipInd === -1) return;
		const oldClip = newClips[0][newClipInd];
		const newClip = newClips[0][newClipInd] = copyClip(oldClip);

		let newPos = Math.max(newClip.cache.clipRange[0] + offset);

		if (snap) {
			const snapRight = newClips[0].find(c =>
				Math.abs(c.cache.clipRange[0] - (newPos + newClip.cache.lengthFrames)) <= NUM_SNAP_FRAMES);
			if (snapRight) newPos = snapRight.cache.clipRange[0] - newClip.cache.lengthFrames;
			else {
				const snapLeft = newClips[0].find(c =>
					Math.abs(c.cache.clipRange[1] - newPos) <= NUM_SNAP_FRAMES);
				if (snapLeft) newPos = snapLeft.cache.clipRange[1];
			}
		}

		newPos = Math.max(newPos, 0);

		newClip.cache.clipRange[0] = newPos;
		newClip.cache.clipRange[1] = newPos + newClip.cache.lengthFrames;

		recomputeFromCache(newClip);
		fixOverlap(newClips[0], newClip, oldClip);
		modifiedClips(newClips);
	}

	function handleDragClip(clip: Clip, side: 'left' | 'right' | 'replace') {
		console.log(clip, side);
	}

	function handleClipCommit() {
		clips(modifiedClips());
	}

	return (
		<TimelineContext.Provider value={state}>
			<div class={styles.timeline}>
				<Toolbar/>

				<div class={styles.timeline_labels}>
					<div class={styles.timeline_label}><label>Clips</label></div>
					{/* <div class={styles.timeline_label}><label>Audio 1</label></div>
					<div class={styles.timeline_label}><label>Audio 2</label></div>
					<div class={styles.timeline_label}><label>Audio 3</label></div> */}
				</div>
				<div
					ref={wrapperRef}
					class={styles.timeline_wrapper}
					onScroll={handleScroll}
					onWheel={handleWheel}
					onPointerDown={handleScrubStart}
					onPointerMove={handleScrubMove}
					onPointerUp={handleScrubEnd}
				>
					<div
						class={styles.timeline}
						style={{ width: `${sizes.fullLength}px` }}
					>
						<div
							class={styles.timeline_content}
							style={{
								width: `${conversion.framesToPixels(duration)}px`,
								left: `${sizes.paddingLeft}px` }}
						>
							<RangeSelector rangeRef={rangeRef}/>
							<Timestamps/>
							<Playhead seeking={seeking}/>
							<div className={styles.clips_track}
								style={{ width: conversion.framesToPixels(player.status.secondsToFrames(range[1])) }}>
								{(modifiedClips()[0] ?? []).map(clip => {
									if (clip.cache.source) {
										switch (clip.type) {
											case 'scene': {
												return (
													<SceneClip
														key={clip.uuid}
														clip={clip}

														onResize={(side, diff) => handleClipResize(clip, side, diff)}
														onMove={(diff) => handleClipMove(clip, diff)}
														onCommit={handleClipCommit}
														onDragClip={(side) => handleDragClip(clip, side)}
													/>
												);
											}
											case 'video': {
												return (
													<VideoClip
														key={clip.uuid}
														clip={clip}

														onResize={(side, diff) => handleClipResize(clip, side, diff)}
														onMove={(diff) => handleClipMove(clip, diff)}
														onCommit={handleClipCommit}
														onDragClip={(side) => handleDragClip(clip, side)}
													/>
												)
											}
											case 'image': {
												return (
													<ImageClip
														key={clip.uuid}
														clip={clip}

														onResize={(side, diff) => handleClipResize(clip, side, diff)}
														onMove={(diff) => handleClipMove(clip, diff)}
														onCommit={handleClipCommit}
														onDragClip={(side) => handleDragClip(clip, side)}
													/>
												)
											}
											default: {
												break;
											}
										}
									}
									return <MissingClip
										key={clip.uuid}
										clip={clip}

										onResize={(side, diff) => handleClipResize(clip, side, diff)}
										onMove={(diff) => handleClipMove(clip, diff)}
										onCommit={handleClipCommit}
										onDragClip={(side) => handleDragClip(clip, side)}
									/>;
								})}
							</div>
							{/* <AudioTrack/> */}
							<div class={styles.scrub_line} ref={playheadRef}/>
						</div>
					</div>
				</div>
			</div>
		</TimelineContext.Provider>
	)
}
