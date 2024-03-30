import { waitFor } from '@motion-canvas/core';
import { Img, makeScene2D} from '@motion-canvas/2d';

const STATE = {
	source: '',
	clipDuration: 0
}

export function setImage(source: string, clipDuration: number) {
	STATE.source = source;
	STATE.clipDuration = clipDuration;
}

export default makeScene2D(function* (view) {
	if (!STATE.source) return;
  view.add(<Img size='100%' src={STATE.source}/>);
	yield* waitFor(STATE.clipDuration);
});
