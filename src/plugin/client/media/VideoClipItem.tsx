/* @jsxImportSource preact */

import styles from './Media.module.scss';

import * as Icon from '../icon';
import ClipItem, { ClipItemChildProps } from './ClipItem';

export default function VideoClipItem(props: ClipItemChildProps) {
	return (
		<ClipItem
			{...props}
			class={styles.video}
			name={props.source.name}
			duration={props.source.duration}
			icon={Icon.Video}
			thumbnail={props.source.thumbnail}
		/>
	);
}
