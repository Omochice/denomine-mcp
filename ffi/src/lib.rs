//! Minimal C-ABI wrapper over the `keyring` crate for the Deno FFI binding.
//! Implements ADR-0003: a Rust `keyring` crate reachable from Deno via `dlopen`.

use std::ffi::{c_char, c_int, CStr, CString};
use std::ptr;

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
    match keyring::Entry::new(&service, &account).and_then(|e| e.set_password(&password)) {
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
    match keyring::Entry::new(&service, &account).and_then(|e| e.get_password()) {
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
    match keyring::Entry::new(&service, &account).and_then(|e| e.delete_credential()) {
        Ok(()) => 0,
        Err(keyring::Error::NoEntry) => 0,
        Err(_) => -2,
    }
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
