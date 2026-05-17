function cleanServerMessage(message) {
  const text = String(message || '').trim();
  if (!text) return '';
  if (/^HTTP \d{3}$/i.test(text) || /^Backend returned HTTP \d{3}$/i.test(text)) return '';
  return text.replace(/^Error:\s*/i, '');
}

function nextStepForStatus(status, action) {
  if (status === 400 || status === 422) {
    return `Check the fields and try ${action || 'again'}.`;
  }
  if (status === 401 || status === 403) {
    return 'Check your Nexus username, password, and repository permissions, then try again.';
  }
  if (status === 404) {
    return 'Confirm the repository or asset still exists, then refresh and try again.';
  }
  if (status === 409) {
    return 'Review the existing item in Nexus, then retry only if replacing it is intended.';
  }
  if (status === 413) {
    return 'Use a smaller file or ask the deployer to raise the upload size limit.';
  }
  if (status >= 500) {
    return 'Wait a moment, then retry. If it keeps failing, check the backend and Nexus logs.';
  }
  return `Try ${action || 'again'}.`;
}

export function createHttpError(status, serverMessage, options = {}) {
  const detail = cleanServerMessage(serverMessage);
  let message;

  if (status === 400 || status === 422) {
    message = detail || 'The request was missing required information.';
  } else if (status === 401) {
    message = 'Nexus rejected the credentials.';
  } else if (status === 403) {
    message = 'Nexus denied access for this user.';
  } else if (status === 404) {
    message = 'The requested Nexus resource was not found.';
  } else if (status === 409) {
    message = detail || 'Nexus reported a conflict with an existing item.';
  } else if (status === 413) {
    message = 'The file is larger than this deployment allows.';
  } else if (status >= 500) {
    message = 'The server could not complete the request.';
  } else {
    message = detail || 'The request could not be completed.';
  }

  const error = new Error(`${message} ${nextStepForStatus(status, options.action)}`);
  error.status = status;
  error.userMessage = error.message;
  error.serverMessage = detail;
  return error;
}

export function createNetworkError(options = {}) {
  const error = new Error(`Cannot reach the backend. Check your network connection and confirm the backend is running, then try ${options.action || 'again'}.`);
  error.isNetworkError = true;
  error.userMessage = error.message;
  return error;
}

export function createTimeoutError(options = {}) {
  const error = new Error(`The request timed out. Check the connection to Nexus and try ${options.action || 'again'}.`);
  error.isTimeoutError = true;
  error.userMessage = error.message;
  return error;
}

export function formatUserError(error, options = {}) {
  if (!error) return options.fallback || 'Something went wrong. Try again.';
  if (error.userMessage) return error.userMessage;
  if (error.name === 'AbortError') return options.abortMessage || 'Canceled by user.';
  if (error.name === 'TypeError' || /failed to fetch|networkerror|load failed|econnrefused|econnreset|etimedout|enotfound/i.test(error.message || '')) {
    return createNetworkError(options).message;
  }
  const status = error.status || Number((error.message || '').match(/HTTP (\d{3})/i)?.[1]);
  if (status) return createHttpError(status, error.serverMessage || error.message, options).message;

  const detail = cleanServerMessage(error.message);
  if (!detail) return options.fallback || `The request could not be completed. Try ${options.action || 'again'}.`;
  if (/[.!?]$/.test(detail)) return `${detail} ${options.nextStep || `Try ${options.action || 'again'}.`}`;
  return `${detail}. ${options.nextStep || `Try ${options.action || 'again'}.`}`;
}
