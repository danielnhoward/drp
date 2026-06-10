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
const MAX_BYTES = 5 * 1024 * 1024;

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
      setClientError("Image is too large — keep it under 5 MB.");
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
    <section className="mb-6 flex items-center gap-4">
      <div className="relative h-20 w-20 shrink-0">
        {displayed ? (
          <Image
            src={displayed}
            alt={`${name}'s profile picture`}
            width={80}
            height={80}
            className="h-20 w-20 rounded-full border border-border object-cover"
            unoptimized={preview !== null}
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-surface-2 text-2xl font-semibold text-muted"
          >
            {name.charAt(0)}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <form ref={formRef} action={action} className="flex flex-wrap gap-2">
          <label
            className={`inline-flex h-9 cursor-pointer items-center rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-surface-2 ${pending ? "pointer-events-none opacity-50" : ""}`}
          >
            {pending ? "Uploading…" : initialAvatar ? "Change" : "Upload"}
            <input
              ref={fileRef}
              type="file"
              name="avatar"
              accept={ACCEPTED_TYPES}
              onChange={onPick}
              disabled={pending}
              className="sr-only"
            />
          </label>
          {initialAvatar && (
            <button
              type="button"
              onClick={onRemove}
              disabled={pending || removing}
              className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-danger hover:bg-surface-2 disabled:opacity-50"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          )}
        </form>
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : (
          <p className="text-xs text-muted">
            JPEG, PNG, or WebP. Up to 5 MB.
          </p>
        )}
      </div>
    </section>
  );
}
