import MotionComposer from './MotionComposer';

const composer = new MotionComposer();
export default composer.makePlugin();

export { useClips, useCurrentClip } from './Contexts';
export { useStore, useLazyRef, useUUID, getUUID } from './Hooks';
export type { Clip, ClipInfo, ClipSource, ClipType } from './Types';
