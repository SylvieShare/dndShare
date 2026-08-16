const JSON_HEADERS = { 'Content-Type': 'application/json;charset=utf-8' }

async function apiRequest(url, { method = 'GET', body, response = 'json', signal, cache } = {}) {
    const res = await fetch('/api' + url, {
        method,
        headers: JSON_HEADERS,
        body: body == null ? null : JSON.stringify(body),
        signal,
        cache,
    })
    if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        const error = new Error(payload?.desc || String(res.status))
        error.status = res.status
        error.type = payload?.type || ''
        throw error
    }
    if (response === 'raw') return res
    if (res.status === 204) return {}
    const contentType = res.headers.get('content-type') || ''
    return contentType.includes('application/json') ? res.json() : {}
}

export function fetchGetEmpty(url) {
    return apiRequest(url, { response: 'raw' })
}

export function fetchGet(url, options = {}) {
    return apiRequest(url, options)
}

export function fetchPost(url, body) {
    return apiRequest(url, { method: 'POST', body })
}

export function fetchPut(url, body) {
    return apiRequest(url, { method: 'PUT', body })
}

export function fetchPatch(url, body) {
    return apiRequest(url, { method: 'PATCH', body })
}

export function fetchDelete(url) {
    return apiRequest(url, { method: 'DELETE', response: 'raw' })
}

export function fetchDeleteJson(url) {
    return apiRequest(url, { method: 'DELETE' })
}
