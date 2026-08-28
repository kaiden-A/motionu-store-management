"use client";

import { useState, type FormEvent } from "react";
import { useSettings, useUpdateSettings } from "@/lib/queries";
import { useToast } from "@/components/toast";
import { AppShell, ViewHeader } from "@/components/shell";
import { Field, inputClass } from "@/components/modal";

export function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const raw = String(f.get("member_emails") || "");
    const emails = raw
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (emails.some((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) {
      toast("One or more email addresses look invalid.", "error");
      return;
    }
    setBusy(true);
    try {
      await updateSettings.mutateAsync({ member_notification_emails: emails });
      toast("Settings saved.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <ViewHeader title="Settings" />

      <div className="max-w-xl flex flex-col gap-5">
        <section className="bg-card border border-line rounded-[14px] p-5">
          <h2 className="font-display font-bold text-[17px] mb-1">Member notifications</h2>
          <p className="text-[13px] text-ink-soft mb-4">
            These team members receive an email whenever a new pre-order comes in (from the
            Google Form or the checkout). One email per address, comma-separated.
          </p>
          {isLoading ? (
            <p className="text-ink-soft">Loading…</p>
          ) : (
            <form id="settings-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              <Field label="Member emails">
                <textarea
                  name="member_emails"
                  rows={3}
                  defaultValue={(settings?.member_notification_emails || []).join(", ")}
                  placeholder="e.g. member1@motionukict.com, member2@motionukict.com"
                  className={inputClass}
                />
              </Field>
              <div className="flex justify-end">
                <button
                  type="submit"
                  form="settings-form"
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet text-white font-semibold text-sm hover:bg-violet-dark disabled:opacity-60"
                >
                  {busy ? (
                    <i className="fa-solid fa-circle-notch fa-spin text-[13px]" aria-hidden="true" />
                  ) : (
                    <i className="fa-solid fa-floppy-disk text-[12px]" aria-hidden="true" />
                  )}
                  Save
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="bg-card border border-line rounded-[14px] p-5">
          <h2 className="font-display font-bold text-[17px] mb-1">Google Form integration</h2>
          <p className="text-[13px] text-ink-soft">
            The Google Form posts new pre-orders to this endpoint (no login required, but the API
            key below must be sent as a header). See <code className="text-ink">docs/google_app_script.md</code>{" "}
            for the full guide and Apps Script example.
          </p>
          <dl className="mt-4 flex flex-col gap-2 text-[13px]">
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 items-baseline">
              <dt className="text-ink-soft min-w-[110px]">Method &amp; path</dt>
              <dd className="font-mono text-[12px] break-all">POST /api/v1/public/preorders</dd>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 items-baseline">
              <dt className="text-ink-soft min-w-[110px]">Header</dt>
              <dd className="font-mono text-[12px] break-all">motionu-api-key: &lt;FORM_API_KEY&gt;</dd>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 items-baseline">
              <dt className="text-ink-soft min-w-[110px]">Base URL</dt>
              <dd className="text-[12.5px]">
                The backend&apos;s public URL (e.g. the Cloud Run URL) — not the login-protected app URL.
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 items-baseline">
              <dt className="text-ink-soft min-w-[110px]">FORM_API_KEY</dt>
              <dd className="text-[12.5px]">
                Set in the server&apos;s <code className="text-ink">.env</code> / Cloud Run env vars.
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </AppShell>
  );
}
