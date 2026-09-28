/**
 * Local development points to the loopback-only AdminTool container.
 * Production builds must set OSIRIS_ADMINTOOL_URL to the client's HTTPS URL.
 */
export const ADMINTOOL_URL = process.env.OSIRIS_ADMINTOOL_URL?.trim() || 'http://127.0.0.1:18080'
