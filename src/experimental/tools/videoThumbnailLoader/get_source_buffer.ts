/**
 * Copyright 2015 CANAL+ Group
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Observable,
  of as observableOf,
} from "rxjs";
import {
  catchError,
  mapTo,
  mergeMap,
  shareReplay
} from "rxjs/operators";
import LightVideoQueuedSourceBuffer from "./light_video_queued_source_buffer";
import prepareSourceBuffer from "./media_source";
import { getInitSegment } from "./segment_utils";
import { IThumbnailTrack } from "./thumbnail_track_utils";

let _currentVideoSourceBuffer: LightVideoQueuedSourceBuffer|undefined;
let _currentThumbnailTrack: IThumbnailTrack|undefined;

type IGetSourceBufferEvent =  { type: "reuse-source-buffer";
                                value: LightVideoQueuedSourceBuffer; } |
                              { type: "created-source-buffer";
                                value: LightVideoQueuedSourceBuffer; };

/**
 * Get current source buffer :
 * - If already created for current thumbnail track, reuse
 * - If new codecs and/or init URL, create a new one
 * @param {Object} thumbnailTrack
 * @param {HTMLVideoElement} element
 * @returns {Observable}
 */
export function getSourceBuffer$(thumbnailTrack: IThumbnailTrack,
                                 element: HTMLVideoElement
): Observable<IGetSourceBufferEvent> {
  if (_currentThumbnailTrack !== undefined &&
      thumbnailTrack.codec === _currentThumbnailTrack.codec &&
      thumbnailTrack.initURL === _currentThumbnailTrack.initURL &&
      _currentVideoSourceBuffer !== undefined) {
    return observableOf({ type: "reuse-source-buffer" as const,
                          value: _currentVideoSourceBuffer });
  }
  return prepareSourceBuffer(element,
                             thumbnailTrack.codec).pipe(
    mergeMap((videoSourceBuffer) => {
      _currentThumbnailTrack = thumbnailTrack;
      _currentVideoSourceBuffer?.dispose();
      _currentVideoSourceBuffer = videoSourceBuffer;
      return getInitSegment(thumbnailTrack).pipe(
        mergeMap(({ value: { responseData } }) => {
          return videoSourceBuffer.appendSegment({ initSegment: responseData,
                                                   chunk: null,
                                                   codec: thumbnailTrack.codec });
        }),
        mapTo({ type: "created-source-buffer" as const,
                value: videoSourceBuffer }));
    }),
    catchError(() => {
      throw new Error("VideoThumbnailLoaderError: Couldn't open media source.");
    }),
    shareReplay()
  );
}

/**
 * Reset source buffer
 * @returns {void}
 */
export function disposeSourceBuffer(): void {
  _currentThumbnailTrack = undefined;
  _currentVideoSourceBuffer?.dispose();
  _currentVideoSourceBuffer = undefined;
}
