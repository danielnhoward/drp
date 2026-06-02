"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";

import { uploadRunPhotoAction, type RunPhotoState } from "./run-actions";

// Mirror lib/run-photos.ts so the picker filters the right types up front and
// an oversize selection fails fast in the browser instead of round-tripping.
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

const PHOTO_INITIAL: RunPhotoState = {};

export default function RunPhotoStep({
  runId,
  onCancel,
}: {
  runId: number;
  onCancel: () => void;
}) {
  const [photoState, uploadPhoto, uploading] = useActionState(
    uploadRunPhotoAction,
    PHOTO_INITIAL,
  );

  // "idle": choose how to add a photo. "webcam": live camera feed.
  const [mode, setMode] = useState<"idle" | "webcam">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [hasFile, setHasFile] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Revoke the preview's object URL when it's replaced or the step unmounts.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Stop the webcam if the step unmounts mid-capture (e.g. the run is
  // revalidated away after a successful upload). Reads the ref at cleanup time
  // so it always sees the live stream.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function stopWebcam() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function startWebcam() {
    setClientError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setClientError("This browser can't access a camera — choose a file instead.");
      return;
    }
    try {
      // `environment` prefers a rear camera on phones; on a laptop it's just a
      // hint and falls back to the built-in webcam.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setMode("webcam");
    } catch {
      setClientError(
        "Couldn't access the camera. Allow camera access or choose a file instead.",
      );
    }
  }

  // Stores a chosen/captured image: wires it into the hidden file input so the
  // form submits it, and shows a preview.
  function setPhoto(file: File) {
    if (preview) URL.revokeObjectURL(preview);
    const transfer = new DataTransfer();
    transfer.items.add(file);
    if (fileRef.current) fileRef.current.files = transfer.files;
    setPreview(URL.createObjectURL(file));
    setHasFile(true);
    setClientError(null);
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setPhoto(new File([blob], `run-${runId}.jpg`, { type: "image/jpeg" }));
        stopWebcam();
        setMode("idle");
      },
      "image/jpeg",
      0.92,
    );
  }

  function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setClientError(null);
    if (!file) return;
    if (!ACCEPTED_TYPES.split(",").includes(file.type)) {
      setClientError("Use a JPEG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setClientError("Photo is too large — keep it under 5 MB.");
      event.target.value = "";
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setHasFile(true);
  }

  function retake() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setHasFile(false);
    setClientError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function cancelWebcam() {
    stopWebcam();
    setMode("idle");
  }

  const error = clientError ?? photoState.error;

  return (
    <>
      <h2 className="text-lg font-semibold">Add a group photo</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        You finished first — add a group photo to remember this run by, or hand
        it off to whoever finishes next.
      </p>

      <form action={uploadPhoto} className="mt-4 flex flex-col gap-3">
        <input type="hidden" name="runId" value={String(runId)} />
        {/* The file the form submits — populated by the picker or a webcam grab. */}
        <input
          ref={fileRef}
          type="file"
          name="photo"
          accept={ACCEPTED_TYPES}
          onChange={onPickFile}
          disabled={uploading}
          className="sr-only"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Live webcam feed; hidden unless capturing and nothing's been taken yet. */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={
            mode === "webcam" && !preview
              ? "max-h-64 w-full rounded-lg border border-black/10 object-cover dark:border-white/15"
              : "hidden"
          }
        />

        {preview && (
          <Image
            src={preview}
            alt="Group photo preview"
            width={512}
            height={384}
            unoptimized
            className="max-h-64 w-full rounded-lg border border-black/10 object-cover dark:border-white/15"
          />
        )}

        {/* Capture controls vary by what we're doing right now. */}
        {preview ? (
          <button
            type="button"
            onClick={retake}
            disabled={uploading}
            className="inline-flex h-9 items-center justify-center rounded-md border border-black/15 px-3 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-white/20 dark:hover:bg-zinc-900"
          >
            Retake / choose another
          </button>
        ) : mode === "webcam" ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={capturePhoto}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Capture photo
            </button>
            <button
              type="button"
              onClick={cancelWebcam}
              className="inline-flex h-9 items-center justify-center rounded-md border border-black/15 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-white/20 dark:hover:bg-zinc-900"
            >
              Back
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={startWebcam}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-black/15 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-white/20 dark:hover:bg-zinc-900"
            >
              Use webcam
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-black/15 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-white/20 dark:hover:bg-zinc-900"
            >
              Choose a file
            </button>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
            className="rounded-md px-3 py-1.5 bg-zinc-100 text-sm text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!hasFile || uploading}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload photo"}
          </button>
        </div>
      </form>
    </>
  );
}
