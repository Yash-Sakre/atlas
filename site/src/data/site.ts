export const GITHUB_URL = 'https://github.com/Yash-Sakre/atlas';
export const DOCS_REPO_URL = 'https://github.com/Yash-Sakre/atlas/tree/main/docs';
export const NPM_URL = 'https://www.npmjs.com/package/codebase-atlas';
export const ISSUES_URL = 'https://github.com/Yash-Sakre/atlas/issues';
export const LICENSE_URL = 'https://github.com/Yash-Sakre/atlas/blob/main/LICENSE';
export const INSTALL_CMD = 'npx codebase-atlas serve';

/**
 * CounterAPI v1 counter backing the footer visitor count. The v1 endpoints are
 * keyless, which also means the counter is public: anyone who knows this
 * namespace/name pair can read or bump it. Treat the number as a rough signal,
 * not as analytics. Rate limit is 30 requests/min per URL path.
 */
export const COUNTER_NAMESPACE = 'codebase-atlas';
export const COUNTER_NAME = 'site-visits';
