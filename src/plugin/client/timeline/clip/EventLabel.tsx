/* @jsxImportSource preact */

import { useLayoutEffect, useState, useContext } from 'preact/hooks';
import type { TimeEvent } from '@motion-canvas/core/lib/scenes/timeEvents';
import { findAndOpenFirstUserFile, labelClipDraggingLeftSignal, useApplication } from '@motion-canvas/ui';

import styles from './Clip.module.scss';

import { Clip } from '../../Types';
import { TimelineContext } from '../TimelineContext';

interface Props {
  clip: Clip;
  event: TimeEvent;
}

export default function EventLabel({ clip, event }: Props) {
  const { player } = useApplication();
  const { framesToPixels, pixelsToFrames } = useContext(TimelineContext);

  // How long the event waits for before firing.
  const [ eventTime, setEventTime ] = useState(event.offset);
  useLayoutEffect(() => setEventTime(event.offset), [ event.offset ]);

  // If the mouse is down on this element, whether or not the event has been moved yet.
  const [ moved, setMoved ] = useState(false);

  async function handleGoToSource() {
    if (!event.stack) return;
    await findAndOpenFirstUserFile(event.stack);
  }

  function handleSeek() {
    player.requestSeek(clip.cache.clipRange[0] - clip.cache.startFrames + player.status.secondsToFrames(event.initialTime + event.offset));
  }

  async function handlePointerDown(e: PointerEvent) {
    e.preventDefault();

    // Left click to drag.
    if (e.button === 0) {
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      labelClipDraggingLeftSignal.value = event.initialTime + Math.max(0, eventTime);
      setMoved(false);
    }

    // Middle click to open the source.
    else if (e.button === 1) {
      await handleGoToSource();
    }

    // Right click to seek.
    else if (e.button === 2) {
      handleSeek();
    }
  }

  function handlePointerMove(e: PointerEvent) {
    setMoved(true);
    if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;

    e.stopPropagation();
    const newTime = eventTime + player.status.framesToSeconds(pixelsToFrames(e.movementX));
    labelClipDraggingLeftSignal.value = event.initialTime + Math.max(0, newTime);
    setEventTime(newTime);
  }

  function handlePointerUp(e: PointerEvent) {
    if (e.button !== 0) return;

    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    labelClipDraggingLeftSignal.value = null;

    // If the event was moved, update the time.
    if (moved) {
      const newFrame = Math.max(0, eventTime);
      setEventTime(newFrame);
      if (event.offset !== newFrame) clip.cache.source.scene!.timeEvents.set(event.name, newFrame, e.shiftKey);
    }

    // Else, seek to it.
    else {
      handleSeek();
    }
  }

  return (
    <>
      <div
        class={styles.label}
        data-name={event.name}
        style={{ left: `${framesToPixels(player.status.secondsToFrames(
          event.initialTime - clip.start + Math.max(0, eventTime))) - 4}px` }}

        onDblClick={handleGoToSource}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      <div
        className={styles.label_backdrop}
        style={{
          left: `${framesToPixels(player.status.secondsToFrames(
            event.initialTime - clip.start)) - 4}px`,
          width: `${Math.max(0, framesToPixels(player.status.secondsToFrames(eventTime)))}px`,
        }}
      />
    </>
  );
}
