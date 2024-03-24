/* @jsxImportSource preact */

import { MouseButton, MouseMask, clamp, labelClipDraggingLeftSignal, useApplication, useDuration, usePreviewSettings, useSize, useStateChange, useStorage } from '@motion-canvas/ui';
import styles from './Timeline.module.scss';

import ClipsTrack from './ClipsTrack';
import AudioTrack from './AudioTrack';
import { useSignal } from '@preact/signals';
import { TimelineContext, TimelineContextData } from './TimelineContext';
import { useLayoutEffect, useMemo, useRef, useContext } from 'preact/hooks';
import { Timestamps } from './Timestamps';
import { Playhead } from './Playhead';
import { useSignalish } from '../Signalish';
import { RangeSelector } from './RangeSelector';
import { wrapper } from '@motion-canvas/2d';
import { PluginContext } from '../Context';

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
	const { userRange, playheadPos } = useContext(PluginContext);
	const { player } = useApplication();
	const { fps } = usePreviewSettings();

	const duration = useDuration();
	const tracksRef = useRef<HTMLDivElement>();
	const wrapperRef = useRef<HTMLDivElement>();
	const playheadRef = useRef<HTMLDivElement>();
	const rect = useSize(wrapperRef);
	const rangeRef = useRef<HTMLDivElement>();

	const seeking = useSignal<number | null>(null);

	/** Loaded the scene information. */
	const isReady = duration > 0;

	/** Set the initial scroll position once everything loads. */
  useLayoutEffect(() => void(wrapperRef.current.scrollLeft = offset), [rect.width > 0 && isReady ]);

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
		const minFrame = player.status.secondsToFrames(userRange.value[0]);
		const maxFrame = player.status.secondsToFrames(userRange.value[1]);

    seeking.value = clamp(minFrame, maxFrame, frame);
    if (playheadPos() !== frame) player.requestSeek(frame);

    // const isInUserRange = player.isInUserRange(frame);
    // const isOutOfRange = player.isInRange(frame) && !isInUserRange;
    // if (!warnedAboutRange.current && !reduceMotion && isOutOfRange) {
    //   warnedAboutRange.current = true;
    //   rangeRef.current?.animate(borderHighlight(), {
    //     duration: 200,
    //   });
    // }

    // if (isInUserRange) {
    //   warnedAboutRange.current = false;
    // }
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

	return (
		<TimelineContext.Provider value={state}>
			<div class={styles.timeline}>
				<div class={styles.timeline_labels}>
					<div class={styles.timeline_label}><label>Clips</label></div>
					<div class={styles.timeline_label}><label>Audio 1</label></div>
					<div class={styles.timeline_label}><label>Audio 2</label></div>
					<div class={styles.timeline_label}><label>Audio 3</label></div>
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
								// width: `${sizes.playableLength}px`,
								left: `${sizes.paddingLeft}px` }}
						>
							<RangeSelector rangeRef={rangeRef}/>
							<Timestamps/>
							<Playhead seeking={seeking}/>
							<ClipsTrack/>
							<AudioTrack/>
							<div class={styles.scrub_line} ref={playheadRef}/>
						</div>
					</div>
				</div>
			</div>
		</TimelineContext.Provider>
	)
}
