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

import pinkie from "pinkie";
import {
  merge as observableMerge,
  Observable,
  ReplaySubject,
} from "rxjs";
import {
  catchError,
  filter,
  map,
  mergeMap,
  take,
} from "rxjs/operators";
import Manifest, { ISegment } from "../../../manifest";
import getContentInfos from "./get_content_infos";
import {
  disposeSourceBuffer,
  initSourceBuffer$,
} from "./init_source_buffer";
import log from "./log";
import removeBufferForTime$ from "./remove_buffer";
import {
  getNeededSegment,
  IContentInfos,
} from "./utils";
import VideoThumbnailLoaderError from "./video_thumbnail_loader_error";

import createSegmentLoader from "../../../core/pipelines/segment/create_segment_loader";
import dash from "../../../transports/dash";

const PPromise = typeof Promise === "function" ? Promise :
                                                 pinkie;

interface IJob { contentInfos: IContentInfos;
                 segment: ISegment;
                 stop: () => void;
                 jobPromise: Promise<unknown>; }

const segmentLoader = createSegmentLoader(
  dash({ lowLatencyMode: false }).video.loader,
  { maxRetry: 0,
    maxRetryOffline: 0,
    initialBackoffDelay: 0,
    maximumBackoffDelay: 0, }
);

/**
 * This tool, as a supplement to the RxPlayer, intent to help creating thumbnails
 * from a video source.
 *
 * The tools will extract a "thumbnail track" either from a video track (whose light
 * chunks are adapted from such use case) or direclty from the media content.
 */
export default class VideoThumbnailLoader {
  private readonly _videoElement: HTMLVideoElement;

  private _manifest: Manifest;
  private _currentJob?: IJob;

  constructor(videoElement: HTMLVideoElement,
              manifest: Manifest) {
    this._videoElement = videoElement;
    this._manifest = manifest;
  }

  /**
   * Set time of thumbnail video media element :
   * - Remove buffer when too much buffered data
   * - Search for thumbnail track element to display
   * - Load data
   * - Append data
   * Resolves when time is set.
   * @param {number} time
   * @returns {Promise}
   */
  setTime(time: number): Promise<unknown> {
    return this._setTime(time, this._videoElement);
  }

  /**
   * Dispose thumbnail loader.
   * @returns {void}
   */
  dispose(): void {
    disposeSourceBuffer(this._videoElement);
    this._currentJob?.stop();
  }

  private _setTime = (time: number,
                      videoElement: HTMLVideoElement
  ): Promise<unknown> => {

    for (let i = 0; i < videoElement.buffered.length; i++) {
      if (videoElement.buffered.start(i) <= time &&
          videoElement.buffered.end(i) >= time) {
        this._videoElement.currentTime = time;
        log.debug("VTL: Thumbnail already loaded.");
        return PPromise.resolve(time);
      }
    }

    const contentInfos = getContentInfos(time, this._manifest);
    if (contentInfos === null) {
      return PPromise.reject(new VideoThumbnailLoaderError("NO_TRACK",
                                                  "Couldn't find track for this time."));
    }
    const initURL = contentInfos.representation.index.getInitSegment()?.mediaURL ?? "";
    if (initURL === "") {
      return PPromise.reject(new VideoThumbnailLoaderError("NO_INIT_DATA", "No init data for track."));
    }
    const segment = getNeededSegment(contentInfos,
                                         time);
    if (segment === undefined) {
      return PPromise.reject(new VideoThumbnailLoaderError("NO_THUMBNAILS", "Couldn't find thumbnail."));
    }

    log.debug("VTL: Found thumbnail for time", time, segment);

    if (this._currentJob === undefined) {
      return this.startJob(contentInfos, time, segment);
    }

    if (this._currentJob.contentInfos.representation.getMimeTypeString() !==
        contentInfos.representation.getMimeTypeString()) {
      this._currentJob.stop();
      return this.startJob(contentInfos, time, segment);
    }
    if (this._currentJob.segment.time !== segment.time ||
        this._currentJob.segment.duration !== segment.duration ||
        this._currentJob.segment.mediaURL !== segment.mediaURL) {
      this._currentJob.stop();
      return this.startJob(contentInfos, time, segment);
    }

    // If we reach this endpoint, it means the current job is already handling
    // the loading for the wanted time (same thumbnail).
    return this._currentJob.jobPromise;
  }

  private startJob = (contentInfos: IContentInfos,
                      time: number,
                      segment: ISegment
  ): Promise<unknown> => {
    const killJob$ = new ReplaySubject();

    const abortError$ = killJob$.pipe(
      map(() => {
        throw new VideoThumbnailLoaderError("ABORTED",
                                            "VideoThumbnailLoaderError: Aborted job.");
      })
    );

    const jobPromise = observableMerge(
      initSourceBuffer$(contentInfos,
                        this._videoElement).pipe(
        mergeMap((videoSourceBuffer) => {
          const removeBuffers$: Observable<unknown> =
            removeBufferForTime$(this._videoElement, videoSourceBuffer, time);
          return removeBuffers$.pipe(
            mergeMap(() => {
              log.debug("VTL: Removed buffer before appending segments.", time);

              return segmentLoader({
                manifest: contentInfos.manifest,
                period: contentInfos.manifest.periods[0],
                adaptation: contentInfos.adaptation,
                representation: contentInfos.representation,
                segment,
              }).pipe(
                filter((evt): evt is { type: "data";
                                       value: { responseData: Uint8Array }; } =>
                  evt.type === "data"),
                mergeMap((evt) => {
                  return videoSourceBuffer
                    .appendSegment({ chunk: evt.value.responseData,
                                     initSegment: null,
                                     codec: contentInfos
                                       .representation.getMimeTypeString() })
                      .pipe(map(() => {
                        log.debug("VTL: Appended segment.", evt.value.responseData);
                        this._videoElement.currentTime = time;
                        if (this._videoElement.buffered.length === 0) {
                          throw new VideoThumbnailLoaderError("NOT_BUFFERED",
                                                              "No buffered data after loading.");
                        } else {
                          return time;
                        }
                      })
                    );
                })
              );
            })
          );
        }),
        catchError((err: Error | { message?: string; toString(): string }) => {
          const newError =
            new VideoThumbnailLoaderError("LOADING_ERROR",
                                          (err.message ?? err.toString()));
          throw newError;
        })
      ),
      abortError$
    ).pipe(take(1)).toPromise(PPromise)
      .then((res) => { this._currentJob = undefined; return res; })
      .catch((err) => { this._currentJob = undefined; throw err; });

    this._currentJob = {
      contentInfos,
      segment,
      stop: () => killJob$.next(),
      jobPromise,
    };

    return jobPromise;
  }
}
