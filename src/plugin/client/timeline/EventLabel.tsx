/* @jsxImportSource preact */

import styles from './Timeline.module.scss';

import { type Scene } from '@motion-canvas/core';
import { useLayoutEffect, useState, useContext } from 'preact/hooks';
import type { TimeEvent } from '@motion-canvas/core/lib/scenes/timeEvents';
import { TimelineContext } from './TimelineContext';
import { findAndOpenFirstUserFile, labelClipDraggingLeftSignal, useApplication } from '@motion-canvas/ui';
import { SerializedClip } from '../Types';
import { PluginContext } from '../Context';

interface EventLabelProps {
  event: TimeEvent;
  scene: Scene;
  clip: SerializedClip;
  offset?: number;
}

export default function EventLabel({ event, scene, clip, offset = 0 }: EventLabelProps) {
  const { player } = useApplication();
  const { playheadPos, getClipFrameRange } = useContext(PluginContext);
  const { framesToPixels, pixelsToFrames } = useContext(TimelineContext);

  const startFrame = clip.range[0];

  // How long the event waits for before firing.
  const [ eventTime, setEventTime ] = useState(event.offset);
  useLayoutEffect(() => setEventTime(event.offset), [event.offset]);

  // If the mouse is down on this element, whether or not the event has been moved yet.
  const [ moved, setMoved ] = useState(false);

  async function handleGoToSource() {
    if (!event.stack) return;
    await findAndOpenFirstUserFile(event.stack);
  }

  function handleSeek() {
    playheadPos(getClipFrameRange(clip)[0] + player.status.secondsToFrames(event.initialTime + event.offset));
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
      if (event.offset !== newFrame) scene.timeEvents.set(event.name, newFrame, e.shiftKey);
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
        style={{ left: `${framesToPixels(scene.playback.secondsToFrames(
          event.initialTime + Math.max(0, eventTime)) - offset)}px` }}

        onDblClick={handleGoToSource}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      <div
        className={styles.label_backdrop}
        style={{
          left: `${framesToPixels(scene.playback.secondsToFrames(event.initialTime) - startFrame - offset)}px`,
          width: `${Math.max(0, framesToPixels(scene.playback.secondsToFrames(eventTime)))}px`,
        }}
      />
    </>
  );
}
