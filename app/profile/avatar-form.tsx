"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  removeAvatarAction,
  updateAvatarAction,
  type AvatarFormState,
} from "./actions";

type Props = {
  name: string;
  initialAvatar: string | null;
};

const INITIAL_STATE: AvatarFormState = {};

// Mirror lib/avatars.ts so the file picker filters the right types up front
// and an oversize selection fails fast in the browser rather than round-trip
// to the server.
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 50 * 1024 * 1024;

export default function AvatarForm({ name, initialAvatar }: Props) {
  const [state, action, pending] = useActionState(
    updateAvatarAction,
    INITIAL_STATE,
  );
  const [removing, setRemoving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Revoke any stale object URL we created for the preview when the component
  // unmounts or the preview is replaced. The preview itself stays visible
  // after a successful upload until the user picks again — visually identical
  // to the file they just saved, so there's nothing to clean up eagerly.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const displayed = preview ?? initialAvatar;
  const error = clientError ?? state.error;

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setClientError(null);
    if (preview) URL.revokeObjectURL(preview);
    if (!file) {
      setPreview(null);
      return;
    }
    if (!ACCEPTED_TYPES.split(",").includes(file.type)) {
      setPreview(null);
      setClientError("Use a JPEG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setPreview(null);
      setClientError("Image is too large — keep it under 50 MB.");
      event.target.value = "";
      return;
    }
    setPreview(URL.createObjectURL(file));
    // Submit immediately on selection — no separate "Upload" tap needed.
    formRef.current?.requestSubmit();
  }

  async function onRemove() {
    setClientError(null);
    // Drop any local preview from a prior file pick so the cleared server
    // state actually shows through after the action returns.
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    if (fileRef.current) fileRef.current.value = "";
    setRemoving(true);
    try {
      await removeAvatarAction();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className="mb-6 flex flex-col items-center gap-4">
      <form ref={formRef} action={action}>
        <input
          ref={fileRef}
          type="file"
          name="avatar"
          accept={ACCEPTED_TYPES}
          onChange={onPick}
          disabled={pending}
          className="sr-only"
        />
      </form>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={pending}
        className="group relative h-40 w-40 shrink-0 cursor-pointer rounded-full transition hover:brightness-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-50 disabled:hover:brightness-100"
        aria-label={displayed ? "Change profile picture" : "Upload profile picture"}
      >
        {displayed ? (
          <Image
            src={displayed}
            alt={`${name}'s profile picture`}
            width={160}
            height={160}
            className="h-40 w-40 rounded-full border border-border object-cover"
            unoptimized={preview !== null}
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-40 w-40 items-center justify-center rounded-full border border-border bg-surface-2 text-5xl font-semibold text-muted"
          >
            {name.charAt(0)}
          </span>
        )}
        {/* Camera badge — bottom-right corner */}
        <span
          aria-hidden="true"
          className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-accent shadow-md ring-2 ring-background"
        >
          <CameraIcon className="h-5 w-5 text-accent-contrast" />
        </span>
      </button>
      {initialAvatar && (
        <button
          type="button"
          onClick={onRemove}
          disabled={pending || removing}
          className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border px-3 text-sm font-medium text-danger hover:bg-surface-2 disabled:cursor-default disabled:opacity-50"
        >
          {removing ? "Removing…" : "Remove photo"}
        </button>
      )}
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : (
        <p className="text-xs text-muted">
          {pending
            ? "Uploading…"
            : `Tap to ${displayed ? "change" : "add a photo"} · JPEG, PNG, or WebP · up to 50 MB`}
        </p>
      )}
    </section>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}
