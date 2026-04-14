import { useEffect } from 'react';

const PAGE_LABELS = {
  upload:  'Upload',
  browser: 'Browser',
  history: 'History',
  ldap:    'LDAP',
};

const APP_NAME = 'Nexus Pusher';

/**
 * Reactively updates document.title based on the current app state.
 *
 * @param {string}  activePage   - One of: 'upload' | 'browser' | 'history' | 'ldap'
 * @param {object}  [uploadState]
 * @param {number}  uploadState.uploading  - Number of files currently uploading
 * @param {number}  uploadState.pending    - Number of files waiting in queue
 * @param {number}  uploadState.failed     - Number of failed uploads
 *
 * Title patterns:
 *   Uploading:  "⏳ 3 uploading — Nexus Pusher"
 *   Failed:     "⚠️ 2 failed — Upload — Nexus Pusher"
 *   Pending:    "(4 pending) Upload — Nexus Pusher"
 *   Idle page:  "Upload — Nexus Pusher"
 *   Other page: "Browser — Nexus Pusher"
 */
export function useDocumentTitle(activePage, uploadState = {}) {
  const { uploading = 0, pending = 0, failed = 0 } = uploadState;

  useEffect(() => {
    const pageLabel = PAGE_LABELS[activePage] || APP_NAME;

    let title;

    if (activePage === 'upload') {
      if (uploading > 0) {
        // Highest priority: active transfer — use hourglass so it’s visible in tab
        title = `⏳ ${uploading} uploading — ${APP_NAME}`;
      } else if (failed > 0) {
        // Second priority: something needs attention
        title = `⚠️ ${failed} failed — ${pageLabel} — ${APP_NAME}`;
      } else if (pending > 0) {
        // Files staged but not yet pushed
        title = `(${pending} pending) ${pageLabel} — ${APP_NAME}`;
      } else {
        title = `${pageLabel} — ${APP_NAME}`;
      }
    } else {
      title = `${pageLabel} — ${APP_NAME}`;
    }

    document.title = title;
  }, [activePage, uploading, pending, failed]);
}
