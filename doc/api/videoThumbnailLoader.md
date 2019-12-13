# VideoThumbnailLoader #########################################################


## Overview ####################################################################

The VideoThumbnailLoader is a tool that can help using a video track
(Representation) as a substitue of a manifest embedded thumbnail track.

The goal is to make a thumbnail out of HTML5 video element, by :
- Managing the loading / appending of resources from a given track
(video segments).
- Exploiting the Media Source Extension API to make it invisible to user.

## How to use it ###############################################################


As an experimental tool, the VideoThumbnailLoader won't be included in a
default RxPlayer build.

Instead, it should be imported by adding the RxPlayer through a dependency
trough the npm registry (e.g. by doing something like ``npm install
rx-player``) and then specifically importing this tool from
``"rx-player/experimental/tools"``:

```js
import { VideoThumbnailLoader } from "rx-player/experimental/tools";

const currentAdaptations = player.currentAdaptations();
if (
  currentAdaptations.video &&
  currentAdaptations.video.trickModeTrack &&
  currentAdaptations.video.trickModeTrack.representations[0]
) {
  const track = currentAdaptations.video.trickModeTrack.representations[0];
  const videoElement = document.createElement("video");
  const videoThumbnailLoader = new VideoThumbnailLoader(
    videoElement,
    track
  );
}

  const player = new RxPlayer({ /* some options */ });
  player.loadVideo({ /* some other options */ });
  const videoElement = document.createElement("video");
  const manifest = player.getManifest();
  const videoThumbnailLoader = new VideoThumbnailLoader(
    videoElement,
    manifest
  );
```


## Constructor #################################################################


## Functions ###################################################################


### setTime ####################################################################

_arguments_:

  - _time_ (``number``): Time for which we want to display a thumbnail.

_return value_: ``Promise``

From a given time, load video segments, and append to video element.

#### Return value

The return value is a Promise.
It :
- ``resolve`` when the thumbnail for given time has been loaded.
- ``reject`` in case of error.

#### Example

```js
  videoThumbnailLoader.setTime(3000, track)
    .then(() => {
      console.log("Success :)");
    })
    .catch((err) => {
      console.log("Failure :(", err);
    })
```

### dispose ###################################################################

Dispose the tool resources.

#### Example

```js
  onComponentUnmount() {
    videoThumbnailLoader.dispose();
  }
```

