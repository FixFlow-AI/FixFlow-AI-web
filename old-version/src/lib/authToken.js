let accessToken = null
let csrfToken = null

export function setAccessToken(token) {
  accessToken = token || null
}

export function getAccessToken() {
  return accessToken
}

export function clearAccessToken() {
  accessToken = null
}

export function setCsrfToken(token) {
  csrfToken = token || null
}

export function getCsrfToken() {
  return csrfToken
}
