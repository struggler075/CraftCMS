package com.craftcms.model;

/**
 * Types of admin actions captured by the audit log. Append-only —
 * never rename or remove a value, since old log rows reference these
 * names by string.
 */
public enum AuditAction {
    USER_BALANCE_CHANGE,
    USER_PASSWORD_RESET,
    USER_ROLE_CHANGE,
    USER_BLOCK,
    USER_UNBLOCK,
    USER_DELETE,
    USER_FORCE_LOGOUT,
    SETTINGS_UPDATE,
    SETTINGS_RESTORE,
}
