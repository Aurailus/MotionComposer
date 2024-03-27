/* @jsxImportSource preact */

// import styles from './Timeline.module.scss';

// import { useClips } from '../Contexts';
// import { AudioClip, MissingClip } from './clip/Clip';

// export default function AudioTrack() {
//   const clips = useClips();

//   return (
//     <div className={styles.audio_track}>
//       {(clips()[1] ?? []).map(clip => {
//         switch (clip.type) {
//           case 'audio': {
//             return <AudioClip clip={clip} range={[ 0, 2000 ]} />;
//           }
//           default: {
//             break;
//           }
//         }
//         return <MissingClip clip={clip}/>;
//       })}
//     </div>
//   );
// }
