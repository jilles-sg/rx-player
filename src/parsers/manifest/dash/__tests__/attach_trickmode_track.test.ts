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

import attachTrickModeTrack from "../attach_trickmode_track";

describe("attachTrickModeTrack", () => {
  it("should correclty attach trickmode tracks", () => {
    const trickModeTracks = [
      { adaptation: { type: "video" }, isTrickModeFor: 1 },
      { adaptation: { type: "video" }, isTrickModeFor: 3 },
      { adaptation: { type: "audio" }, isTrickModeFor: 1 },
    ] as any;

    const adaptations = {
      video: [
        { id: 1, trickModeTrack: undefined },
        { id: 2, trickModeTrack: undefined },
        { id: 3, trickModeTrack: undefined },
        { id: 4, trickModeTrack: undefined },
      ],
      audio: [
        { id: 1, trickModeTrack: undefined },
        { id: 2, trickModeTrack: undefined },
        { id: 3, trickModeTrack: undefined },
      ],
    } as any;

    /* tslint:disable-next-line no-unsafe-any */
    attachTrickModeTrack(adaptations, trickModeTracks);

    expect(adaptations).toEqual({
      video: [
        { id: 1, trickModeTrack: { type: "video" } },
        { id: 2, trickModeTrack: undefined },
        { id: 3, trickModeTrack: { type: "video" } },
        { id: 4, trickModeTrack: undefined },
      ],
      audio: [
        { id: 1, trickModeTrack: { type: "audio" } },
        { id: 2, trickModeTrack: undefined },
        { id: 3, trickModeTrack: undefined },
      ],
    });
  });
});
