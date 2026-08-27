"use client";

import * as React from "react";
import { PanelLeft, PanelLeftClose, Plus, Settings2 } from "lucide-react";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Chat } from "@/components/chat/chat";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { AssistantDialog } from "@/components/settings/assistant-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { AppStoreProvider, useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

function Shell() {
  const { newConversation, currentConfig, configs, preferences } = useAppStore();
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [assistantOpen, setAssistantOpen] = React.useState(false);
  // 桌面端折叠
  const [collapsed, setCollapsed] = React.useState(false);
  // 移动端抽屉
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const openSettings = React.useCallback(() => setSettingsOpen(true), []);

  const hasConfig = configs.length > 0 && !!currentConfig;
  const bgOpacity = Math.max(
    0,
    Math.min(100, preferences.chatBackgroundOpacity ?? 20)
  );

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      {/* 桌面端 Sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 border-r transition-all duration-200 md:block",
          collapsed ? "w-0 overflow-hidden border-r-0" : "w-72"
        )}
      >
        <Sidebar onOpenSettings={openSettings} />
      </aside>

      {/* 移动端抽屉 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 animate-fade-in"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 h-full w-[85%] max-w-xs border-r bg-background animate-fade-in">
            <Sidebar
              onOpenSettings={() => {
                setMobileOpen(false);
                openSettings();
              }}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* 主区域 */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* 自定义聊天背景（底层，随明暗主题底色混合） */}
        {preferences.chatBackground && (
          <div
            className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${preferences.chatBackground})`,
              opacity: bgOpacity / 100,
            }}
            aria-hidden
          />
        )}

        {/* 顶栏：左（侧栏/新建）· 中（Provider · Model）· 右（主题开关） */}
        <header className="relative z-10 flex h-12 shrink-0 items-center justify-between border-b px-2 sm:px-3">
          <div className="flex items-center gap-0.5">
            {/* 桌面折叠按钮 */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden md:inline-flex"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
              title={collapsed ? "展开侧边栏" : "折叠侧边栏"}
            >
              {collapsed ? <PanelLeft /> : <PanelLeftClose />}
            </Button>
            {/* 移动端菜单按钮 */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="打开菜单"
            >
              <PanelLeft />
            </Button>
            {/* 新建对话（移动端始终显示；桌面折叠后显示） */}
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn(collapsed ? "hidden md:inline-flex" : "md:hidden")}
              onClick={() => newConversation()}
              aria-label="新建对话"
              title="新建对话"
            >
              <Plus />
            </Button>
          </div>

          {/* 中间：AI 名称 */}
          <div className="pointer-events-none absolute inset-x-0 flex items-center justify-center px-16">
            <span className="max-w-full truncate text-sm font-medium text-foreground">
              {hasConfig ? preferences.aiName : "AI Chat"}
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            {/* 右上角：明暗主题开关 */}
            <ThemeToggle />
            {/* 右上角：对话设置（AI 名字 / 头像 / 预制 Prompt） */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setAssistantOpen(true)}
              aria-label="对话设置"
              title="对话设置"
            >
              <Settings2 />
            </Button>
          </div>
        </header>

        <Chat onOpenSettings={openSettings} />
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AssistantDialog open={assistantOpen} onOpenChange={setAssistantOpen} />
    </div>
  );
}

export function AppShell() {
  return (
    <AppStoreProvider>
      <Shell />
    </AppStoreProvider>
  );
}
