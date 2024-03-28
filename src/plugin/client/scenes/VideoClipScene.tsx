import { Video, makeScene2D} from '@motion-canvas/2d';
import { waitFor } from '@motion-canvas/core';

let videoSource = '';
let videoDuration = 0;

export function setVideo(src: string, duration: number) {
	videoSource = src;
	videoDuration = duration;
}

export default makeScene2D(function* (view) {
  view.add(<Video size='100%' src={videoSource} play/>);
	yield* waitFor(videoDuration);
});
