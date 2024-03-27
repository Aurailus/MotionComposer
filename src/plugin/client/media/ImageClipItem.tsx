/* @jsxImportSource preact */

import styles from './Media.module.scss';

import * as Icon from '../icon';
import ClipItem, { ClipItemChildProps } from './ClipItem';

export default function ImageClipItem(props: ClipItemChildProps) {
	return (
		<ClipItem
			{...props}
			class={styles.image}
			name={props.source.name}
			duration={props.source.duration}
			icon={Icon.Image}
			thumbnail={props.source.thumbnail}
		/>
	);
}
