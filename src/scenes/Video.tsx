import { Video, makeScene2D} from '@motion-canvas/2d';
import { waitFor } from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  view.fill('#111111');

  view.add(<Video size='100%' src='/media/cobalt.mkv' play />);

  yield* waitFor(5);
});
