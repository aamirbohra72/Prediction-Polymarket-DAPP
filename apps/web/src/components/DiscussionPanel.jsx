"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export default function DiscussionPanel({
  marketId,
  user,
  comments,
  followingIds,
  onRefresh,
  onError,
}) {
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState(null);

  async function postComment(e) {
    e.preventDefault();
    if (!user) return;
    try {
      await api.postComment(marketId, commentText, replyTo);
      setCommentText("");
      setReplyTo(null);
      await onRefresh?.();
    } catch (err) {
      onError?.(err.message);
    }
  }

  async function toggleLike(commentId, liked) {
    if (!user) return;
    try {
      if (liked) await api.unlikeComment(marketId, commentId);
      else await api.likeComment(marketId, commentId);
      await onRefresh?.();
    } catch (err) {
      onError?.(err.message);
    }
  }

  async function toggleFollow(authorId, isFollowing) {
    if (!user) return;
    try {
      if (isFollowing) await api.unfollowUser(authorId);
      else await api.followUser(authorId);
      await onRefresh?.();
    } catch (err) {
      onError?.(err.message);
    }
  }

  return (
    <div
      id="discussion"
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6"
    >
      <h2 className="mb-4 font-semibold">Discussion</h2>
      <ul className="mb-4 max-h-72 space-y-3 overflow-y-auto text-sm">
        {comments.map((c) => (
          <li key={c.id} className="rounded-lg bg-[var(--bg)] p-3">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-medium">{c.author}</span>
              {user && c.authorId && c.authorId !== user.id && (
                <button
                  type="button"
                  onClick={() => toggleFollow(c.authorId, followingIds?.has(c.authorId))}
                  className="text-[10px] text-[var(--accent)] hover:underline"
                >
                  {followingIds?.has(c.authorId) ? "Unfollow" : "Follow"}
                </button>
              )}
            </div>
            <p className="text-[var(--muted)]">{c.body}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              {user ? (
                <>
                  <button
                    type="button"
                    onClick={() => toggleLike(c.id, c.likedByMe)}
                    className={c.likedByMe ? "text-[var(--accent)]" : "text-[var(--muted)]"}
                  >
                    ♥ {c.likeCount || 0}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(c.id);
                      setCommentText(`@${String(c.author || "trader").replace(/\s/g, "")} `);
                    }}
                    className="text-[var(--muted)] hover:text-[var(--accent)]"
                  >
                    Reply
                  </button>
                </>
              ) : (
                <span className="text-[var(--muted)]">♥ {c.likeCount || 0}</span>
              )}
            </div>
            {c.replies?.length > 0 && (
              <ul className="mt-2 space-y-2 border-l border-[var(--border)] pl-3">
                {c.replies.map((r) => (
                  <li key={r.id}>
                    <span className="font-medium">{r.author}</span>
                    <p className="text-[var(--muted)]">{r.body}</p>
                    {user && (
                      <button
                        type="button"
                        onClick={() => toggleLike(r.id, r.likedByMe)}
                        className={`mt-1 text-xs ${
                          r.likedByMe ? "text-[var(--accent)]" : "text-[var(--muted)]"
                        }`}
                      >
                        ♥ {r.likeCount || 0}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {user && (
        <form onSubmit={postComment} className="space-y-2">
          {replyTo && (
            <p className="text-xs text-[var(--muted)]">
              Replying…{" "}
              <button
                type="button"
                className="text-[var(--accent)]"
                onClick={() => setReplyTo(null)}
              >
                Cancel
              </button>
            </p>
          )}
          <div className="flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment… use @Name to mention"
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-white"
            >
              Post
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
