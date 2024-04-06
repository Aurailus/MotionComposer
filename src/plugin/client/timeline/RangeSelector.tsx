/* @jsxImportSource preact */

import { RefObject} from 'preact';
import { useRef } from 'preact/hooks';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { useApplication, useDuration, labelClipDraggingLeftSignal,
  MouseButton, DragIndicator, usePreviewSettings, useSharedSettings, clamp } from '@motion-canvas/ui';

import styles from './Timeline.module.scss';

import { useClips } from '../Hooks';
import { useTimeline } from '../Contexts';

export interface RangeSelectorProps {
  rangeRef: RefObject<HTMLDivElement>;
}

export function RangeSelector({rangeRef}: RangeSelectorProps) {
  const { pixelsToFrames, framesToPixels, pointerToFrames } = useTimeline();
  const { player, meta } = useApplication();
  const { range } = useSharedSettings();
  const duration = useDuration();
  const { fps } = usePreviewSettings();
  const clips = useClips();

  const startFrame = player.status.secondsToFrames(range[0]);
  const endFrame = Math.min(player.status.secondsToFrames(range[1]), duration);

	const [ start, setStart ] = useState(startFrame);
  const [ end, setEnd ] = useState(endFrame);


  useEffect(() => {
    setStart(startFrame);
    setEnd(endFrame);
  }, [ startFrame, endFrame ]);

	const definingRangeState = useRef<false | 'on_move' | true>(null);

	function handleResetOrClampRange(evt: MouseEvent) {
		definingRangeState.current = false;
    evt.preventDefault();
    evt.stopPropagation();

    if (startFrame !== 0 || endFrame !== duration) {
      meta.shared.range.update(0, duration, duration, fps);
    }
    else {
      const playheadSeconds = player.status.framesToSeconds(pointerToFrames(evt.clientX));
      const clip = (clips[0] ?? []).find(c => c.offset <= playheadSeconds && c.offset + c.length >= playheadSeconds);
      if (!clip) return;
      meta.shared.range.update(clip.cache.clipRange[0], clip.cache.clipRange[1], duration, fps);
    }
	}

	function handleStartDefineRange(evt: PointerEvent) {
		definingRangeState.current = 'on_move';
    evt.preventDefault();
    evt.stopPropagation();
	}

	function handleMoveDefineRange(evt: PointerEvent) {
		if (definingRangeState.current === 'on_move') {
			(evt.currentTarget as any).setPointerCapture(evt.pointerId);
			definingRangeState.current = true;
			setStart(Math.floor(pointerToFrames(evt.clientX - evt.movementX)));
			setEnd(Math.floor(pointerToFrames(evt.clientX - evt.movementX)));
		}
		if (!(evt.currentTarget as any).hasPointerCapture(evt.pointerId)) return;
		setEnd(end => end + pixelsToFrames(evt.movementX));
	}

	function handleStopDefineRange(evt: PointerEvent) {
		if (evt.button !== MouseButton.Left) return;
		definingRangeState.current = false;
		(evt.currentTarget as any).releasePointerCapture(evt.pointerId);
		handleCommitRange();
	}

	function handleStartShiftRange(evt: PointerEvent) {
		if (evt.button !== MouseButton.Left) return;
		evt.preventDefault();
		evt.stopPropagation();
		(evt.currentTarget as any).setPointerCapture(evt.pointerId);
	}

	function handleMoveShiftRange(evt: PointerEvent) {
		if (!(evt.currentTarget as any).hasPointerCapture(evt.pointerId)) return;
		setStart(start + pixelsToFrames(evt.movementX));
		setEnd(end + pixelsToFrames(evt.movementX));
	}

	function handleEndShiftRange(evt: PointerEvent) {
		if (!(evt.currentTarget as any).hasPointerCapture(evt.pointerId)) return;
		if (evt.button !== MouseButton.Left) return;
		(evt.currentTarget as any).releasePointerCapture(evt.pointerId);
		handleCommitRange();
	}

  const handleCommitRange = useCallback(() => {
    labelClipDraggingLeftSignal.value = null;

		const normalizedStart = clamp(
      0, duration, Math.ceil(Math.min(start, end)));
    const normalizedEnd = clamp(
      0, duration, Math.ceil(Math.max(start, end)) + (end < start ? 1 : 0));

    meta.shared.range.update(normalizedStart, normalizedEnd, duration, fps);
  }, [ start, end, duration, fps ]);

  let normalizedStart = Math.ceil(Math.max(Math.min(start, end), 0));
  let normalizedEnd = Math.ceil(Math.min(Math.max(start, end), duration)) + (end < start ? 1 : 0);

  return (
    <div
      class={styles.range_track}
      onPointerDown={handleStartDefineRange}
      onPointerMove={handleMoveDefineRange}
      onPointerUp={handleStopDefineRange}
			onDblClick={handleResetOrClampRange}
    >
      <div
        ref={rangeRef}
        style={{
          flexDirection: start > end ? 'row-reverse' : 'row',
          left: `${framesToPixels(normalizedStart)}px`,
          width: `${framesToPixels(normalizedEnd - normalizedStart)}px`
        }}
        class={styles.range}
        onPointerDown={handleStartShiftRange}
        onPointerMove={handleMoveShiftRange}
        onPointerUp={handleEndShiftRange}
        onDblClick={handleResetOrClampRange}
      >
        <RangeHandle value={start} setValue={setStart} onDrop={handleCommitRange} />
        <div class={styles.spacer} />
        <RangeHandle value={end} setValue={setEnd} onDrop={handleCommitRange} />
      </div>
    </div>
  );
}

interface RangeHandleProps {
  value: number;
  setValue: (value: number) => void;
  onDrop: (event: PointerEvent) => void;
}

function RangeHandle({value, setValue, onDrop}: RangeHandleProps) {
  const { pixelsToFrames } = useTimeline();
  const { player } = useApplication();

  return (
    <DragIndicator
      class={styles.handle}
      onPointerDown={event => {
        if (event.button === MouseButton.Left) {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          labelClipDraggingLeftSignal.value =
            player.status.framesToSeconds(value);
        }
      }}
      onPointerMove={event => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.stopPropagation();
          const newValue = value + pixelsToFrames(event.movementX);
          setValue(newValue);
          labelClipDraggingLeftSignal.value =
            player.status.framesToSeconds(newValue);
        }
      }}
      onPointerUp={event => {
        if (event.button === MouseButton.Left) {
          event.stopPropagation();
          event.currentTarget.releasePointerCapture(event.pointerId);
          onDrop(event);
        }
      }}
    />
  );
}
