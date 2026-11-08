import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { Bookmarklet } from "@/components/Bookmarklet";
import { button, card } from "@/components/ui";
import { getPeople, getSetting } from "@/lib/data";
import { joinNames } from "@/lib/format";
import { requireViewer } from "@/lib/session";

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
        {n}
      </span>
      <div className="pt-0.5">{children}</div>
    </li>
  );
}

const Code = ({ children }: { children: ReactNode }) => (
  <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[13px] break-all">{children}</code>
);

export default async function HelpPage() {
  const viewer = await requireViewer("/help");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
  // PUBLIC_URL wins when set (self-hosting behind a tunnel), so the shortcut/bookmark point at the right address.
  const origin = process.env.PUBLIC_URL?.replace(/\/+$/, "") || `${proto}://${host}`;
  const [shortcutUrl, people] = await Promise.all([getSetting("shortcut_url"), getPeople()]);
  const admins = people.filter((p) => p.is_admin).map((p) => p.name);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add from any website</h1>
        <p className="mt-1 text-zinc-500">Found something you like? Here&rsquo;s how to get it onto a list.</p>
      </div>

      <section className={`${card} p-5`}>
        <h2 className="text-lg font-semibold">On iPhone</h2>

        <h3 className="mt-4 font-medium">Easiest: copy the link, then paste</h3>
        <ol className="mt-3 space-y-3 text-[15px] text-zinc-700">
          <Step n={1}>
            In Safari or a shopping app, tap <strong>Share</strong> and then <strong>Copy</strong> (or <strong>Copy Link</strong>).
          </Step>
          <Step n={2}>
            Come back here, tap{" "}
            <Link href="/add" className="font-medium text-zinc-900 underline underline-offset-2">
              Add item
            </Link>
            , then tap <strong>Paste</strong>. We fill in the name, picture and price for you.
          </Step>
        </ol>

        <h3 className="mt-6 font-medium">One tap from the Share button</h3>
        {shortcutUrl ? (
          <div className="mt-3 space-y-3 text-[15px] text-zinc-700">
            <a href={shortcutUrl} className={button()}>
              Get the &ldquo;Add to Family List&rdquo; shortcut
            </a>
            <p>
              Tap <strong>Add Shortcut</strong>. From then on, in any app tap <strong>Share</strong> then{" "}
              <strong>Add to Family List</strong>. The first time, it opens in Safari, so log in there once.
            </p>
          </div>
        ) : viewer.is_admin ? (
          <div className="mt-3 text-[15px] text-zinc-700">
            <p className="mb-3">Set this up once on your iPhone, then share it with everyone (about 3 minutes):</p>
            <ol className="space-y-3">
              <Step n={1}>
                Open the <strong>Shortcuts</strong> app and tap <strong>+</strong>. Name it <strong>Add to Family List</strong>.
              </Step>
              <Step n={2}>
                Tap the <strong>ⓘ</strong> button and turn on <strong>Show in Share Sheet</strong>. In the first block that
                appears, set the input to <strong>URLs</strong>, <strong>Safari web pages</strong> and <strong>Text</strong>.
              </Step>
              <Step n={3}>
                Add the action <strong>Get URLs from Input</strong>, then the action <strong>URL Encode</strong>.
              </Step>
              <Step n={4}>
                Add the action <strong>URL</strong> and type <Code>{origin}/add?url=</Code> then insert the{" "}
                <strong>URL Encoded Text</strong> variable right after it (no spaces).
              </Step>
              <Step n={5}>
                Add the action <strong>Open URLs</strong>. Tap <strong>Done</strong>. Try it from Safari: Share → Add to
                Family List.
              </Step>
              <Step n={6}>
                Share it: long-press the shortcut → <strong>Share</strong> → <strong>Copy iCloud Link</strong>, and paste it
                in{" "}
                <Link href="/family" className="font-medium text-zinc-900 underline underline-offset-2">
                  Family settings
                </Link>
                . Everyone will then see a one-tap install button here.
              </Step>
            </ol>
          </div>
        ) : (
          <p className="mt-2 text-[15px] text-zinc-700">
            Coming soon. {admins.length ? joinNames(admins) : "Your admin"} can set up a one-tap shortcut for everyone.
          </p>
        )}

        <h3 className="mt-6 font-medium">Tip: put Family List on your Home Screen</h3>
        <p className="mt-2 text-[15px] text-zinc-700">
          In Safari, tap <strong>Share</strong> → <strong>Add to Home Screen</strong>. It opens like an app.
        </p>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="text-lg font-semibold">On a computer</h2>
        <p className="mt-2 text-[15px] text-zinc-700">
          Drag this button to your browser&rsquo;s bookmarks bar. Then, on any product page, click it to add that item.
          It reads the page you&rsquo;re looking at, so it works on Amazon too.
        </p>
        <div className="mt-4">
          <Bookmarklet origin={origin} />
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          Don&rsquo;t see a bookmarks bar? Press <Code>⌘ Shift B</Code> on Mac or <Code>Ctrl Shift B</Code> on Windows.
        </p>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="text-lg font-semibold">On Android</h2>
        <p className="mt-2 text-[15px] text-zinc-700">
          In Chrome, open the menu and tap <strong>Add to Home screen</strong> (or <strong>Install app</strong>). After that,
          Family List shows up when you tap <strong>Share</strong> in any app.
        </p>
      </section>
    </div>
  );
}
