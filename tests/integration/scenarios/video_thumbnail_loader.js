import { expect } from "chai";
import RxPlayer from "../../../src";
import VideoThumbnailLoader, {
  DASH_FETCHER,
} from "../../../src/experimental/tools/videoThumbnailLoader";
import { manifestInfos } from "../../contents/DASH_static_SegmentTimeline";
import XHRMock from "../../utils/request_mock";
import sleep from "../../utils/sleep";

describe.only("Video Thumbnail Loader", () => {
  let rxPlayer;
  let xhrMock;

  beforeEach(() => {
    rxPlayer = new RxPlayer({
      wantedBufferAhead: 0,
    });
    xhrMock = new XHRMock();
  });
  afterEach(() => {
    rxPlayer.dispose();
    xhrMock.restore();
  });

  it("should not work when no thumbnail track", async () => {
    rxPlayer.loadVideo({ url: manifestInfos.url, transport: "dash" });
    await sleep(75);
    const videoElement = document.createElement("video");
    const videoThumbnailLoader =
      new VideoThumbnailLoader(videoElement, rxPlayer);
    videoThumbnailLoader.addFetcher(DASH_FETCHER);
    let time;
    let error;
    try {
      time = await videoThumbnailLoader.setTime(1);
    } catch (err) {
      error = err;
    }
    expect(error).not.to.equal(undefined);
    expect(time).to.equal(undefined);
    expect(error.message).to.equal("Couldn't find track for this time.");
  });

  it("should not work when no period at given time", async () => {
    rxPlayer.loadVideo({ url: manifestInfos.url, transport: "dash" });
    await sleep(75);
    const videoElement = document.createElement("video");
    const manifest = rxPlayer.getManifest();
    const refToVideoAdaptation = manifest.periods[0].adaptations.video[0];
    expect(refToVideoAdaptation).not.to.equal(undefined);
    manifest.periods[0].adaptations.video[0].trickModeTracks =
      [refToVideoAdaptation];
    expect(manifest.periods[0].adaptations.video[0].trickModeTracks)
      .not.to.equal(undefined);
    const videoThumbnailLoader =
      new VideoThumbnailLoader(videoElement, rxPlayer);
    videoThumbnailLoader.addFetcher(DASH_FETCHER);
    let time;
    let error;
    try {
      time = await videoThumbnailLoader
        .setTime(manifest.getMaximumPosition() + 10);
    } catch (err) {
      error = err;
    }
    expect(error).not.to.equal(undefined);
    expect(time).to.equal(undefined);
    expect(error.message).to.equal("Couldn't find track for this time.");
  });

  it("should not work when no fetcher was imported", async () => {
    const wantedThumbnail = { time: 1,
                              range: [0, 4] };
    rxPlayer.loadVideo({ url: manifestInfos.url, transport: "dash" });
    await sleep(75);
    const videoElement = document.createElement("video");
    const manifest = rxPlayer.getManifest();
    const refToVideoAdaptation = manifest.periods[0].adaptations.video[0];
    expect(refToVideoAdaptation).not.to.equal(undefined);
    manifest.periods[0].adaptations.video[0].trickModeTracks =
      [refToVideoAdaptation];
    expect(manifest.periods[0].adaptations.video[0].trickModeTracks)
      .not.to.equal(undefined);
    const videoThumbnailLoader =
      new VideoThumbnailLoader(videoElement, rxPlayer);
    let error;
    try {
      await videoThumbnailLoader.setTime(wantedThumbnail.time);
    } catch (err) {
      error = err;
    }
    expect(error).not.to.equal(undefined);
    expect(error.message).to.equal("VideoThumbnailLoaderError: No imported "+
                                   "fetcher for this transport type: dash");
  });

  it("should load one thumbnail", async () => {
    const wantedThumbnail = { time: 1,
                              range: [0, 4] };
    rxPlayer.loadVideo({ url: manifestInfos.url, transport: "dash" });
    await sleep(75);
    const videoElement = document.createElement("video");
    const manifest = rxPlayer.getManifest();
    const refToVideoAdaptation = manifest.periods[0].adaptations.video[0];
    expect(refToVideoAdaptation).not.to.equal(undefined);
    manifest.periods[0].adaptations.video[0].trickModeTracks =
      [refToVideoAdaptation];
    expect(manifest.periods[0].adaptations.video[0].trickModeTracks)
      .not.to.equal(undefined);
    const videoThumbnailLoader =
      new VideoThumbnailLoader(videoElement, rxPlayer);
    videoThumbnailLoader.addFetcher(DASH_FETCHER);
    let time;
    let error;
    try {
      time = await videoThumbnailLoader.setTime(wantedThumbnail.time);
    } catch (err) {
      error = err;
    }
    expect(error).to.equal(undefined);
    expect(time).to.equal(wantedThumbnail.time);
    expect(videoElement.buffered.length).to.equal(1);
    expect(videoElement.buffered.start(0))
      .to.be.closeTo(wantedThumbnail.range[0], 0.01);
    expect(videoElement.buffered.end(0))
      .to.be.closeTo(wantedThumbnail.range[1], 0.01);
  });

  it("should load several thumbnails", async () => {
    const wantedThumbnail1 = { time: 1,
                               range: [0, 4] };
    const wantedThumbnail2 = { time: 30,
                               range: [28.028, 32.028] };
    rxPlayer.loadVideo({ url: manifestInfos.url, transport: "dash" });
    await sleep(75);
    const videoElement = document.createElement("video");
    const manifest = rxPlayer.getManifest();
    const refToVideoAdaptation = manifest.periods[0].adaptations.video[0];
    expect(refToVideoAdaptation).not.to.equal(undefined);
    manifest.periods[0].adaptations.video[0].trickModeTracks =
      [refToVideoAdaptation];
    expect(manifest.periods[0].adaptations.video[0].trickModeTracks)
      .not.to.equal(undefined);
    const videoThumbnailLoader =
      new VideoThumbnailLoader(videoElement, rxPlayer);
    videoThumbnailLoader.addFetcher(DASH_FETCHER);
    let time;
    let error;
    try {
      time = await videoThumbnailLoader.setTime(wantedThumbnail1.time);
    } catch (err) {
      error = err;
    }
    expect(error).to.equal(undefined);
    expect(time).to.equal(wantedThumbnail1.time);
    expect(videoElement.buffered.length).to.equal(1);
    expect(videoElement.buffered.start(0))
      .to.be.closeTo(wantedThumbnail1.range[0], 0.01);
    expect(videoElement.buffered.end(0))
      .to.be.closeTo(wantedThumbnail1.range[1], 0.01);

    time = undefined;
    error = undefined;

    try {
      time = await videoThumbnailLoader.setTime(wantedThumbnail2.time);
    } catch (err) {
      error = err;
    }
    expect(error).to.equal(undefined);
    expect(time).to.equal(wantedThumbnail2.time);
    expect(videoElement.buffered.length).to.equal(2);
    expect(videoElement.buffered.start(0))
      .to.be.closeTo(wantedThumbnail1.range[0], 0.01);
    expect(videoElement.buffered.end(0))
      .to.be.closeTo(wantedThumbnail1.range[1], 0.01);
    expect(videoElement.buffered.start(1))
      .to.be.closeTo(wantedThumbnail2.range[0], 0.01);
    expect(videoElement.buffered.end(1))
      .to.be.closeTo(wantedThumbnail2.range[1], 0.01);
  });

  it("should set twice the same thumbnail (consecutively)", async () => {
    const wantedThumbnail1 = { time: 1,
                               range: [0, 4] };
    rxPlayer.loadVideo({ url: manifestInfos.url, transport: "dash" });
    await sleep(75);
    const videoElement = document.createElement("video");
    const manifest = rxPlayer.getManifest();
    const refToVideoAdaptation = manifest.periods[0].adaptations.video[0];
    expect(refToVideoAdaptation).not.to.equal(undefined);
    manifest.periods[0].adaptations.video[0].trickModeTracks =
      [refToVideoAdaptation];
    expect(manifest.periods[0].adaptations.video[0].trickModeTracks)
      .not.to.equal(undefined);
    const videoThumbnailLoader =
      new VideoThumbnailLoader(videoElement, rxPlayer);
    videoThumbnailLoader.addFetcher(DASH_FETCHER);
    let time;
    let error;

    try {
      time = await videoThumbnailLoader.setTime(wantedThumbnail1.time);
    } catch (err) {
      error = err;
    }
    expect(error).to.equal(undefined);
    expect(time).to.equal(wantedThumbnail1.time);
    expect(videoElement.buffered.length).to.equal(1);
    expect(videoElement.buffered.start(0))
      .to.be.closeTo(wantedThumbnail1.range[0], 0.01);
    expect(videoElement.buffered.end(0))
      .to.be.closeTo(wantedThumbnail1.range[1], 0.01);

    time = undefined;
    error = undefined;

    // Lock, because it should work without needing to load again the thumbnail,
    // as the thumbnail is already buffered.
    xhrMock.lock();

    try {
      time = await videoThumbnailLoader.setTime(wantedThumbnail1.time);
    } catch (err) {
      error = err;
    }
    expect(error).to.equal(undefined);
    expect(time).to.equal(wantedThumbnail1.time);
    expect(videoElement.buffered.length).to.equal(1);
    expect(videoElement.buffered.start(0))
      .to.be.closeTo(wantedThumbnail1.range[0], 0.01);
    expect(videoElement.buffered.end(0))
      .to.be.closeTo(wantedThumbnail1.range[1], 0.01);
  });

  it("should set several times the same thumbnail (at the same time)", async () => {
    const wantedThumbnail1 = { time: 1,
                               range: [0, 4] };
    rxPlayer.loadVideo({ url: manifestInfos.url, transport: "dash" });
    await sleep(75);
    const videoElement = document.createElement("video");
    const manifest = rxPlayer.getManifest();
    const refToVideoAdaptation = manifest.periods[0].adaptations.video[0];
    expect(refToVideoAdaptation).not.to.equal(undefined);
    manifest.periods[0].adaptations.video[0].trickModeTracks =
      [refToVideoAdaptation];
    expect(manifest.periods[0].adaptations.video[0].trickModeTracks)
      .not.to.equal(undefined);
    const videoThumbnailLoader =
      new VideoThumbnailLoader(videoElement, rxPlayer);
    videoThumbnailLoader.addFetcher(DASH_FETCHER);

    xhrMock.lock();
    videoThumbnailLoader.setTime(wantedThumbnail1.time);
    videoThumbnailLoader.setTime(wantedThumbnail1.time);
    videoThumbnailLoader.setTime(wantedThumbnail1.time);
    videoThumbnailLoader.setTime(wantedThumbnail1.time);
    videoThumbnailLoader.setTime(wantedThumbnail1.time);

    await sleep(75);
    const xhrs = xhrMock.getLockedXHR();

    expect(xhrs.length).to.equal(1);
    expect(xhrs[0].url)
      .to.equal("http://127.0.0.1:3000/DASH_static_SegmentTimeline/media/dash/ateam-video=400000.dash");

    xhrMock.unlock();
    await sleep(75);
    expect(videoElement.buffered.length).to.equal(1);
    expect(videoElement.buffered.start(0))
      .to.be.closeTo(wantedThumbnail1.range[0], 0.01);
    expect(videoElement.buffered.end(0))
      .to.be.closeTo(wantedThumbnail1.range[1], 0.01);
  });

  it("should abort a job when starting another", async () => {
    const wantedThumbnail1 = { time: 1,
                               range: [0, 4] };
    const wantedThumbnail2 = { time: 11,
                               range: [8.008, 12.008] };
    rxPlayer.loadVideo({ url: manifestInfos.url, transport: "dash" });
    await sleep(75);
    const videoElement = document.createElement("video");
    const manifest = rxPlayer.getManifest();
    const refToVideoAdaptation = manifest.periods[0].adaptations.video[0];
    expect(refToVideoAdaptation).not.to.equal(undefined);
    manifest.periods[0].adaptations.video[0].trickModeTracks =
      [refToVideoAdaptation];
    expect(manifest.periods[0].adaptations.video[0].trickModeTracks)
      .not.to.equal(undefined);
    const videoThumbnailLoader =
      new VideoThumbnailLoader(videoElement, rxPlayer);
    videoThumbnailLoader.addFetcher(DASH_FETCHER);

    let error1;
    let error2;
    let time;

    videoThumbnailLoader.setTime(wantedThumbnail1.time).catch((err) => {
      error1 = err;
    });

    try {
      time = await videoThumbnailLoader.setTime(wantedThumbnail2.time);
    } catch(err) {
      error2 = err;
    }

    expect(error1).not.to.equal(undefined);
    expect(error1.message).to.equal("VideoThumbnailLoaderError: Aborted job.");
    expect(error2).to.equal(undefined);
    expect(time).to.equal(wantedThumbnail2.time);
    expect(videoElement.buffered.length).to.equal(1);
    expect(videoElement.buffered.start(0))
      .to.be.closeTo(wantedThumbnail2.range[0], 0.01);
    expect(videoElement.buffered.end(0))
      .to.be.closeTo(wantedThumbnail2.range[1], 0.01);
  });
});
