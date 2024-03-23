/* @jsxImportSource preact */

import { useContext } from 'preact/hooks';
import { useApplication } from '@motion-canvas/ui';

import styles from './Playback.module.scss';

import Progress from './Progress';
import { PluginContext } from '../Context';
import { Timestamp } from './Timestamp';

export default function Playback() {
	const { player } = useApplication();
	const { playheadPos, range } = useContext(PluginContext);
	const frac = (player.status.framesToSeconds(playheadPos()) / range.value[1]);

	return (
		<div class={styles.playback}>
			<div class={styles.time}>
				<Timestamp
					class={styles.time}
					title="Current time"
					frameTitle="Current frame"
					frame={playheadPos()}
				/>
			</div>
			<div class={styles.time}>
				<Timestamp
					reverse
					class={styles.duration}
					title="Duration"
					frameTitle="Duration in frames"
					frame={player.status.secondsToFrames(range.value[1])}
				/>
			</div>
			<Progress completion={frac}/>

		</div>
	);
}
