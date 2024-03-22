import {Rect, makeScene2D} from '@motion-canvas/2d';
import {createRef, waitUntil} from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  view.fill('#111111');

  const rect = createRef<Rect>();

  view.add(<Rect ref={rect} size={300} fill={'seagreen'} />);

	yield* waitUntil('start');
  yield* rect().size([ 200, 500 ], 1).to([ 500, 200 ], 1).to([ 300, 300 ], 1);
	yield* waitUntil('end');
});
