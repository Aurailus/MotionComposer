/* @jsxImportSource preact */

import clsx from 'clsx';
import { RefObject} from 'preact';
import { useContext, useRef } from 'preact/hooks';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { useApplication, useDuration, useKeyHold,
	labelClipDraggingLeftSignal, MouseButton, DragIndicator, usePreviewSettings, useCurrentFrame } from '@motion-canvas/ui';

import styles from './Timeline.module.scss';

import { PluginContext } from '../Context';
import { TimelineContext } from './TimelineContext';

export interface RangeSelectorProps {
  rangeRef: RefObject<HTMLDivElement>;
}

export function RangeSelector({rangeRef}: RangeSelectorProps) {
  const { pixelsToFrames, framesToPixels, pointerToFrames } = useContext(TimelineContext);
  const { player, meta } = useApplication();
  const { range, userRange } = useContext(PluginContext);

  const startFrame = player.status.secondsToFrames(userRange.value[0]);
  const endFrame = player.status.secondsToFrames(userRange.value[1]);

	const [ start, setStart ] = useState(startFrame);
  const [ end, setEnd ] = useState(endFrame);

  useEffect(() => {
    setStart(startFrame);
    setEnd(endFrame);
  }, [ startFrame, endFrame ]);

	const definingRangeState = useRef<false | 'on_move' | true>(null);

	function handleResetRange() {
		definingRangeState.current = false;
		userRange.value = [ 0, range.value[1] ];
	}

	function handleStartDefineRange(evt: PointerEvent) {
		definingRangeState.current = 'on_move';
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
		const normalizedStart =
			Math.max(player.status.framesToSeconds(Math.ceil(Math.max(Math.min(start, end), 0))), range.value[0]);
		const normalizedEnd =
			Math.min(player.status.framesToSeconds(Math.ceil(Math.min(Math.max(start, end))) + (end < start ? 1 : 0)), range.value[1]);
		userRange.value = [ normalizedStart, normalizedEnd ];
  }, [ start, end, userRange ]);


  let normalizedStart = Math.ceil(Math.max(Math.min(start, end), player.status.secondsToFrames(range.value[0])));
  let normalizedEnd = Math.ceil(Math.min(Math.max(start, end), player.status.secondsToFrames(range.value[1]))) + (end < start ? 1 : 0);

  return (
    <div
      className={styles.range_track}
      onPointerDown={handleStartDefineRange}
      onPointerMove={handleMoveDefineRange}
      onPointerUp={handleStopDefineRange}
			onDblClick={handleResetRange}
    >
      <div
        ref={rangeRef}
        style={{
          flexDirection: start > end ? 'row-reverse' : 'row',
          left: `${framesToPixels(normalizedStart)}px`,
          width: `${framesToPixels(normalizedEnd - normalizedStart)}px`
        }}
        className={styles.range}
        onPointerDown={handleStartShiftRange}
        onPointerMove={handleMoveShiftRange}
        onPointerUp={handleEndShiftRange}
        onDblClick={handleResetRange}
      >
        <RangeHandle value={start} setValue={setStart} onDrop={handleCommitRange} />
        <div class={styles.handleSpacer} />
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
  const { pixelsToFrames } = useContext(TimelineContext);
  const { player } = useApplication();

  return (
    <DragIndicator
      className={styles.handle}
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
