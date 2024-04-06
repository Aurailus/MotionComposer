/* @jsxImportSource preact */

import { Button } from '@motion-canvas/ui';

import styles from './Timeline.module.scss';

import * as Icon from '../icon';
import { useTimeline } from '../Contexts';

export default function Toolbar() {
	const ctx = useTimeline();

	return (
		<div class={styles.toolbar}>
			<div class={styles.button_group}>
				<Button main={ctx.mode === 'compose'} onClick={() => ctx.setMode('compose')}
					title='Composition Mode'><Icon.Composition/></Button>
				<Button main={ctx.mode === 'clip'} onClick={() => ctx.setMode('clip')}
					title='Clipper Mode'><Icon.Clipper/></Button>
			</div>

			<div class={styles.button_group}>
				<Button main={ctx.snap} onClick={() => ctx.setSnap(!ctx.snap)}
					title='Snap to Clip Edges'><Icon.Magnet/></Button>
			</div>

			<div class={styles.button_group}>
				<Button main={ctx.tool === 'shift'} onClick={() => ctx.setTool('shift')}
					title='Shift Tool'><Icon.Hand/></Button>
				<Button main={ctx.tool === 'cut'} onClick={() => ctx.setTool('cut')}
					title='Cutter Tool'><Icon.Scissor/></Button>
				<Button main={ctx.tool === 'select'} onClick={() => ctx.setTool('select')}
					title='Select Tool'><Icon.Select/></Button>
			</div>
		</div>
	)
}
