// WorkTop 桌面版入口：数据目录布局与 Lite 一致（Markdown 真源 + Obsidian 共写）。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai;
mod commands;
mod error;
mod store;

use commands::AppState;
use std::sync::Mutex;

/// 托盘：仅保留「退出程序」
fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::TrayIconBuilder;

    let quit = MenuItem::with_id(app, "quit", "退出程序", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&quit])?;

    let mut builder = TrayIconBuilder::with_id("worktop-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("WorkTop")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    builder.build(app)?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            use tauri::Manager;
            let app_data = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("无法定位应用数据目录：{e}"))?;
            let root = commands::resolve_root(app_data);
            commands::ensure_layout(&root);
            let state = AppState {
                root: Mutex::new(root),
                vault_key: Mutex::new(None),
                ai_undo: Mutex::new(std::collections::HashMap::new()),
            };
            // 旧版数据迁移（资产.md 内嵌凭据 → 凭据.md）与钥匙串静默解锁
            commands::assets::migrate_credential_split(&state);
            commands::assets::try_autounlock(&state);
            app.manage(state);
            let _ = setup_tray(app);

            // 吉祥物右键菜单事件（与托盘菜单分开监听）
            app.on_menu_event(|app, event| {
                if event.id().as_ref() == "mascot-quit" {
                    app.exit(0);
                }
            });

            // 主窗口关闭 = 隐藏（Dock 常驻模型：关掉桌面不退出应用，可从 Dock 重新唤出）
            if let Some(main) = app.get_webview_window("main") {
                let handle = main.clone();
                main.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = handle.hide();
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 文档
            commands::todo_get,
            commands::todo_put,
            commands::nav_get,
            commands::nav_put,
            commands::note_get,
            commands::note_put,
            commands::keysdocs_list,
            commands::keysdocs_meta,
            commands::keysdoc_put,
            commands::keysdoc_delete,
            // 资产 / 凭据 / 保险库
            commands::assets::assets_list,
            commands::assets::asset_create,
            commands::assets::asset_update,
            commands::assets::asset_delete,
            commands::assets::group_rename,
            commands::assets::asset_link_add,
            commands::assets::asset_link_delete,
            commands::assets::asset_cred_add,
            commands::assets::cred_update,
            commands::assets::cred_delete,
            commands::assets::cred_secret_get,
            commands::assets::vault_state_get,
            commands::assets::vault_enable,
            commands::assets::vault_unlock,
            commands::assets::vault_lock,
            commands::assets::vault_disable,
            commands::assets::asset_check,
            // 元信息 / 打开外部链接
            commands::app_info,
            commands::open_external,
            commands::pane_open,
            commands::pane_close,
            commands::cursor_pos,
            commands::taskbar_hide,
            commands::taskbar_show,
            commands::taskbar_visible,
            commands::app_quit,
            commands::snip_region,
            commands::snip_capture,
            // AI 助手（远端算力 + 工具调用）
            ai::ai_config_get,
            ai::ai_config_set,
            ai::ai_key_set,
            ai::ai_key_clear,
            ai::ai_sessions,
            ai::ai_history,
            ai::ai_new_session,
            ai::ai_delete_session,
            ai::ai_memory_get,
            ai::ai_memory_set,
            ai::ai_undo,
            ai::ai_stop,
            ai::ai_send,
            // 数据目录（查看 / 迁移）
            commands::data_path_get,
            commands::data_path_set,
            // 桌面层（吉祥物 + 桌面卡片）
            commands::desktop::desktop_state,
            commands::desktop::desktop_save,
            commands::desktop::mascot_open,
            commands::desktop::mascot_close,
            commands::desktop::mascot_menu_open,
            commands::desktop::mascot_menu_close,
            commands::desktop::mascot_context_menu,
            commands::desktop::main_hide,
            commands::desktop::cards_sync,
            commands::desktop::cards_close,
            commands::desktop::card_save_rect,
            commands::desktop::card_to_bottom,
            commands::desktop::card_positions,
            // Dock（桌面级悬浮窗 + 应用发现/启动/运行状态）
            commands::dock::dock_scan,
            commands::dock::dock_launch,
            commands::dock::dock_toggle,
            commands::dock::dock_reveal,
            commands::dock::dock_running,
            commands::dock::dock_open,
            commands::dock::dock_close,
            commands::dock::dock_is_open,
            commands::dock::dock_geometry,
            commands::dock::dock_add_shortcut,
            // 应用启动器（用户指定文件夹，列出全部快捷方式）
            commands::apps::apps_list,
            commands::apps::apps_set_dir,
            commands::apps::apps_set_pinned,
            commands::apps::apps_launch,
            commands::apps::apps_open_folder,
            commands::apps::apps_suggest_dir,
        ])
        .run(tauri::generate_context!())
        .expect("Worktop 启动失败");
}
