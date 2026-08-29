//! App-level single-instance backstop (Windows).
//!
//! `tauri-plugin-single-instance` on Windows creates a named mutex and then a
//! hidden message window. When two launches overlap (double-click, or an
//! updater restart racing the old process's teardown), the losing launch can
//! observe the mutex before the hidden window exists — or after it was torn
//! down. In that state the plugin does NOT exit (its `FindWindowW` lookup
//! misses) and keeps a mutex handle alive, so the singleton never heals and
//! every later launch piles up another instance. This guard is the second
//! layer: an app-owned mutex acquired before any window/database work. A
//! losing launch focuses the winner's main window (polling briefly while it
//! comes up) and exits immediately without holding a handle, so the guard
//! itself can never leak.

use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use windows::core::{PCWSTR, PWSTR};
use windows::Win32::Foundation::{
    CloseHandle, GetLastError, ERROR_ALREADY_EXISTS, FALSE, HANDLE, HWND, LPARAM, TRUE,
};
use windows::Win32::System::Threading::{
    CreateMutexW, OpenProcess, QueryFullProcessImageNameW, ReleaseMutex, PROCESS_NAME_WIN32,
    PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetClassNameW, GetWindowTextW, GetWindowThreadProcessId, SetForegroundWindow,
    ShowWindow, SW_RESTORE,
};

/// App-owned singleton name, deliberately independent of the plugin's
/// `{identifier}-sim` mutex so a broken plugin state never blocks the guard.
const GUARD_MUTEX_NAME: &str = "com.readaware.app-singleton";
/// How long a losing launch waits for the winner's main window to appear.
const WINNER_WAIT_MS: u64 = 3_000;
const POLL_INTERVAL_MS: u64 = 100;
/// wry's default window class plus this product's window title
/// (tauri.conf.json `app.windows[].title`).
const MAIN_WINDOW_CLASS: &str = "Tauri Window";
const MAIN_WINDOW_TITLE: &str = "ReadAware";
const DESKTOP_EXE_NAME: &str = "read-aware-desktop.exe";

/// A kernel `HANDLE` value. `Send + Sync` is sound: a handle is an
/// opaque reference owned by the process, safe to move between threads
/// (the single-instance plugin stores the same value in Tauri state).
#[derive(Clone, Copy)]
pub struct GuardHandle(HANDLE);
// SAFETY: HANDLE is an opaque kernel object reference (pointer-sized
// integer); transferring it between threads never dereferences it.
unsafe impl Send for GuardHandle {}
unsafe impl Sync for GuardHandle {}

/// Holds the guard mutex handle for the process lifetime; released on exit.
pub struct GuardState(pub Mutex<Option<GuardHandle>>);

/// Acquire the singleton guard. Must run before any window or DB work.
///
/// Returns `Some(handle)` when this instance owns the singleton — the caller
/// keeps it in [`GuardState`] and releases it on `RunEvent::Exit`. Returns
/// `None` when this instance is a duplicate (it focuses the existing window
/// and exits, so this call never returns), or when guarding failed and
/// startup should continue without it.
pub fn acquire(app: &AppHandle) -> Option<GuardHandle> {
    let name: Vec<u16> = GUARD_MUTEX_NAME
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    let handle = unsafe { CreateMutexW(None, true, PCWSTR(name.as_ptr())) };
    match handle {
        Ok(handle) => {
            if unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
                // The winner exists, but the plugin may not have its hidden
                // window up; focus the winner's main window and leave.
                duplicate_exit(app);
            }
            Some(GuardHandle(handle))
        }
        Err(error) => {
            log::error!("single-instance guard: CreateMutexW failed: {error}");
            None
        }
    }
}

/// Focus the winner's main window (if it has appeared yet) and exit without
/// holding any handle.
fn duplicate_exit(app: &AppHandle) -> ! {
    let deadline = std::time::Instant::now() + std::time::Duration::from_millis(WINNER_WAIT_MS);
    loop {
        if let Some(hwnd) = find_main_window() {
            unsafe {
                let _ = ShowWindow(hwnd, SW_RESTORE);
                let _ = SetForegroundWindow(hwnd);
            }
            break;
        }
        if std::time::Instant::now() >= deadline {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(POLL_INTERVAL_MS));
    }
    log::info!("single-instance guard: another instance is running; exiting");
    app.cleanup_before_exit();
    std::process::exit(0);
}

/// Release the guard mutex on the way out so the next launch owns the
/// singleton immediately. No-op for instances that never acquired it.
pub fn release(app: &AppHandle) {
    let Some(state) = app.try_state::<GuardState>() else {
        return;
    };
    let guard_state: &GuardState = &state;
    let handle = guard_state.0.lock().ok().and_then(|mut guard| guard.take());
    if let Some(GuardHandle(handle)) = handle {
        unsafe {
            let _ = ReleaseMutex(handle);
            let _ = CloseHandle(handle);
        }
    }
}

/// Find the ReadAware main window of a *different* process.
fn find_main_window() -> Option<HWND> {
    let mut found: Option<HWND> = None;
    let ctx = LPARAM((&mut found as *mut Option<HWND>) as isize);
    unsafe {
        let _ = EnumWindows(Some(enum_main_window), ctx);
    }
    found
}

unsafe extern "system" fn enum_main_window(hwnd: HWND, lparam: LPARAM) -> windows::core::BOOL {
    let mut pid = 0u32;
    GetWindowThreadProcessId(hwnd, Some(&mut pid));
    // Defensive: never treat our own (future) window as the winner.
    if pid == std::process::id() || !matches_main_window(hwnd) || !is_read_aware_process(pid) {
        return TRUE;
    }
    let out = lparam.0 as *mut Option<HWND>;
    *out = Some(hwnd);
    FALSE
}

/// True when the window is wry's main window carrying the app title.
unsafe fn matches_main_window(hwnd: HWND) -> bool {
    let mut class = [0u16; 64];
    let class_len = GetClassNameW(hwnd, &mut class);
    if class_len <= 0 {
        return false;
    }
    let class_name = String::from_utf16_lossy(&class[..class_len as usize]);
    if class_name != MAIN_WINDOW_CLASS {
        return false;
    }
    let mut title = [0u16; 256];
    let title_len = GetWindowTextW(hwnd, &mut title);
    if title_len <= 0 {
        return false;
    }
    String::from_utf16_lossy(&title[..title_len as usize]) == MAIN_WINDOW_TITLE
}

/// True when the window belongs to `read-aware-desktop.exe`. The query is
/// same-user and should never be denied; on failure we conservatively reject.
fn is_read_aware_process(pid: u32) -> bool {
    let result = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) };
    let Ok(process) = result else {
        return false;
    };
    let mut path = [0u16; 512];
    let mut size = path.len() as u32;
    let queried = unsafe {
        QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            PWSTR(path.as_mut_ptr()),
            &mut size,
        )
    };
    let _ = unsafe { CloseHandle(process) };
    if queried.is_err() || size == 0 {
        return false;
    }
    let exe = String::from_utf16_lossy(&path[..size as usize]);
    exe.to_ascii_lowercase().ends_with(DESKTOP_EXE_NAME)
}
