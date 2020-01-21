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
  filter,
  map,
  mapTo,
  mergeMap,
  shareReplay,
} from "rxjs/operators";
import createSegmentLoader from "../../../core/pipelines/segment/create_segment_loader";
import dash from "../../../transports/dash";
import LightVideoQueuedSourceBuffer from "./light_video_queued_source_buffer";
import prepareSourceBuffer from "./prepare_source_buffer";
import { IContentInfos } from "./utils";

const _currentVideoSourceBuffers: WeakMap<HTMLMediaElement,
                                          LightVideoQueuedSourceBuffer> = new WeakMap();
const _currentContentInfos: WeakMap<HTMLMediaElement,
                                    IContentInfos> = new WeakMap();

const segmentLoader = createSegmentLoader(
  dash({ lowLatencyMode: false }).video.loader,
  { maxRetry: 0,
    maxRetryOffline: 0,
    initialBackoffDelay: 0,
    maximumBackoffDelay: 0, });

/**
 * Get current source buffer :
 * - If already created for current representation, reuse
 * - If new codecs and/or init URL, create a new one
 * @param {Object} contentInfos
 * @param {HTMLVideoElement} element
 * @returns {Observable}
 */
export function initSourceBuffer$(contentInfos: IContentInfos,
                                  element: HTMLVideoElement
): Observable<LightVideoQueuedSourceBuffer> {
  let _sourceBufferObservable$: Observable<LightVideoQueuedSourceBuffer>;
  const currentVideoSourceBuffer = _currentVideoSourceBuffers.get(element);
  const currentContentInfos = _currentContentInfos.get(element);
  if (currentContentInfos !== undefined &&
      currentVideoSourceBuffer !== undefined) {
    _sourceBufferObservable$ = observableOf(currentVideoSourceBuffer);
  } else {
    _sourceBufferObservable$ =
      prepareSourceBuffer(element,
                          contentInfos.representation.getMimeTypeString())
        .pipe(
          map((videoSourceBuffer) => {
            currentVideoSourceBuffer?.dispose();
            _currentVideoSourceBuffers.set(element, videoSourceBuffer);
            return videoSourceBuffer;
          }),
          catchError(() => {
            throw new Error("VideoThumbnailLoaderError: Couldn't open media source.");
          }),
          shareReplay()
        );
  }

  const currentInitURL =
    currentContentInfos?.representation.index.getInitSegment()?.mediaURL;
  const initSegment = contentInfos.representation.index.getInitSegment();
  const initURL = initSegment?.mediaURL;

  if (currentContentInfos === undefined ||
      currentInitURL !== initURL) {
    return _sourceBufferObservable$.pipe(
      mergeMap((sourceBuffer) => {
        if (initSegment == null) {
          throw new Error("No init segment.");
        }
        _currentContentInfos.set(element, contentInfos);
        return segmentLoader({
          manifest: contentInfos.manifest,
          period: contentInfos.manifest.periods[0],
          adaptation: contentInfos.adaptation,
          representation: contentInfos.representation,
          segment: initSegment,
        }).pipe(
          filter((evt): evt is { type: "data"; value: { responseData: Uint8Array } } =>
            evt.type === "data"),
          mergeMap((evt) => {
            return sourceBuffer
              .appendSegment({ initSegment: evt.value.responseData,
                               chunk: null,
                               codec: contentInfos.representation.getMimeTypeString() });
          }),
          mapTo(sourceBuffer)
        );
      })
    );
  }
  return _sourceBufferObservable$;
}

/**
 * Reset source buffers
 * @returns {void}
 */
export function disposeSourceBuffer(element: HTMLMediaElement): void {
  _currentContentInfos.delete(element);
  _currentVideoSourceBuffers.get(element)?.dispose();
  _currentVideoSourceBuffers.delete(element);
}
