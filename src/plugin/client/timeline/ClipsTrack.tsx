/* @jsxImportSource preact */

import { findAndOpenFirstUserFile, useApplication, usePreviewSettings, useScenes, useSubscribableValue, useTimelineContext } from '@motion-canvas/ui';
import styles from './Timeline.module.scss';
import { Scene } from '@motion-canvas/core';
import { useMemo, useContext } from 'preact/hooks';
import { TimelineContext } from './TimelineContext';
import { PluginContext } from '../Context';
import EventLabel from './EventLabel';
import { MissingClip, SceneClip } from './Clip';

export default function SceneTrack() {
  const scenes = useScenes();
  const ctx = useContext(PluginContext);
  const { framesToPixels } = useContext(TimelineContext);
  const { player } = useApplication();
  const clips = ctx.clips();

  return (
    <div className={styles.clips_track}
    style={{ width: framesToPixels(player.status.secondsToFrames(ctx.range.value[1])) }}>
      {(clips[0] ?? []).map(clip => {
        const range = ctx.getClipFrameRange(clip);

        switch (clip.type) {
          case 'scene': {
            const scene = scenes.find(s => s.name === clip.path);
            if (!scene) break;
            return <SceneClip clip={clip} scene={scene} range={range} />;
          }
          default: {
            break;
          }
        }
        return <MissingClip clip={clip} range={range}/>;
      })}
    </div>
  );
}
