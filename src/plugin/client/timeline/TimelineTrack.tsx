/* @jsxImportSource preact */

import { useContext } from 'preact/hooks';
import { useApplication, useSharedSettings } from '@motion-canvas/ui';

import styles from './Timeline.module.scss';

import { Clip } from '../Types';
import { TimelineContext } from './TimelineContext';
import { ClipComponents, MissingClip } from './clip/Clip';
import { ensure } from '../Util';
import clsx from 'clsx';

interface Props {
	clips: Clip[];
	type: 'video' | 'audio';

	onClipResizeStart: (clip: Clip, side: 'left' | 'right', diff: number) => void;
	onClipResizeMove: (clip: Clip, diff: number) => void;
	onClipCommit: (clip: Clip) => void;
	onClipDrag: (clip: Clip, side: 'left' | 'right' | 'replace') => void;
}

export default function TimelineTrack({ clips, type, ...props }: Props) {
	const { player } = useApplication();
	const ctx = useContext(TimelineContext);
	const { range } = useSharedSettings();

	return (
		<div className={clsx(styles.timeline_track, type === 'video' ? styles.clips_track : styles.audio_track)}
			style={{ width: ctx.framesToPixels(player.status.secondsToFrames(range[1])) }}>
			{clips.map(clip => {
				ensure((clip.type === 'audio' && type === 'audio') || (clip.type !== 'audio' && type !== 'audio'),
					'Invalid clip type in timeline track!');

				const Component = ClipComponents[clip.type];
				const clipProps = {
					key: clip.uuid,
					clip: clip,

					onResize: (side: 'left' | 'right', diff: number) => props.onClipResizeStart(clip, side, diff),
					onMove: (diff: number) => props.onClipResizeMove(clip, diff),
					onCommit: () => props.onClipCommit(clip),
					onDragClip: (side: 'left' | 'right') => props.onClipDrag(clip, side)
				}

				if (!clip.cache.source || !Component) return <MissingClip {...clipProps}/>
				return <Component {...clipProps}/>
			})}
		</div>
	)
}
