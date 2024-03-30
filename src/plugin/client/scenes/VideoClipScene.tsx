import { Video, makeScene2D} from '@motion-canvas/2d';
import { createRef, waitFor } from '@motion-canvas/core';

const STATE = {
	source: '',
	sourceDuration: 0,
	playDuration: 0
}

export function setVideo(source: string, sourceDuration: number, playDuration: number) {
	STATE.source = source;
	STATE.sourceDuration = sourceDuration;
	STATE.playDuration = playDuration;
}

export default makeScene2D(function* (view) {
	if (!STATE.source) return;

  const videoRef = createRef<Video>();
	yield view.add(<Video ref={videoRef} size='100%' src={STATE.source}/>);
	videoRef().play();
	yield* waitFor(STATE.playDuration);
	videoRef().pause();
	yield* waitFor(STATE.sourceDuration - STATE.playDuration);
});
