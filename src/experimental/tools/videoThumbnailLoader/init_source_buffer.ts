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
  EMPTY,
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
import { QueuedSourceBuffer } from "../../../core/source_buffers";
import dash from "../../../transports/dash";
import prepareSourceBuffer from "./prepare_source_buffer";
import { IContentInfos } from "./types";

const _currentVideoSourceBuffers: WeakMap<HTMLMediaElement,
                                          QueuedSourceBuffer<Uint8Array>> = new WeakMap();
const _currentContentInfos: WeakMap<HTMLMediaElement,
                                    IContentInfos> = new WeakMap();

const { loader, parser } = dash({ lowLatencyMode: false }).video;
const segmentLoader = createSegmentLoader(
  loader,
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
): Observable<QueuedSourceBuffer<Uint8Array>> {
  let _sourceBufferObservable$: Observable<QueuedSourceBuffer<Uint8Array>>;
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
          catchError((err: Error) => {
            throw new Error("VideoThumbnailLoaderError: Error when creating" +
                            " media source or source buffer: " + err.toString());
          }),
          shareReplay()
        );
  }

  const initSegment = contentInfos.representation.index.getInitSegment();
  const currentInitSegmentId =
    currentContentInfos?.representation.index.getInitSegment()?.id;

  if (currentInitSegmentId === initSegment?.id &&
      contentInfos.representation.id === currentContentInfos?.representation.id &&
      contentInfos.adaptation.id === currentContentInfos?.adaptation.id &&
      contentInfos.period.id === currentContentInfos?.period.id &&
      contentInfos.manifest.id === currentContentInfos?.manifest.id) {
    return _sourceBufferObservable$;
  }

  return _sourceBufferObservable$.pipe(
    mergeMap((sourceBuffer) => {
      if (initSegment == null) {
        throw new Error("No init segment.");
      }
      _currentContentInfos.set(element, contentInfos);
      const inventoryInfos = { manifest: contentInfos.manifest,
                               period: contentInfos.period,
                               adaptation: contentInfos.adaptation,
                               representation: contentInfos.representation,
                               segment: initSegment };
      return segmentLoader(inventoryInfos).pipe(
        filter((evt): evt is { type: "data"; value: { responseData: Uint8Array } } =>
          evt.type === "data"),
        mergeMap((evt) => {
          return parser({
            response: {
              data: evt.value.responseData,
              isChunked: false,
            },
            content: inventoryInfos,
          }).pipe(
            mergeMap((parserEvent) => {
              if (parserEvent.type !== "parsed-init-segment") {
                return EMPTY;
              }
              const { initializationData } = parserEvent.value;
              const initSegmentData = initializationData instanceof ArrayBuffer ?
                new Uint8Array(initializationData) : initializationData;
              return sourceBuffer
                .pushChunk({ data: { initSegment: initSegmentData,
                                     chunk: null,
                                     appendWindow: [undefined, undefined],
                                     timestampOffset: 0,
                                     codec: contentInfos
                                       .representation.getMimeTypeString() },
                             inventoryInfos });
            })
          );
        }),
        mapTo(sourceBuffer)
      );
    })
  );
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
