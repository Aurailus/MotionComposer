# Motion Composer

A (heavily WIP) plugin to add more video editing features to [Motion Canvas](https://motioncanvas.io/), including a nonlinear track editor, adding non-scene clips, coordinating multiple audio tracks, and more.

## Roadmap

- [] Scan '/clips' folder for videos, images, and audio, and add them to the Clips and Media tab.
  - [] Write a Vite plugin for loading them. It should expose metadata for their lengths, maybe a thumbnail as well, and then allow the file to be publicly accessible over the network.
- [] Allow dragging clips into the track list.
- [] Allow cropping clips in in the editor.
- [] Allow scenes to invoke audio tracks, display waveform embedded in scene.
- [] Allow modifying audio clip volume.
- [] Override playback to play in order.
- [] Dummy scenes to display video and images.
- [] FFMPEG exporter.

## Stretch Goals

- [] More advanced editor tools: scissor tool, etc.
- [] Video stabilization and color grading.
- [] Mute / Solo audio tracks.
- [] Color clips in the timeline.

## Project Structure

This is currently just a Motion Canvas project, so that development is easier. `scenes/`, `clips`, and `public` are for testing data, and shouldn't contain anything important. The actual plugin code is in `src/plugin`. The client plugin (which is the only one so far) is in `src/plugin/client`. The Vite plugin will be in `src/plugin/vite`.

## Contributing

Contributions are welcome! Just take care to follow the code style and conventions of the project. If you're unsure, feel free to ask in an issue or pull request. We want this project to be as fully-featured as possible, so any help is appreciated.
