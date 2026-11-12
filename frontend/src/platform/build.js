/* global __DNDSHARE_BUILD__ */
export const frontendBuild = typeof __DNDSHARE_BUILD__ === 'undefined'
  ? { version: 'dev', build: 0, commitSha: 'dev', sourceHash: 'dev', apiContract: 1, dataContract: 1 }
  : __DNDSHARE_BUILD__

export function apiHeaders(headers) {
  const result = new Headers(headers)
  result.set('X-DnDShare-Client-Api', String(frontendBuild.apiContract))
  return result
}
