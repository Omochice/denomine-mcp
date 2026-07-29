//! Minimal C-ABI wrapper over the `keyring` crate for the Deno FFI binding.
//! Implements ADR-0003: a Rust `keyring` crate reachable from Deno via `dlopen`.

use std::ffi::{c_char, c_int, CStr, CString};
use std::ptr;
use std::sync::Once;

use keyring_core::Entry;
use security_framework::item::{ItemClass, ItemSearchOptions, Limit};

/// `errSecItemNotFound` from the macOS Security framework. The keychain reports
/// an empty match as this error rather than an empty result set, so we treat it
/// as "no accounts" instead of a failure.
const ERR_SEC_ITEM_NOT_FOUND: i32 = -25300;

static STORE: Once = Once::new();

/// Install the platform's credential store as `keyring-core`'s default.
///
/// `keyring-core` holds no store until one is registered, so every exported
/// function calls this first: a `cdylib` has no initialisation hook of its own
/// and the caller cannot be asked to invoke one across the C ABI.
///
/// On Linux the Secret Service is chosen over kernel keyutils because keyutils
/// keys do not outlive the session, and a credential that disappears at logout
/// is not the persistent keyring ADR-0003 asks for.
fn ensure_store() {
    STORE.call_once(|| {
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        let store = apple_native_keyring_store::keychain::Store::new();
        #[cfg(target_os = "windows")]
        let store = windows_native_keyring_store::Store::new();
        #[cfg(all(
            unix,
            not(any(target_os = "macos", target_os = "ios", target_os = "android"))
        ))]
        let store = zbus_secret_service_keyring_store::Store::new();

        if let Ok(store) = store {
            keyring_core::set_default_store(store);
        }
    });
}

/// Convert a borrowed C string into an owned Rust `String`.
///
/// # Safety
/// `p` must be null or a valid, NUL-terminated C string.
unsafe fn to_string(p: *const c_char) -> Option<String> {
    if p.is_null() {
        return None;
    }
    CStr::from_ptr(p).to_str().ok().map(|s| s.to_owned())
}

/// Store `password` for (`service`, `account`) in the OS keyring.
/// Returns 0 on success, negative on failure.
#[no_mangle]
pub extern "C" fn keyring_set(
    service: *const c_char,
    account: *const c_char,
    password: *const c_char,
) -> c_int {
    let (Some(service), Some(account), Some(password)) = (unsafe { to_string(service) }, unsafe {
        to_string(account)
    }, unsafe {
        to_string(password)
    }) else {
        return -1;
    };
    ensure_store();
    match Entry::new(&service, &account).and_then(|e| e.set_password(&password)) {
        Ok(()) => 0,
        Err(_) => -2,
    }
}

/// Read the password for (`service`, `account`).
/// Returns a heap-allocated C string the caller must free with
/// `keyring_string_free`, or null on failure.
#[no_mangle]
pub extern "C" fn keyring_get(service: *const c_char, account: *const c_char) -> *mut c_char {
    let (Some(service), Some(account)) =
        (unsafe { to_string(service) }, unsafe { to_string(account) })
    else {
        return ptr::null_mut();
    };
    ensure_store();
    match Entry::new(&service, &account).and_then(|e| e.get_password()) {
        Ok(password) => CString::new(password)
            .map(CString::into_raw)
            .unwrap_or(ptr::null_mut()),
        Err(_) => ptr::null_mut(),
    }
}

/// Delete the stored password for (`service`, `account`).
/// Returns 0 on success, negative on failure. A missing entry counts as success
/// so that deletion is idempotent, matching the `Keyring` port contract.
#[no_mangle]
pub extern "C" fn keyring_delete(service: *const c_char, account: *const c_char) -> c_int {
    let (Some(service), Some(account)) =
        (unsafe { to_string(service) }, unsafe { to_string(account) })
    else {
        return -1;
    };
    ensure_store();
    match Entry::new(&service, &account).and_then(|e| e.delete_credential()) {
        Ok(()) => 0,
        Err(keyring_core::Error::NoEntry) => 0,
        Err(_) => -2,
    }
}

/// List the accounts stored under `service`, one per line ("\n"-separated).
/// Returns a heap C string the caller frees with `keyring_string_free`, an
/// empty string if there are none, or null on error.
#[no_mangle]
pub extern "C" fn keyring_list(service: *const c_char) -> *mut c_char {
    let Some(service) = (unsafe { to_string(service) }) else {
        return ptr::null_mut();
    };

    // The `keyring` crate cannot enumerate items, so we query the macOS keychain
    // directly. `ItemSearchOptions` offers no per-service filter, so we request
    // every generic-password's attributes and match the service ("svce") in
    // code. Only attributes are loaded, not the passwords, to avoid unlock
    // prompts for secrets we never read.
    let results = ItemSearchOptions::new()
        .class(ItemClass::generic_password())
        .load_attributes(true)
        .limit(Limit::All)
        .search();
    let results = match results {
        Ok(results) => results,
        Err(error) if error.code() == ERR_SEC_ITEM_NOT_FOUND => Vec::new(),
        Err(_) => return ptr::null_mut(),
    };

    let mut accounts: Vec<String> = Vec::new();
    for result in results {
        let Some(attributes) = result.simplify_dict() else {
            continue;
        };
        if attributes.get("svce").map(String::as_str) != Some(service.as_str()) {
            continue;
        }
        // Skip items without an account, and dedupe so a duplicated keychain
        // entry never yields the same endpoint twice.
        if let Some(account) = attributes.get("acct") {
            if !accounts.iter().any(|existing| existing == account) {
                accounts.push(account.clone());
            }
        }
    }

    // Endpoint URLs never contain a newline, so joining on "\n" stays
    // unambiguous; an empty `accounts` yields an empty string.
    CString::new(accounts.join("\n"))
        .map(CString::into_raw)
        .unwrap_or(ptr::null_mut())
}

/// Free a C string previously returned by `keyring_get`.
///
/// # Safety
/// `p` must be null or a pointer obtained from `keyring_get`.
#[no_mangle]
pub extern "C" fn keyring_string_free(p: *mut c_char) {
    if !p.is_null() {
        unsafe { drop(CString::from_raw(p)) };
    }
}
