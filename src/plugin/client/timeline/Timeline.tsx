/* @jsxImportSource preact */

import { clamp, useDuration, usePreviewSettings, useSize, useStateChange, useStorage } from '@motion-canvas/ui';
import styles from './Timeline.module.scss';

import ClipsTrack from './ClipsTrack';
import AudioTrack from './AudioTrack';
import { useSignal } from '@preact/signals';
import { TimelineContext, TimelineContextData } from './TimelineContext';
import { useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { Timestamps } from './Timestamps';
import { Playhead } from './Playhead';
import { useSignalish } from '../Signalish';

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
	const { fps } = usePreviewSettings();

	const duration = useDuration();
	const tracksRef = useRef<HTMLDivElement>();
	const wrapperRef = useRef<HTMLDivElement>();
	const rect = useSize(wrapperRef);

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

		// playheadRef.current.style.left = `${
		// 	event.x - rect.x + newOffset
		// }px`;
	};

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
							<Timestamps/>
							<Playhead seeking={seeking}/>
							<ClipsTrack/>
							<AudioTrack/>
						</div>
					</div>
				</div>
			</div>
		</TimelineContext.Provider>
	)
}
