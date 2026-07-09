import {createRouter, createWebHistory} from 'vue-router'
import PageMain from '@/views/PageMain'
import ViewAdmin from '@/features/admin/pages/ViewAdmin'
import ViewHandbook from '@/features/handbook/pages/ViewHandbook'
import ViewDictionary from '@/features/handbook/dictionary/ViewDictionary'
import ViewCreateCharacter from '@/features/character-list/pages/ViewCreateCharacter'
import ViewListCharacters from '@/features/character-list/pages/ViewListCharacters'
import ViewCharacter from '@/features/character-editor/pages/ViewCharacter'
import ViewJoinSession from '@/features/sessions/pages/ViewJoinSession'
import ViewSession from '@/features/sessions/pages/ViewSession'
import ViewSessions from '@/features/sessions/pages/ViewSessions'
import ViewTemplates from '@/features/template-editor/pages/ViewTemplates'
import ViewTemplateEditor from '@/features/template-editor/pages/ViewTemplateEditor'
import { fetchGet } from '@/shared/api/http'
import { getSessions } from '@/shared/api/sessionsApi'
import { useItemTypesStore } from '@/stores/itemTypes'
import { useTemplateStore } from '@/stores/template'

const prefetchCache = new Map()
const PREFETCH_TTL_MS = 30_000

export function consumePrefetch(fullPath) {
    const entry = prefetchCache.get(fullPath)
    if (!entry) return null
    if (entry.timer) clearTimeout(entry.timer)
    prefetchCache.delete(fullPath)
    return entry.promise
}

function setPrefetch(fullPath, promise) {
    const entry = { promise, timer: null }
    entry.timer = setTimeout(() => {
        if (prefetchCache.get(fullPath) === entry) prefetchCache.delete(fullPath)
    }, PREFETCH_TTL_MS)
    prefetchCache.set(fullPath, entry)
}

const routes = [
    {
        path: '/',
        name: "Home",
        component: PageMain,
        meta: { title: 'Главная' },
    },
    {
        path: '/admin',
        name: "Admin",
        component: ViewAdmin,
        meta: { title: 'Админка' },
    },
    {
        path: '/sessions',
        name: "Sessions",
        component: ViewSessions,
        meta: {
            title: 'Сессии',
            prefetch: () => getSessions(),
        },
    },
    {
        path: '/sessions/:uuid',
        name: "Session",
        component: ViewSession,
    },
    {
        path: '/join/:code',
        name: "JoinSession",
        component: ViewJoinSession,
        meta: { title: 'Вступить в приключение' },
    },
    {
        path: '/chars',
        name: "Characters",
        component: ViewListCharacters,
        meta: {
            title: 'Персонажи',
            prefetch: () => {
                useTemplateStore().ensure()
                return fetchGet('/chars')
            },
        },
    },
    {
        path: '/chars/new',
        name: "CreateCharacter",
        component: ViewCreateCharacter,
        meta: {
            title: 'Создание персонажа',
            prefetch: () => useTemplateStore().ensure(),
        },
    },
    {
        path: '/char/:uuid',
        name: "Character",
        component: ViewCharacter,
    },
    {
        path: '/templates',
        name: "Templates",
        component: ViewTemplates,
        meta: {
            title: 'Шаблоны',
            prefetch: () => useTemplateStore().ensure(),
        },
    },
    {
        path: '/template/:id/edit',
        name: "TemplateEditor",
        component: ViewTemplateEditor,
        meta: { title: 'Редактор шаблона' },
    },
    {
        path: '/handbook',
        name: "Handbook",
        component: ViewHandbook,
        meta: {
            title: 'Справочник',
            prefetch: () => useItemTypesStore().ensureAll(),
        },
    },
    {
        path: '/handbook/dictionary',
        name: "HandbookDictionary",
        component: ViewDictionary,
        meta: { title: 'Словари' },
    },
    {
        path: '/handbook/objects',
        name: "HandbookObjects",
        component: ViewHandbook,
        meta: { title: 'Справочник - Коллекции' },
    },
    {
        path: '/:pathMatch(.*)*',
        name: "NotFound",
        redirect: '/',
    },
]

export const router = createRouter({
    history: createWebHistory(),
    routes,
})

router.beforeEach((to) => {
    const fn = to.meta?.prefetch
    if (typeof fn !== 'function') return
    try {
        const result = fn(to)
        if (result && typeof result.then === 'function') {
            setPrefetch(to.fullPath, result.catch(() => null))
        }
    } catch (e) {
        console.warn('[prefetch] failed for', to.fullPath, e)
    }
})

router.afterEach((to) => {
    if (to.meta?.title) document.title = to.meta.title
})
