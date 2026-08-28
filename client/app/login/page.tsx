import { Suspense } from "react";
import { Logo } from "@/components/logo";

function LoginContent({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-[380px]">
        <div className="bg-card rounded-[14px] border border-line shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <Logo size={42} className="rounded-lg" />
            <div>
              <h1 className="font-display font-bold text-xl">Motion-U PinPoint</h1>
              <p className="text-xs text-ink-soft">Events Sales Management System</p>
            </div>
          </div>

          <p className="text-sm text-ink-soft mb-6 leading-relaxed">
            Sign in with your Zitadel account to record sales, track stock, and
            manage Motion-U events.
          </p>

          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full-page OAuth redirect */}
          <a
            href="/api/auth/login"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-violet text-white text-sm font-medium rounded-lg hover:bg-violet-dark transition-colors"
          >
            <i className="fa-solid fa-right-to-bracket text-[13px]" aria-hidden="true" />
            Sign in with Zitadel
          </a>

          <ErrorNote searchParams={searchParams} />
        </div>
      </div>
    </div>
  );
}

async function ErrorNote({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const error = params.error;

  if (!error) return null;

  const messages: Record<string, string> = {
    access_denied: "Sign in was cancelled or not allowed.",
    invalid_state: "Sign in failed. Please try again.",
    token_exchange_failed: "Could not complete sign in. Please try again.",
    invalid_token: "Sign in verification failed. Please try again.",
    forbidden_org: "Your account is not authorized to access this workspace.",
  };

  return (
    <div className="mt-4 p-3 rounded-lg bg-red-tint text-red text-[13px] font-semibold">
      <i className="fa-solid fa-triangle-exclamation text-[13px] mr-1.5" aria-hidden="true" />
      {messages[error] || "Sign in failed. Please try again."}
    </div>
  );
}

export default function LoginPage(props: { searchParams: Promise<{ error?: string }> }) {
  return (
    <Suspense>
      <LoginContent searchParams={props.searchParams} />
    </Suspense>
  );
}
