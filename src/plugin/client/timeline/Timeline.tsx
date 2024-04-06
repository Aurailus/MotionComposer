/* @jsxImportSource preact */

import clsx from 'clsx';
import { useSignal } from '@preact/signals';
import { useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { MouseButton, MouseMask, borderHighlight, clamp, useApplication, useDuration, usePlayerTime, usePreviewSettings, useSharedSettings, useSize, useStateChange, useStorage } from '@motion-canvas/ui';

import styles from './Timeline.module.scss';

import Toolbar from './Toolbar';
import { Playhead } from './Playhead';
import { Timestamps } from './Timestamps';
import ScrubPreview from './ScrubPreview';
import TimelineTrack from './TimelineTrack';
import { RangeSelector } from './RangeSelector';
import { useClips, useTracks } from '../Contexts';
import TimelineTrackLabel from './TimelineTrackLabel';
import * as Shortcut from '../shortcut/ShortcutMappings';
import useShortcutHover from '../shortcut/useShortcutHover';
import { useShortcut, useStore, useStoredState } from '../Hooks';
import { Clip, EditorMode, EditorTool, copyClip } from '../Types';
import { TimelineContext, TimelineContextData } from '../Contexts';

const NUM_SNAP_FRAMES = 3;

const ZOOM_SPEED = 0.1;

const ZOOM_MIN = 0.5;

const MAX_FRAME_SIZE = 128;

const TIMESTAMP_SPACING = 32;

/** If the mouse is less than this many pixels from the left edge of the timeline,
 * the timeline start will not shift on zoom. */
const ZOOM_START_THRESHOLD = 48;

export default function Timeline() {
	const [ shortcutRef ] = useShortcutHover<HTMLDivElement>('timeline');

	const [ scale, setScale ] = useStorage('composer-scale', 1);
	const [ viewOffset, setViewOffset ] = useStorage('composer-offset', 0);
	const { range } = useSharedSettings();
	const { fps } = usePreviewSettings();
	const { player } = useApplication();
  const time = usePlayerTime();
  const clips = useClips();
	const { tracks, targetTrack } = useTracks();
	const duration = useDuration();

	const wrapperRef = useRef<HTMLDivElement>();
	const rect = useSize(wrapperRef);
	const rangeRef = useRef<HTMLDivElement>();
	const setScrubFrame = useRef<(frame: number, pixels?: number) => void>();

	const [ tool, setTool ] = useStoredState<EditorTool>('shift', 'editor-tool');
	const [ mode, setMode ] = useStoredState<EditorMode>('compose', 'editor-mode');
	const [ snap, setSnap ] = useStoredState<boolean>(true, 'editor-snap');

	const modifiedClips = useStore<Clip[][]>(() => clips().map(arr => [ ...arr ]));
	useLayoutEffect(() => void modifiedClips(clips().map(arr => [ ...arr ])), [ clips ]);

	const warnedAboutRange = useRef(false);
	const seeking = useSignal<number | null>(null);

	/** Loaded the scene information. */
	const isReady = duration > 0;

	/** Set the initial scroll position once everything loads. */
  useLayoutEffect(() => void(wrapperRef.current.scrollLeft = viewOffset), [ rect.width > 0 && isReady ]);

	const sizes = useMemo(() => ({
		viewLength: rect.width,
		fullLength: rect.width * scale + rect.width,
		visibleLength: rect.width * scale,
  }), [rect.width, scale]);

  const zoomMax = (MAX_FRAME_SIZE / sizes.viewLength) * duration;

  const conversion = useMemo(() => ({
		framesToPixels: (value: number) => (value / duration) * sizes.visibleLength,
		framesToPercents: (value: number) => (value / duration) * 100,
		pixelsToFrames: (value: number) => (value / sizes.visibleLength) * duration,
	}), [ duration, sizes ]);

  const ctx = useMemo<TimelineContextData>(() => {
    const density = Math.pow(2, Math.round(Math.log2(duration / sizes.visibleLength)));
    const firstFrame = conversion.pixelsToFrames(viewOffset);
    const lastFrame = conversion.pixelsToFrames(viewOffset + sizes.viewLength);

    return {
			viewOffset,
			firstFrame, lastFrame,
			density,
			...sizes,
			...conversion,
      pointerToFrames: (value: number) => conversion.pixelsToFrames(value - rect.x + viewOffset),
			tool, setTool,
			mode, setMode,
			snap, setSnap
    };
  }, [ sizes, conversion, viewOffset, duration, tool, mode, snap, rect.x ]);

	useStateChange(([ prevDuration, prevWidth ]) => {
      const newDuration = duration / fps;
      let newScale = scale;


			if (prevDuration !== 0 && newDuration !== 0) newScale *= newDuration / prevDuration;
			if (prevWidth !== 0 && rect.width !== 0) newScale *= prevWidth / rect.width;
			if (!isNaN(newScale) && duration > 0) setScale(clamp(ZOOM_MIN, zoomMax, newScale));
    },
    [ duration / fps, rect.width ],
  );

	const timestampDensity = Math.max(1, Math.floor(TIMESTAMP_SPACING * ctx.density));
	const timestampFirstFrame = Math.floor(conversion.pixelsToFrames(
		viewOffset) / timestampDensity) * timestampDensity;
	const timestampLastFrame = Math.ceil(conversion.pixelsToFrames(
		viewOffset + sizes.viewLength + TIMESTAMP_SPACING) / timestampDensity) * timestampDensity;

	/** Shortcuts. */

	const releaseTool = useRef<EditorTool>(tool);

	useShortcut(Shortcut.RazorTool, {
		press: () => setTool(tool => (releaseTool.current = tool, 'cut')),
		holdRelease: () => setTool(releaseTool.current),
		holdTimeout: 300
	}, []);

	useShortcut(Shortcut.ShiftTool, {
		press: () => setTool(tool => (releaseTool.current = tool, 'shift')),
		holdRelease: () => setTool(releaseTool.current),
		holdTimeout: 300
	}, []);

	useShortcut(Shortcut.SelectTool, {
		press: () => setTool(tool => (releaseTool.current = tool, 'select')),
		holdRelease: () => setTool(releaseTool.current),
		holdTimeout: 300
	}, []);

	useShortcut(Shortcut.ToggleSnapping, {
		press: () => setSnap(s => !s),
		holdRelease: () => setSnap(s => !s),
		holdTimeout: 300
	}, []);

	useShortcut(Shortcut.SwapTimelineMode, {
		press: () => setMode(mode => mode === 'compose' ? 'clip' : 'compose'),
		holdRelease: () => setMode(mode => mode === 'compose' ? 'clip' : 'compose'),
		holdTimeout: 300
	}, []);

	useShortcut(Shortcut.HoldTimelineMode, {
		press: () => setMode(mode => mode === 'compose' ? 'clip' : 'compose'),
		release: () => setMode(mode => mode === 'compose' ? 'clip' : 'compose'),
		holdTimeout: 300
	}, []);

	useLayoutEffect(() => {
    wrapperRef.current.scrollLeft = viewOffset;
  }, [scale]);

	/** Updates the offset for horizontal scrolling. */
	const handleScroll = (evt: UIEvent) => {
		setViewOffset((evt.target as HTMLElement).scrollLeft);
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

		let pointer = viewOffset + evt.x - rect.x;
		if (evt.x - rect.x < ZOOM_START_THRESHOLD) pointer = viewOffset;

		const newTrackSize = rect.width * newScale * +rect.width;
		const maxOffset = newTrackSize - rect.width;
		const newOffset = clamp(0, maxOffset, viewOffset - pointer + pointer * ratio);

		wrapperRef.current.scrollLeft = newOffset;
		if (!isNaN(newScale)) setScale(newScale);
		if (!isNaN(newOffset)) setViewOffset(newOffset);
	};

	function scrub(pos: number) {
    const frame = Math.round(ctx.pointerToFrames(pos));
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
			scrub(evt.x);
		}
		else if (evt.button === MouseButton.Middle) {
			evt.preventDefault();
			(evt.currentTarget as any).setPointerCapture(evt.pointerId);
		}
	}

	function handleScrubMove(evt: PointerEvent) {
		if (!(evt.currentTarget as any).hasPointerCapture(evt.pointerId)) return;
		if (evt.buttons & MouseMask.Primary) {
			scrub(evt.x);
		}
		else if (evt.buttons & MouseMask.Auxiliary) {
			const newOffset = clamp(
				0,
				sizes.visibleLength,
				viewOffset - evt.movementX,
			);
			setViewOffset(newOffset);
			wrapperRef.current.scrollLeft = newOffset;
		}
	}

	function handleScrubEnd(evt: PointerEvent) {
		if (evt.button === MouseButton.Left || evt.button === MouseButton.Middle) {
			seeking.value = null;
			warnedAboutRange.current = false;
			(evt.currentTarget as any).releasePointerCapture(evt.pointerId);
		}
	}

	function recomputeFromCache(clip: Clip) {
		clip.length = player.status.framesToSeconds(clip.cache.lengthFrames);
		clip.offset = player.status.framesToSeconds(clip.cache.clipRange[0]);
		clip.start = player.status.framesToSeconds(clip.cache.startFrames);
	}

	function fixOverlap(channel: Clip[], newClip: Clip, oldClip: Clip) {
		let toDelete = [];

		if (mode === 'clip') {
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

	function handleClipResizeStart(clip: Clip, side: 'left' | 'right', offset: number) {
		const newClips = clips().map(arr => [ ...arr ]);
		const newClipInd = newClips[clip.cache.channel].findIndex(c => c.uuid === clip.uuid);
		if (newClipInd === -1) return;
		const oldClip = newClips[clip.cache.channel][newClipInd];
		const newClip = newClips[clip.cache.channel][newClipInd] = copyClip(oldClip);

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
		fixOverlap(newClips[clip.cache.channel], newClip, oldClip);
		modifiedClips(newClips);
	}

	function handleClipResizeMove(clip: Clip, offset: number) {
		const newClips = clips().map(arr => [ ...arr ]);
		const newClipInd = newClips[clip.cache.channel].findIndex(c => c.uuid === clip.uuid);
		if (newClipInd === -1) return;
		const oldClip = newClips[clip.cache.channel][newClipInd];
		const newClip = newClips[clip.cache.channel][newClipInd] = copyClip(oldClip);

		let newPos = Math.max(newClip.cache.clipRange[0] + offset);

		if (snap) {
			const snapRight = newClips[clip.cache.channel].find(c =>
				Math.abs(c.cache.clipRange[0] - (newPos + newClip.cache.lengthFrames)) <= NUM_SNAP_FRAMES);
			if (snapRight) newPos = snapRight.cache.clipRange[0] - newClip.cache.lengthFrames;
			else {
				const snapLeft = newClips[clip.cache.channel].find(c =>
					Math.abs(c.cache.clipRange[1] - newPos) <= NUM_SNAP_FRAMES);
				if (snapLeft) newPos = snapLeft.cache.clipRange[1];
			}
		}

		newPos = Math.max(newPos, 0);

		newClip.cache.clipRange[0] = newPos;
		newClip.cache.clipRange[1] = newPos + newClip.cache.lengthFrames;

		recomputeFromCache(newClip);
		fixOverlap(newClips[clip.cache.channel], newClip, oldClip);
		modifiedClips(newClips);
	}

	function handleDragClip(clip: Clip, side: 'left' | 'right' | 'replace') {
		console.log(clip, side);
	}

	function handleClipCommit() {
		clips(modifiedClips());
	}

	function handleSetTrackSolo(channel: number, solo: boolean) {
		const newTracks = [ ...tracks() ];
		newTracks[channel] = { ...newTracks[channel], solo };
		tracks(newTracks);
	}

	function handleSetTrackMuted(channel: number, muted: boolean) {
		const newTracks = [ ...tracks() ];
		newTracks[channel] = { ...newTracks[channel], muted };
		tracks(newTracks);
	}

	function handleSetTrackLocked(channel: number, locked: boolean) {
		const newTracks = [ ...tracks() ];
		newTracks[channel] = { ...newTracks[channel], locked };
		tracks(newTracks);
	}

	function handleSetTargetTrack(channel: number) {
		targetTrack(channel);
	}

	return (
		<TimelineContext.Provider value={ctx}>
			<div class={styles.timeline}>
				<Toolbar/>

				<div class={styles.timeline_labels}>
					{(tracks().map((track, i) => <TimelineTrackLabel
						channel={i}
						solo={track.solo}
						locked={track.locked}
						muted={track.muted}
						target={targetTrack() === i}
						setSolo={(solo: boolean) => handleSetTrackSolo(i, solo)}
						setLocked={(locked: boolean) => handleSetTrackLocked(i, locked)}
						setMuted={(muted: boolean) => handleSetTrackMuted(i, muted)}
						setAsTarget={() => handleSetTargetTrack(i)}
					/>))}
				</div>
				<div
					ref={wrapperRef}
					class={clsx(styles.timeline_wrapper, (seeking.value != null) && styles.scrubbing)}
					onScroll={handleScroll}
					onWheel={handleWheel}
					onPointerDown={handleScrubStart}
					onPointerMove={handleScrubMove}
					onPointerUp={handleScrubEnd}
				>
					<div
						class={styles.timeline}
						style={{ width: `${sizes.fullLength}px` }}
						ref={shortcutRef}
					>
						<div
							class={styles.timeline_content}
							style={{ width: `${conversion.framesToPixels(duration)}px` }}
						>
							<RangeSelector rangeRef={rangeRef}/>
							<Timestamps firstFrame={timestampFirstFrame} lastFrame={timestampLastFrame} density={timestampDensity}/>
							<Playhead seeking={seeking}/>

							<TimelineTrack
								type='video'
								clips={modifiedClips()[0] ?? []}
								onClipCommit={handleClipCommit}
								onClipResizeMove={handleClipResizeMove}
								onClipResizeStart={handleClipResizeStart}
								onClipDrag={handleDragClip}
							/>

							{(modifiedClips().slice(1).map(track => <TimelineTrack
								type='audio'
								clips={track}
								onClipCommit={handleClipCommit}
								onClipResizeMove={handleClipResizeMove}
								onClipResizeStart={handleClipResizeStart}
								onClipDrag={handleDragClip}
							/>))}

							<ScrubPreview show={seeking.value == null} wrapper={wrapperRef} setFrame={setScrubFrame}/>
						</div>
					</div>
				</div>
			</div>
		</TimelineContext.Provider>
	)
}
