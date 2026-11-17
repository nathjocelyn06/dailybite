"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Facing = "environment" | "user";

/**
 * Live camera for the AI camera page: opens the device camera (laptop webcam, iPad,
 * phone), shows a preview and takes a still.
 *
 * Notes that matter:
 *  - getUserMedia needs a secure context. localhost counts, and the deployed app is
 *    HTTPS, so both work; anything else falls back to the file picker.
 *  - iOS Safari will not play an inline preview without `playsInline` + `muted`, and
 *    only starts a stream from a user gesture — hence the explicit "Open camera" button.
 *  - Tracks are stopped on close and on unmount, so the camera light never stays on.
 */
export function CameraCapture({
  onCapture,
  onClose
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [canSwitch, setCanSwitch] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  const start = useCallback(
    async (want: Facing) => {
      setErr("");
      setReady(false);
      stop();
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setErr(
          window.isSecureContext === false
            ? "The camera needs a secure connection (https). Use the upload button instead."
            : "This browser can't open the camera. Use the upload button instead."
        );
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: want }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        setReady(true);
        // Only offer front/back switching when there really is more than one camera.
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        setCanSwitch(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        setErr(
          name === "NotAllowedError"
            ? "Camera permission was blocked. Allow it in your browser's address bar, then try again."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "No camera found on this device. Use the upload button instead."
              : name === "NotReadableError"
                ? "Another app is using the camera. Close it and try again."
                : "Could not open the camera. Use the upload button instead."
        );
      }
    },
    [stop]
  );

  useEffect(() => {
    void start(facing);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  function take() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setBusy(true);
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setBusy(false);
      setErr("Could not read the photo. Try again.");
      return;
    }
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob) return setErr("Could not read the photo. Try again.");
        stop();
        onCapture(new File([blob], `snap-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  }

  return (
    <div className="camera" aria-label="Camera">
      <div className="camera-stage">
        <video ref={videoRef} playsInline muted autoPlay className="camera-video" />
        {!ready && !err && <p className="camera-hint">Starting the camera…</p>}
        {err && <p className="camera-hint">{err}</p>}
      </div>
      <div className="camera-bar">
        <button type="button" className="btn" onClick={() => { stop(); onClose(); }}>Cancel</button>
        <button
          type="button"
          className="shutter"
          onClick={take}
          disabled={!ready || busy}
          aria-label="Take photo"
        >
          <span />
        </button>
        {canSwitch ? (
          <button type="button" className="btn" onClick={() => setFacing(facing === "environment" ? "user" : "environment")}>
            Flip
          </button>
        ) : err ? (
          <button type="button" className="btn" onClick={() => void start(facing)}>Retry</button>
        ) : (
          <span style={{ width: 64 }} />
        )}
      </div>
    </div>
  );
}
