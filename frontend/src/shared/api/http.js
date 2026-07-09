export function fetchGetEmpty(url) {
    return fetch('/api' + url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
    })
}

export function fetchGet(url) {
    return fetch('/api' + url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
    })
        .then(res => res.json().catch(() => {}))
}

export function fetchPost(url, body) {
    return fetch('/api' + url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: body ? JSON.stringify(body) : null
    })
        .then(res => {
            if (!res.ok) throw new Error(res.status)
            const ct = res.headers.get('content-type')
            return (ct && ct.includes('application/json')) ? res.json() : {}
        })
}

export function fetchPut(url, body) {
    return fetch('/api' + url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: body ? JSON.stringify(body) : null
    })
        .then(res => {
            if (!res.ok) throw new Error(res.status)
            const ct = res.headers.get('content-type')
            return (ct && ct.includes('application/json')) ? res.json() : {}
        })
}

export function fetchPatch(url, body) {
    return fetch('/api' + url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
        body: body ? JSON.stringify(body) : null
    })
        .then(res => {
            if (!res.ok) throw new Error(res.status)
            const ct = res.headers.get('content-type')
            return (ct && ct.includes('application/json')) ? res.json() : {}
        })
}

export function fetchDelete(url) {
    return fetch('/api' + url, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json;charset=utf-8'
        },
    })
}
