"use client";

import * as React from "react";
import {
  Settings as SettingsIcon,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AiAvatar } from "@/components/chat/ai-avatar";
import { useAppStore } from "@/lib/store/app-store";
import { DEFAULT_PREFERENCES } from "@/lib/storage";
import { getConversationLastPreview, getDateGroupLabel, cn } from "@/lib/utils";
import type { Conversation } from "@/types";

interface SidebarProps {
  onOpenSettings: () => void;
  /** 在移动端点击会话后关闭抽屉 */
  onNavigate?: () => void;
}

const GROUP_ORDER = ["今天", "昨天", "过去 7 天", "更早"];

function getConversationAiName(conv: Conversation): string {
  return conv.preferences?.aiName?.trim() || DEFAULT_PREFERENCES.aiName;
}

export function Sidebar({ onOpenSettings, onNavigate }: SidebarProps) {
  const {
    conversations,
    currentConversationId,
    selectConversation,
    deleteConversation,
    renameConversation,
  } = useAppStore();

  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(
    null
  );
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");

  const grouped = React.useMemo(() => {
    const sorted = [...conversations].sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
    const map = new Map<string, Conversation[]>();
    for (const conv of sorted) {
      const label = getDateGroupLabel(conv.updatedAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(conv);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      label: g,
      items: map.get(g)!,
    }));
  }, [conversations]);

  const startRename = (conv: Conversation) => {
    setRenamingId(conv.id);
    setRenameValue(getConversationAiName(conv));
  };

  const commitRename = () => {
    if (renamingId) renameConversation(renamingId, renameValue);
    setRenamingId(null);
  };

  return (
    <div className="flex h-full flex-col bg-secondary/40">
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3">
        {conversations.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            还没有对话
          </p>
        ) : (
          grouped.map((group) => (
            <div key={group.label} className="mb-2">
              <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((conv) => {
                  const active = conv.id === currentConversationId;
                  const isRenaming = renamingId === conv.id;
                  const prefs = conv.preferences ?? DEFAULT_PREFERENCES;

                  return (
                    <div
                      key={conv.id}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors",
                        active
                          ? "bg-accent"
                          : "hover:bg-accent/60 cursor-pointer"
                      )}
                      onClick={() => {
                        if (isRenaming) return;
                        selectConversation(conv.id);
                        onNavigate?.();
                      }}
                    >
                      <AiAvatar
                        avatarId={prefs.aiAvatarId}
                        customAvatar={prefs.customAvatar}
                        className="h-10 w-10 shrink-0 rounded-lg"
                      />

                      {isRenaming ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="min-w-0 flex-1 rounded border bg-background px-1.5 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
                        />
                      ) : (
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium leading-5">
                            {getConversationAiName(conv)}
                          </p>
                          <p className="truncate text-xs leading-4 text-muted-foreground">
                            {getConversationLastPreview(conv)}
                          </p>
                        </div>
                      )}

                      {!isRenaming && (
                        <div
                          className={cn(
                            "shrink-0",
                            active
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100"
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Dropdown
                            align="end"
                            trigger={
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="h-6 w-6"
                                aria-label="更多"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            }
                          >
                            {(close) => (
                              <>
                                <DropdownItem
                                  onClick={() => {
                                    startRename(conv);
                                    close();
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                  重命名
                                </DropdownItem>
                                <DropdownItem
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setConfirmDeleteId(conv.id);
                                    close();
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  删除
                                </DropdownItem>
                              </>
                            )}
                          </Dropdown>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t p-3">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={onOpenSettings}
        >
          <SettingsIcon />
          Settings
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
        title="删除对话"
        description="确定要删除这个对话吗？聊天记录将被永久删除。"
        confirmText="删除"
        destructive
        onConfirm={() => {
          if (confirmDeleteId) deleteConversation(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
      />
    </div>
  );
}
