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
  combineLatest as observableCombineLatest,
  Observable,
  of as observableOf,
} from "rxjs";
import { QueuedSourceBuffer } from "../../../core/source_buffers";

/**
 * Remove buffer around wanted time
 * @param {HTMLMediaElement} videoElement
 * @param {Object} sourceBuffer
 * @param {Number} time
 * @returns {Observable}
 */
export default function removeBufferForTime$(videoElement: HTMLMediaElement,
                                             sourceBuffer: QueuedSourceBuffer<Uint8Array>,
                                             time: number): Observable<unknown> {
  return (videoElement.buffered.length > 0) ?
    observableCombineLatest([
      ((time - 60 * 10) > 0) ?
        sourceBuffer.removeBuffer(0, time - (60 * 10)) :
        observableOf(null),
      ((time + 60 * 10) < videoElement.duration) ?
        sourceBuffer.removeBuffer(time + (60 * 10), videoElement.duration) :
        observableOf(null)]) :
    observableOf(null);
}
