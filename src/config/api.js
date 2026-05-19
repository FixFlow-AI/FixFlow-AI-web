import axios from 'axios'
import { clearAccessToken, getAccessToken, getCsrfToken, setAccessToken, setCsrfToken } from '@/lib/authToken'

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api'
    : 'http://localhost:5000/api')

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const csrfToken = getCsrfToken()
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken
  }
  return config
})

export async function ensureCsrfToken() {
  if (getCsrfToken()) return getCsrfToken()
  const { data } = await axios.get(`${API_BASE_URL}/auth/csrf`, { withCredentials: true })
  setCsrfToken(data.csrfToken)
  return data.csrfToken
}

export async function refreshAccessToken() {
  const csrfToken = await ensureCsrfToken()
  const { data } = await axios.post(
    `${API_BASE_URL}/auth/refresh`,
    {},
    {
      withCredentials: true,
      headers: { 'X-CSRF-Token': csrfToken },
    }
  )
  setAccessToken(data.accessToken)
  return data.accessToken
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const newAccessToken = await refreshAccessToken()
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`

        return api(originalRequest)
      } catch {
        clearAccessToken()
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

export default api
