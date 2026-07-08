import React from 'react';
import toast from 'react-hot-toast';

/** Fixed id so re-running Debug replaces the previous note (and we can dismiss it). */
export const DEBUG_NOTE_TOAST_ID = 'ai-debug-note';

/**
 * Show the AI's overall "note" for a Debug run as a dismissible toast. This is
 * the channel for systemic issues that aren't tied to a single line (a wrong
 * overall approach, a missing case, missing output/initialisation, …). When
 * `systemic` (the AI returned no specific lines) it's styled more prominently.
 */
export function showDebugNote(text: string, systemic: boolean): void {
  toast.custom(
    t => (
      <div
        style={{
          maxWidth: 400,
          maxHeight: 240,
          overflowY: 'auto',
          background: '#1f2430',
          color: '#e8e8e8',
          border: `1px solid ${systemic ? '#f59e0b' : '#10b981'}`,
          borderRadius: 8,
          padding: '12px 14px',
          boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span style={{ fontWeight: 650 }}>
            {systemic ? '🐞 AI Debug — summary' : '🐞 AI Debug — note'}
          </span>
          <button
            type="button"
            onClick={() => toast.dismiss(t.id)}
            aria-label="Close note"
            style={{
              background: 'transparent',
              color: '#9aa0aa',
              border: 'none',
              cursor: 'pointer',
              fontSize: 15,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
      </div>
    ),
    { id: DEBUG_NOTE_TOAST_ID, duration: Infinity, position: 'bottom-right' }
  );
}

export function dismissDebugNote(): void {
  toast.dismiss(DEBUG_NOTE_TOAST_ID);
}
