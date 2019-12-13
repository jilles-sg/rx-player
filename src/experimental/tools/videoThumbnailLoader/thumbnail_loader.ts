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
  combineLatest as observableCombineLatest,
  EMPTY,
  Observable,
  of as observableOf,
} from "rxjs";
import {
  catchError,
  mergeMap,
  tap,
} from "rxjs/operators";
import Manifest from "../../../manifest";
import {
  disposeSourceBuffer,
  getSourceBuffer$,
} from "./get_source_buffer";
import log from "./log";
import {
  loadInitThumbnail,
  loadThumbnails
} from "./segment_utils";
import {
  getThumbnailTrack,
  getWantedThumbnails,
  IThumbnail,
  IThumbnailTrack,
} from "./thumbnail_track_utils";

const PPromise = typeof Promise === "function" ? Promise :
                                                 pinkie;

interface IJob { thumbnailTrack: IThumbnailTrack;
                 thumbnails: IThumbnail[];
                 stop: () => void; }

/**
 * This tool, as a supplement to the RxPlayer, intent to help creating thumbnails
 * from a video source.
 *
 * The tools will extract a "thumbnail track" either from a video track (whose light
 * chunks are adapted from such use case) or direclty from the media content.
 */
export default class VideoThumbnailLoader {
  private readonly _thumbnailVideoElement: HTMLVideoElement;

  private _manifest: Manifest;
  private _currentJob?: IJob;

  constructor(videoElement: HTMLVideoElement,
              manifest: Manifest) {
    this._thumbnailVideoElement = videoElement;
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
    return new PPromise((done, failed) => {
      this._setTime({ time, done, failed }, this._thumbnailVideoElement);
    });
  }

  /**
   * Dispose thumbnail loader.
   * @returns {void}
   */
  dispose(): void {
    disposeSourceBuffer();
    return this._currentJob?.stop();
  }

  private _setTime = (payload: { time: number;
                                 done: (time: number) => void;
                                 failed: (err: unknown) => void; },
                      videoElement: HTMLVideoElement
  ): void => {
    const { time, done, failed } = payload;
    if (time === this._thumbnailVideoElement.currentTime) {
      return failed(new Error("VideoThumbnailLoaderError: " +
                              "Already at this time."));
    }
    const period = this._manifest.getPeriodForTime(payload.time);
    if (period === undefined ||
        period.adaptations.video === undefined ||
        period.adaptations.video.length === 0) {
      return failed(new Error("VideoThumbnailLoaderError: " +
                              "Couldn't find track for this time."));
    }
    const videoAdaptation = period.adaptations.video[0];
    const representation = videoAdaptation.trickModeTrack?.representations[0] ??
                           videoAdaptation.representations[0];
    if (representation === undefined) {
      return failed(new Error("VideoThumbnailLoaderError: " +
                              "Couldn't find track for this time."));
    }
    const thumbnailTrack = getThumbnailTrack(representation);
    if (thumbnailTrack.initURL === "") {
      return failed(new Error("VideoThumbnailLoaderError: " +
                              "No init data for track."));
    }
    const thumbnails = getWantedThumbnails(thumbnailTrack,
                                           payload.time,
                                           videoElement.buffered);
    if (thumbnails === null) {
      return failed(new Error("VideoThumbnailLoaderError: " +
                              "Couldn't find thumbnail."));
    }
    if (thumbnails.length === 0) {
      log.debug("VTL: Thumbnail already loaded.");
      return failed(new Error("VideoThumbnailLoaderError: " +
                              "Video thumbnail already loaded."));
    }
    log.debug("VTL: Found thumbnails for time", payload.time, thumbnails);

    if (this._currentJob === undefined) {
      return this.startJob(thumbnailTrack, time, thumbnails, done, failed);
    }

    if (this._currentJob.thumbnailTrack.codec !== thumbnailTrack.codec ||
        this._currentJob.thumbnails.length !== thumbnails.length) {
      this._currentJob.stop();
      return this.startJob(thumbnailTrack, time, thumbnails, done, failed);
    }
    for (let j = 0; j < thumbnails.length; j++) {
      if (this._currentJob.thumbnails[j].start !== thumbnails[j].start ||
          this._currentJob.thumbnails[j].duration !== thumbnails[j].duration ||
          this._currentJob.thumbnails[j].mediaURL !== thumbnails[j].mediaURL) {
        this._currentJob.stop();
        return this.startJob(thumbnailTrack, time, thumbnails, done, failed);
      }
    }
    return failed(new Error("VideoThumbnailLoaderError: " +
                            "Already loading these thumbnails."));
  }

  private startJob = (thumbnailTrack: IThumbnailTrack,
                      time: number,
                      thumbnails: IThumbnail[],
                      done: (time: number) => void,
                      failed: (e: Error) => void
  ) => {
    const subscription = getSourceBuffer$(thumbnailTrack,
                                          this._thumbnailVideoElement).pipe(
      mergeMap((videoSourceBufferEvt) => {
        const { type, value: videoSourceBuffer } = videoSourceBufferEvt;
        return (
          type === "reuse-source-buffer" ? observableOf(null) :
                                           loadInitThumbnail(thumbnailTrack,
                                                             videoSourceBuffer)
        ).pipe(
          mergeMap(() => {
            const removeBuffers$: Observable<unknown> =
              this._thumbnailVideoElement.buffered.length > 0 ?
                observableCombineLatest([
                  videoSourceBuffer.removeBuffer(0, time - 5),
                  videoSourceBuffer.removeBuffer(time + 5, Infinity)]) :
                observableOf(null);
            return removeBuffers$.pipe(
              mergeMap(() => {
                log.debug("VTL: Removed buffer before appending segments.", time);
                return loadThumbnails(thumbnails,
                                      videoSourceBuffer,
                                      thumbnailTrack.codec,
                                      time,
                                      this._thumbnailVideoElement)
                  .pipe(
                    tap(() => {
                      this._currentJob = undefined;
                      if (this._thumbnailVideoElement.buffered.length === 0) {
                        failed(new Error("VideoThumbnailLoaderError: " +
                                         "No buffered data after loading."));
                      } else {
                        done(time);
                      }
                    })
                  );
              })
            );
          })
        );
      }),
      catchError((err: Error | { message?: string }) => {
        this.dispose();
        const newError = new Error("VideoThumbnailLoaderError: " + (err.message ?? "Unknown error"));
        this._currentJob = undefined;
        failed(newError);
        return EMPTY;
      })
    ).subscribe(
      () => ({}),
      (err: Error | { message?: string }) => {
        this.dispose();
        const newError = new Error("VideoThumbnailLoaderError: " + (err.message ?? "Unknown error"));
        this._currentJob = undefined;
        failed(newError);
      }
    );

    this._currentJob = {
      thumbnailTrack,
      thumbnails,
      stop: () => {
        this._currentJob = undefined;
        subscription.unsubscribe();
        failed(new Error("VideoThumbnailLoaderError: Aborted job."));
      },
    };

    return;
  }
}
