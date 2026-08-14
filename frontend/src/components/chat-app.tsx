"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useAuth, UserButton } from "@clerk/nextjs";
import {
  MessageSquare,
  Users,
  Send,
  Settings,
  Check,
  X,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { avatarRamp, initialOf } from "@/lib/utils";
import {
  fetchMe,
  listFriends,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  listDms,
  openDm,
  listMessages,
  sendMessage,
  type Friendship,
  type DmSummary,
  type Message,
} from "@/lib/backend-api";
import { useRealtime } from "@/lib/realtime-context";
import { useSoundSettings } from "@/lib/use-sound-settings";
import { SoundSettingsDialog } from "@/components/sound-settings-dialog";

type View = { kind: "friends" } | { kind: "dm"; dmId: string };

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

type MessageGroup = { senderId: string; messages: Message[] };

// Consecutive messages from the same sender within 5 minutes render as one
// visual group (single avatar/timestamp) instead of repeating chrome per
// message — the actual thing that made the old layout feel flat.
function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const m of messages) {
    const last = groups[groups.length - 1];
    const lastMsg = last?.messages[last.messages.length - 1];
    const closeEnough =
      lastMsg &&
      Math.abs(
        new Date(m.created_at).getTime() -
          new Date(lastMsg.created_at).getTime(),
      ) <
        5 * 60 * 1000;
    if (last && last.senderId === m.sender_id && closeEnough) {
      last.messages.push(m);
    } else {
      groups.push({ senderId: m.sender_id, messages: [m] });
    }
  }
  return groups;
}

function Avatar({
  seed,
  label,
  size = "md",
}: {
  seed: string;
  label: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims =
    size === "sm"
      ? "h-7 w-7 text-xs"
      : size === "lg"
        ? "h-16 w-16 text-2xl"
        : "h-9 w-9 text-sm";
  return (
    <span
      className={`flex flex-none items-center justify-center rounded-full bg-gradient-to-br font-semibold text-[#12151A] shadow-[0_1px_0_rgba(255,255,255,0.3)_inset] ${dims} ${avatarRamp(seed)}`}
    >
      {initialOf(label)}
    </span>
  );
}

// The app's one bold, load-bearing motif: a dot that reflects whether the
// websocket to our own auth-service is actually open right now (see
// realtime-context.tsx `connected`). Real state, not decoration — this is
// a self-hosted app, so "am I actually connected to my own server" is a
// fact worth surfacing.
function SignalDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${
        connected ? "bg-[#5FD9C4] animate-signal-pulse" : "bg-[#8B93A1]/50"
      }`}
      title={connected ? "Live" : "Reconnecting…"}
    />
  );
}

export function ChatApp({
  displayName,
  email,
}: {
  displayName: string;
  email: string;
}) {
  const { getToken } = useAuth();
  const { subscribe, connected } = useRealtime();
  const sound = useSoundSettings();

  const [myId, setMyId] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [dms, setDms] = useState<DmSummary[]>([]);
  const [view, setView] = useState<View>({ kind: "friends" });
  const [messagesByDm, setMessagesByDm] = useState<Record<string, Message[]>>(
    {},
  );
  const [composer, setComposer] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [soundsOpen, setSoundsOpen] = useState(false);
  const [dmFilter, setDmFilter] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshFriends = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      setFriends(await listFriends(token));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load friends");
    }
  }, [getToken]);

  const refreshDms = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      setDms(await listDms(token));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load DMs");
    }
  }, [getToken]);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const me = await fetchMe(token);
        setMyId(me.id);
      } catch (e) {
        setLoadError(
          e instanceof Error
            ? `Backend sync issue: ${e.message}`
            : "Backend sync issue — is the auth-service running?",
        );
      }
    })();
    void refreshFriends();
    void refreshDms();
    // Runs once on mount — refreshFriends/refreshDms are stable-enough
    // callbacks and re-running this on every getToken identity change would
    // refetch on every render for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return subscribe((event) => {
      if (event.type === "message") {
        const m = event.message;
        setMessagesByDm((prev) => {
          const existing = prev[m.dm_id] ?? [];
          if (existing.some((x) => x.id === m.id)) return prev;
          return { ...prev, [m.dm_id]: [...existing, m] };
        });
        setDms((prev) => {
          const idx = prev.findIndex((d) => d.id === m.dm_id);
          if (idx === -1) {
            void refreshDms();
            return prev;
          }
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            last_message: m.content,
            last_message_at: m.created_at,
          };
          updated.sort((a, b) =>
            (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""),
          );
          return updated;
        });
        if (m.sender_id !== myId) {
          void sound.play("message");
        }
      } else if (event.type === "friend_request") {
        void refreshFriends();
        void sound.play("ringtone");
      } else if (event.type === "friend_accepted") {
        void refreshFriends();
      }
    });
  }, [subscribe, myId, refreshFriends, refreshDms, sound]);

  useEffect(() => {
    if (view.kind !== "dm") return;
    const dmId = view.dmId;
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const msgs = await listMessages(token, dmId);
        setMessagesByDm((prev) => ({ ...prev, [dmId]: msgs }));
      } catch (e) {
        setLoadError(
          e instanceof Error ? e.message : "Failed to load messages",
        );
      }
    })();
  }, [view, getToken]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [view, messagesByDm]);

  const acceptedFriends = friends.filter((f) => f.status === "accepted");
  const incoming = friends.filter(
    (f) => f.status === "pending" && f.direction === "incoming",
  );
  const outgoing = friends.filter(
    (f) => f.status === "pending" && f.direction === "outgoing",
  );

  async function handleAddFriend(e: FormEvent) {
    e.preventDefault();
    if (!addUsername.trim()) return;
    setAddBusy(true);
    setAddError(null);
    const token = await getToken();
    if (!token) {
      setAddBusy(false);
      return;
    }
    try {
      await sendFriendRequest(token, addUsername.trim());
      setAddUsername("");
      await refreshFriends();
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : "Failed to send request",
      );
    } finally {
      setAddBusy(false);
    }
  }

  async function handleAccept(id: string) {
    const token = await getToken();
    if (!token) return;
    await acceptFriendRequest(token, id);
    await refreshFriends();
  }

  async function handleDecline(id: string) {
    const token = await getToken();
    if (!token) return;
    await declineFriendRequest(token, id);
    await refreshFriends();
  }

  async function handleOpenDm(friendUserId: string) {
    const token = await getToken();
    if (!token) return;
    try {
      const { id } = await openDm(token, friendUserId);
      await refreshDms();
      setView({ kind: "dm", dmId: id });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to open DM");
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (view.kind !== "dm" || !composer.trim()) return;
    const token = await getToken();
    if (!token) return;
    const content = composer.trim();
    const dmId = view.dmId;
    setComposer("");
    try {
      await sendMessage(token, dmId, content);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Failed to send message",
      );
      setComposer(content);
    }
  }

  const activeDm =
    view.kind === "dm" ? dms.find((d) => d.id === view.dmId) : null;
  const activeMessages =
    view.kind === "dm" ? (messagesByDm[view.dmId] ?? []) : [];
  const activeGroups = groupMessages(activeMessages);
  const activeLabel = activeDm?.other_username ?? activeDm?.other_email ?? "?";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0B0D12]">
      {/* rail */}
      <div className="flex w-[72px] flex-none flex-col items-center gap-2 border-r border-[#1D2129] bg-[#0B0D12] py-3">
        <button
          onClick={() => setView({ kind: "friends" })}
          data-active={view.kind === "friends"}
          className="group relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-b from-[#F3B57E] to-[#EB9A50] font-display text-lg text-[#12151A] shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_10px_24px_-10px_rgba(240,168,104,0.5)] transition-all duration-200 hover:rounded-xl hover:shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_14px_30px_-10px_rgba(240,168,104,0.7)] data-[active=true]:rounded-xl"
          title="NosChat"
        >
          N
          {incoming.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-[#0B0D12] bg-[#EB5757] px-0.5 text-[9px] font-bold text-white">
              {incoming.length}
            </span>
          )}
        </button>
        <div className="mt-auto flex flex-col items-center gap-1.5">
          <SignalDot connected={connected} />
        </div>
      </div>

      {/* sidebar */}
      <div className="noschat-grain flex w-64 flex-none flex-col border-r border-[#1D2129] bg-[#12151B]">
        <div className="flex h-16 flex-none flex-col justify-center border-b border-[#1D2129] px-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8B93A1]/70">
            Self-hosted
          </p>
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl italic leading-none text-[#E8EAED]">
              NosChat
            </span>
            <span className="flex items-center gap-1 rounded-full border border-[#2A2F3A] bg-[#0B0D12]/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#8B93A1]">
              <Radio className="size-2.5" />
              {connected ? "live" : "…"}
            </span>
          </div>
        </div>

        <button
          onClick={() => setView({ kind: "friends" })}
          data-active={view.kind === "friends"}
          className="group relative mx-2 mt-3 flex items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-sm text-[#8B93A1] transition-colors hover:bg-[#1B1F27] hover:text-[#E8EAED] data-[active=true]:bg-[#1B1F27] data-[active=true]:text-[#E8EAED]"
        >
          <span className="absolute inset-y-1 left-0 w-0.5 scale-y-0 rounded-full bg-[#F0A868] transition-transform group-data-[active=true]:scale-y-100" />
          <Users className="size-4 shrink-0" />
          Friends
          {incoming.length > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EB5757] px-1 text-[10px] font-semibold text-white">
              {incoming.length}
            </span>
          )}
        </button>

        <div className="mt-4 flex-1 overflow-y-auto px-2 pb-3">
          <p className="px-2.5 pb-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-[#8B93A1]">
            Direct Messages
          </p>
          {dms.length > 4 && (
            <input
              value={dmFilter}
              onChange={(e) => setDmFilter(e.target.value)}
              placeholder="Filter conversations…"
              className="mx-0.5 mb-1.5 h-8 w-[calc(100%-4px)] rounded-md border border-[#2A2F3A] bg-[#0F1217]/60 px-2.5 text-xs text-[#E8EAED] placeholder:text-[#8B93A1]/60 outline-none focus:border-[#F0A868]/40"
            />
          )}
          {dms.length === 0 && (
            <p className="px-2.5 py-2 text-xs leading-relaxed text-[#8B93A1]/70">
              Add a friend to start a conversation.
            </p>
          )}
          <div className="space-y-0.5">
            {dms
              .filter((dm) => {
                if (!dmFilter.trim()) return true;
                const label = (
                  dm.other_username ??
                  dm.other_email ??
                  ""
                ).toLowerCase();
                return label.includes(dmFilter.trim().toLowerCase());
              })
              .map((dm) => {
                const label = dm.other_username ?? dm.other_email ?? "Unknown";
                return (
                  <button
                    key={dm.id}
                    onClick={() => setView({ kind: "dm", dmId: dm.id })}
                    data-active={view.kind === "dm" && view.dmId === dm.id}
                    className="group relative flex w-full items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[#1B1F27] data-[active=true]:bg-[#1B1F27]"
                  >
                    <span className="absolute inset-y-1 left-0 w-0.5 scale-y-0 rounded-full bg-[#F0A868] transition-transform group-data-[active=true]:scale-y-100" />
                    <Avatar
                      seed={dm.other_user_id ?? label}
                      label={label}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium text-[#E8EAED]">
                          {label}
                        </span>
                        {dm.last_message_at && (
                          <span className="flex-none font-mono text-[10px] text-[#8B93A1]/70">
                            {relativeTime(dm.last_message_at)}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-[#8B93A1]">
                        {dm.last_message ?? "No messages yet"}
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="flex flex-none items-center gap-2 border-t border-[#1D2129] bg-[#0B0D12]/60 px-2.5 py-2.5">
          {/* A plain span wrapper (not a positioned div sibling with its own
              children) so React's server/client tree for Clerk's portal-
              mounted UserButton lines up exactly — nesting it inside a div
              that also held sibling text caused a hydration mismatch. */}
          <span className="relative flex-none">
            <UserButton />
            <span className="pointer-events-none absolute -bottom-0.5 -right-0.5">
              <SignalDot connected={connected} />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#E8EAED]">
              {displayName}
            </p>
            <p className="truncate text-xs text-[#8B93A1]">{email}</p>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setSoundsOpen(true)}
            title="Sound settings"
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </div>

      {/* main */}
      <div className="relative flex min-w-0 flex-1 flex-col bg-[#161A20]">
        {loadError && (
          <div className="flex flex-none items-center justify-between gap-2 border-b border-[#EB5757]/20 bg-[#EB5757]/10 px-4 py-2 text-xs text-[#EB5757]">
            <span>{loadError}</span>
            <button onClick={() => setLoadError(null)} className="shrink-0">
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {view.kind === "friends" ? (
          <>
            <div className="flex h-16 flex-none items-end border-b border-[#1D2129] px-6 pb-3">
              <span className="font-display text-3xl italic text-[#E8EAED]">
                Friends
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <form
                onSubmit={handleAddFriend}
                className="mb-8 flex max-w-md gap-2"
              >
                <Input
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  placeholder="Add a friend by username"
                  className="h-10 rounded-lg border-[#2A2F3A] bg-[#0F1217]/80 text-[#E8EAED] placeholder:text-[#8B93A1]/60 focus-visible:ring-[#F0A868]/25"
                />
                <Button type="submit" disabled={addBusy || !addUsername.trim()}>
                  {addBusy ? "Sending…" : "Send Request"}
                </Button>
              </form>
              {addError && (
                <p className="-mt-6 mb-6 text-xs text-[#EB5757]">{addError}</p>
              )}

              {incoming.length > 0 && (
                <div className="mb-8">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[#8B93A1]">
                    Incoming Requests — {incoming.length}
                  </p>
                  <div className="space-y-1.5">
                    {incoming.map((f) => {
                      const label = f.username ?? f.email;
                      return (
                        <div
                          key={f.id}
                          className="flex items-center gap-3 rounded-xl border border-[#1D2129] bg-[#12151B] px-3 py-2.5 transition-colors hover:border-[#2A2F3A]"
                        >
                          <Avatar seed={f.user_id} label={label} />
                          <span className="min-w-0 flex-1 truncate text-sm text-[#E8EAED]">
                            {label}
                          </span>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleAccept(f.id)}
                            title="Accept"
                            className="hover:bg-[#4ADE80]/10"
                          >
                            <Check className="size-4 text-[#4ADE80]" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleDecline(f.id)}
                            title="Decline"
                            className="hover:bg-[#EB5757]/10"
                          >
                            <X className="size-4 text-[#EB5757]" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {outgoing.length > 0 && (
                <div className="mb-8">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[#8B93A1]">
                    Pending — {outgoing.length}
                  </p>
                  <div className="space-y-1.5">
                    {outgoing.map((f) => {
                      const label = f.username ?? f.email;
                      return (
                        <div
                          key={f.id}
                          className="flex items-center gap-3 rounded-xl border border-[#1D2129] bg-[#12151B]/50 px-3 py-2.5"
                        >
                          <Avatar seed={f.user_id} label={label} />
                          <span className="min-w-0 flex-1 truncate text-sm text-[#8B93A1]">
                            {label} — waiting for response
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-[#8B93A1]">
                  All Friends — {acceptedFriends.length}
                </p>
                {acceptedFriends.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#2A2F3A] px-4 py-8 text-center">
                    <p className="font-display text-xl italic text-[#E8EAED]">
                      Nobody here yet
                    </p>
                    <p className="mt-1 text-sm text-[#8B93A1]">
                      Send a request above to add your first friend.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {acceptedFriends.map((f) => {
                      const label = f.username ?? f.email;
                      return (
                        <div
                          key={f.id}
                          className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-[#1D2129] hover:bg-[#12151B]"
                        >
                          <Avatar seed={f.user_id} label={label} />
                          <span className="min-w-0 flex-1 truncate text-sm text-[#E8EAED]">
                            {label}
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpenDm(f.user_id)}
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <MessageSquare className="size-3.5" /> Message
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex h-16 flex-none items-center gap-3 border-b border-[#1D2129] px-6">
              <Avatar
                seed={activeDm?.other_user_id ?? activeLabel}
                label={activeLabel}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#E8EAED]">
                  {activeLabel}
                </p>
                {activeDm?.other_email && (
                  <p className="truncate text-xs text-[#8B93A1]">
                    {activeDm.other_email}
                  </p>
                )}
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
              {activeGroups.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <Avatar
                    seed={activeDm?.other_user_id ?? activeLabel}
                    label={activeLabel}
                    size="lg"
                  />
                  <h2 className="font-display text-3xl italic text-[#E8EAED]">
                    Say hi to {activeLabel}
                  </h2>
                  <p className="max-w-sm text-sm text-[#8B93A1]">
                    This is the start of your conversation. Messages send and
                    arrive in real time.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeGroups.map((group, gi) => {
                    const mine = group.senderId === myId;
                    const label = mine ? "You" : activeLabel;
                    return (
                      <div
                        key={gi}
                        className={`flex animate-rise-in gap-2.5 ${mine ? "flex-row-reverse" : ""}`}
                      >
                        {!mine && (
                          <Avatar
                            seed={group.senderId}
                            label={label}
                            size="sm"
                          />
                        )}
                        <div
                          className={`flex max-w-[65%] flex-col gap-1 ${mine ? "items-end" : "items-start"}`}
                        >
                          {group.messages.map((m, mi) => (
                            <div
                              key={m.id}
                              className="group/msg flex items-end gap-2"
                            >
                              {mine && (
                                <span className="font-mono text-[10px] text-[#8B93A1]/0 transition-colors group-hover/msg:text-[#8B93A1]/70">
                                  {clockTime(m.created_at)}
                                </span>
                              )}
                              <div
                                className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                                  mine
                                    ? "bg-gradient-to-b from-[#F3B57E] to-[#EB9A50] text-[#12151A]"
                                    : "bg-[#1E232C] text-[#E8EAED]"
                                } ${mi === 0 ? "" : ""}`}
                              >
                                {m.content}
                              </div>
                              {!mine && (
                                <span className="font-mono text-[10px] text-[#8B93A1]/0 transition-colors group-hover/msg:text-[#8B93A1]/70">
                                  {clockTime(m.created_at)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <form onSubmit={handleSend} className="flex-none px-6 pb-5">
              <div className="relative">
                <Input
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  placeholder={`Message ${activeLabel}`}
                  className="h-12 rounded-full border-[#2A2F3A] bg-[#0F1217]/80 pr-12 pl-4 text-[#E8EAED] placeholder:text-[#8B93A1]/60 focus-visible:border-[#F0A868]/50 focus-visible:ring-[#F0A868]/20"
                />
                <Button
                  type="submit"
                  size="icon"
                  variant="ghost"
                  disabled={!composer.trim()}
                  className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full text-[#8B93A1] disabled:opacity-30"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </form>
          </>
        )}
      </div>

      <SoundSettingsDialog
        open={soundsOpen}
        onClose={() => setSoundsOpen(false)}
        sound={sound}
      />
    </div>
  );
}
