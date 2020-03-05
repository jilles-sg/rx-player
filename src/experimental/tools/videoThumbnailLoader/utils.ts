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

import Manifest, {
  Adaptation,
  ISegment,
  Period,
  Representation,
} from "../../../manifest";
import arrayFind from "../../../utils/array_find";

export interface IThumbnail {
  start: number;
  duration: number;
  mediaURL: string;
}

export interface IContentInfos {
  manifest: Manifest;
  period: Period;
  adaptation: Adaptation;
  representation: Representation;
}

/**
 * Search for wanted thumbnail and return it.
 * @param {Object} contentInfos
 * @param {number} time
 * @returns {<Object>|undefined}
 */
export function getNeededSegment(contentInfos: IContentInfos,
                                 time: number): ISegment|undefined {

  const firstTime = contentInfos.representation.index.getFirstPosition() ??
                    0;
  const lastTime = contentInfos.representation.index.getLastPosition() ??
                   Number.MAX_VALUE;

  const segment = arrayFind(
    contentInfos.representation.index.getSegments(firstTime, lastTime - firstTime),
    (t) => {
      const start = t.time / t.timescale;
      const end = start + (t.duration / t.timescale);
      const range = { start, end };
      const timeIsInSegment = time >= range.start && time < range.end;
      return timeIsInSegment;
    }
  );

  if (segment === undefined) {
    return undefined;
  }

  return segment;
}
