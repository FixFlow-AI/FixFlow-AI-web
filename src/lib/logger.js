export const logger = {
  error: (title, error, context = {}) => {
    console.error(
      `%c[Error: ${title}]%c ${error?.message || error || 'Unknown Error'}\n`,
      'color: #ef4444; font-weight: bold; font-size: 11px;',
      'color: inherit;',
      {
        error,
        context,
        timestamp: new Date().toISOString(),
      }
    );
  },
  warn: (title, message, context = {}) => {
    console.warn(
      `%c[Warning: ${title}]%c ${message}\n`,
      'color: #f59e0b; font-weight: bold; font-size: 11px;',
      'color: inherit;',
      {
        context,
        timestamp: new Date().toISOString(),
      }
    );
  },
  info: (title, message, context = {}) => {
    console.info(
      `%c[Info: ${title}]%c ${message}\n`,
      'color: #3b82f6; font-weight: bold; font-size: 11px;',
      'color: inherit;',
      {
        context,
        timestamp: new Date().toISOString(),
      }
    );
  },
};
