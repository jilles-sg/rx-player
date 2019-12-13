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
import RxPlayer from "rx-player";

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
The loader find the period for the given time. In this period, it chooses
the first video adaptation. If a trick mode track is present on it, choose it.
Otherwise, select the first representation.

#### Return value

The return value is a Promise.
It :
- ``resolve`` when the thumbnail for given time has been loaded.
- ``reject`` in case of error : return an error.

The promise does not only rejects when setting thumbnail has failed. There are
some cases where the thumbnail loader decides not to load. Here is a list of
every failure code (``error.code``) :
- NO_TRACK : In the manifest you've given, there are either no period or no
             representation to get video chunks.
- NO_INIT_DATA : The chosen track does not have an init data, so it can't be
                 buffered.
- NO_THUMBNAILS : No segments are available for this time of the track.
- ALREADY_LOADING : The thumbnail loader is already loading this thumbnail.
- NOT_BUFFERED : After the thumbnail has been loaded, no buffered data is in
                 the video element. It can be due to too short video chunks.
- LOADING_ERROR : An error occured when loading thumbnail into video element.
- ABORTED : The loading has been aborted (probably because of another job
            started)

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

