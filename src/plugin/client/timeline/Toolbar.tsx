/* @jsxImportSource preact */

import { Button } from '@motion-canvas/ui';

import styles from './Timeline.module.scss';

import * as Icon from '../icon';

export default function Toolbar() {
	return (
		<div class={styles.toolbar}>
			<div class={styles.button_group}>
				<Button main title='Composition Mode'><Icon.Composition/></Button>
				<Button title='Clipper Mode'><Icon.Clipper/></Button>
			</div>

			<div class={styles.button_group}>
				<Button title='Shift Tool'><Icon.Hand/></Button>
				<Button main title='Cutter Tool'><Icon.Scissor/></Button>
				<Button title='Select Tool'><Icon.Select/></Button>
			</div>
		</div>
	)
}
