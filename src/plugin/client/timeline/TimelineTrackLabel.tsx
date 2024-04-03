/* @jsxImportSource preact */

import { Button } from '@motion-canvas/ui';

import styles from './Timeline.module.scss';

import * as Icon from '../icon';
import clsx from 'clsx';

interface Props {
	channel: number;

	muted: boolean;
	locked: boolean;
	solo: boolean;
	target: boolean;

	setMuted: (muted: boolean) => void;
	setLocked: (locked: boolean) => void;
	setSolo: (solo: boolean) => void;
	setAsTarget: () => void;
}

export default function TimelineTrackLabel(props: Props) {
	return (
		<div class={styles.timeline_track_label}>
			<p class={styles.label}>{props.channel === 0 ? 'Clips' : `Audio ${props.channel}`}</p>

			<div class={styles.buttons}>
				<Button className={clsx(styles.button, styles.mute, props.muted && styles.active)}
					onClick={() => props.setMuted(!props.muted)} title='Mute Track'><Icon.Mute/></Button>
				<Button className={clsx(styles.button, styles.solo, props.solo && styles.active)}
					onClick={() => props.setSolo(!props.solo)} title='Solo Track'><Icon.Solo/></Button>
				<Button className={clsx(styles.button, styles.lock, props.locked && styles.active)}
					onClick={() => props.setLocked(!props.locked)} title='Lock Track'><Icon.Lock/></Button>
				{props.channel !== 0 && <Button className={clsx(styles.button, styles.target, props.target && styles.active)}
					onClick={props.setAsTarget} title='Set Track as Insert Target'><Icon.Target/></Button>}
			</div>

			<div class={styles.statuses}>
				{props.muted && <Icon.Mute class={clsx(styles.status, styles.muted)}/>}
				{props.solo && <Icon.Solo class={clsx(styles.status, styles.solo)}/>}
				{props.locked && <Icon.Lock class={clsx(styles.status, styles.locked)}/>}
				{props.target && <Icon.Target class={clsx(styles.status, styles.target)}/>}
			</div>
		</div>
	);
}
