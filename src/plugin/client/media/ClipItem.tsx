/* @jsxImportSource preact */

import clsx from 'clsx';
import { FunctionComponent, VNode } from 'preact';
import { formatDuration } from '@motion-canvas/ui';

import styles from './Media.module.scss';

import { ClipSource } from '../Types';

export interface ClipItemChildProps {
	source: ClipSource;

	onDragStart: () => void;
	onDragEnd: () => void;
	onDragMove: () => void;
}

export interface ClipItemProps extends ClipItemChildProps {
	class: string;

	name: string;
	duration: number;
	icon: FunctionComponent<{ class: string }>;
	thumbnail: string | VNode;
}

export default function ClipItem(props: ClipItemProps) {
	const Icon = props.icon;

	function handleDragStart(evt: PointerEvent) {
		evt.preventDefault();
		evt.stopPropagation();
		(evt.currentTarget as any).setPointerCapture(evt.pointerId);

		props.onDragStart();
	}

	function handleDragMove(evt: PointerEvent) {
		if (!(evt.currentTarget as any).hasPointerCapture(evt.pointerId)) return;
		evt.preventDefault();
		evt.stopPropagation();

		props.onDragMove();
	}

	function handleDragEnd(evt: PointerEvent) {
		if (!(evt.currentTarget as any).hasPointerCapture(evt.pointerId)) return;
		evt.preventDefault();
		evt.stopPropagation();

		props.onDragEnd();
	}

	return (
		<div
			class={clsx(styles.clip_item, props.class)}
			onPointerDown={handleDragStart}
			onPointerMove={handleDragMove}
			onPointerUp={handleDragEnd}
		>
			{(typeof props.thumbnail === 'string')
				? <img class={styles.thumbnail} src={props.thumbnail}/>
				: props.thumbnail}
			<Icon class={styles.icon}/>
			<p class={styles.name} title={props.name}>{props.name}</p>
			<p class={styles.duration}>{formatDuration(props.duration)}</p>
		</div>
	);
}
