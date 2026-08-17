import {ref} from 'vue'
import {createRouter, createWebHistory} from 'vue-router'
import PageMain from '@/views/PageMain'
import ViewAdmin from '@/features/admin/pages/ViewAdmin'
import ViewHandbook from '@/features/handbook/pages/ViewHandbook'
import ViewDictionary from '@/features/handbook/dictionary/ViewDictionary'
import ViewPlayerRules from '@/features/handbook/rules/pages/ViewPlayerRules'
import ViewCreateCharacter from '@/features/character-list/pages/ViewCreateCharacter'
import ViewListCharacters from '@/features/character-list/pages/ViewListCharacters'
import ViewCharacter from '@/features/character-editor/pages/ViewCharacter'
import ViewCharacterPrint from '@/features/character-editor/pages/ViewCharacterPrint'
import ViewJoinSession from '@/features/sessions/pages/ViewJoinSession'
import ViewAccount from '@/features/account/pages/ViewAccount.vue'
import ViewEncounterScreen from '@/features/sessions/pages/ViewEncounterScreen.vue'
import ViewSession from '@/features/sessions/pages/ViewSession'
import ViewSessions from '@/features/sessions/pages/ViewSessions'
import { fetchGet } from '@/shared/api/http'
import { getSessions } from '@/shared/api/sessionsApi'
import { useItemTypesStore } from '@/stores/itemTypes'
import { useTemplateStore } from '@/stores/template'
import {
    completeMobilePageTransitionNavigation,
    shouldUseMobilePageTransition,
    startMobilePageTransition,
} from '@/app/mobilePageTransition'

const prefetchCache = new Map()
const PREFETCH_TTL_MS = 30_000

// The order mirrors the shared app navigation. Routes inside the same section use depth
// first, so opening a detail page moves forward and returning to its list moves
// backward. Keeping this in route meta also makes programmatic and browser
// navigations behave identically.
const sectionOrder = {
    home: -1,
    handbook: 0,
    sessions: 1,
    characters: 2,
    admin: 3,
}

export const pageTransitionName = ref('page-forward')

function transitionRank(route) {
    return {
        section: route.meta?.section,
        sectionOrder: sectionOrder[route.meta?.section] ?? 0,
        depth: route.meta?.depth ?? 0,
        pageOrder: route.meta?.pageOrder ?? 0,
    }
}

function updatePageTransition(to, from) {
    if (!from.name || to.path === from.path) return

    const next = transitionRank(to)
    const current = transitionRank(from)
    let direction

    if (next.section === current.section) {
        direction = next.depth !== current.depth
            ? next.depth - current.depth
            : next.pageOrder - current.pageOrder
    } else {
        direction = next.sectionOrder - current.sectionOrder
    }

    pageTransitionName.value = direction < 0 ? 'page-backward' : 'page-forward'
}

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
        meta: { title: 'Главная', section: 'home', depth: 0 },
    },
    {
        path: '/account',
        name: "Account",
        component: ViewAccount,
        meta: { title: 'Аккаунт', section: 'home', depth: 1, mobileBackTo: { name: 'Home' } },
    },
    {
        path: '/admin',
        name: "Admin",
        component: ViewAdmin,
        meta: { title: 'Админка', section: 'admin', depth: 0 },
    },
    {
        path: '/sessions',
        name: "Sessions",
        component: ViewSessions,
        meta: {
            title: 'Сессии',
            section: 'sessions',
            depth: 0,
            prefetch: () => getSessions(),
        },
    },
    {
        path: '/sessions/:uuid',
        name: "Session",
        component: ViewSession,
        meta: { title: 'Сессия', section: 'sessions', depth: 1, mobileBackTo: { name: 'Sessions' } },
    },
    {
        path: '/screen/:uuid',
        name: "EncounterScreen",
        component: ViewEncounterScreen,
        meta: { title: 'Экран показа', section: 'sessions', depth: 2, standaloneView: true },
    },
    {
        path: '/join/:code',
        name: "JoinSession",
        component: ViewJoinSession,
        meta: { title: 'Вступить в приключение', section: 'sessions', depth: 1, pageOrder: 1, mobileBackTo: { name: 'Sessions' } },
    },
    {
        path: '/chars',
        name: "Characters",
        component: ViewListCharacters,
        meta: {
            title: 'Персонажи',
            section: 'characters',
            depth: 0,
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
            section: 'characters',
            depth: 1,
            pageOrder: 1,
            mobileBackTo: { name: 'Characters' },
            prefetch: () => useTemplateStore().ensure(),
        },
    },
    {
        path: '/char/:uuid',
        name: "Character",
        component: ViewCharacter,
        meta: { title: 'Персонаж', section: 'characters', depth: 1, pageOrder: 2, mobileHeader: 'hidden', mobileBackTo: { name: 'Characters' } },
    },
    {
        path: '/char/:uuid/print',
        name: "CharacterPrint",
        component: ViewCharacterPrint,
        meta: {
            title: 'Печатный лист персонажа',
            section: 'characters',
            depth: 2,
            pageOrder: 3,
            mobileBackTo: route => ({ name: 'Character', params: { uuid: route.params.uuid } }),
            printView: true,
        },
    },
    {
        path: '/handbook',
        name: "Handbook",
        component: ViewHandbook,
        meta: {
            title: 'Справочник',
            section: 'handbook',
            depth: 0,
            prefetch: () => useItemTypesStore().ensureAll(),
        },
    },
    {
        path: '/handbook/dictionary',
        name: "HandbookDictionary",
        component: ViewDictionary,
        meta: { title: 'Словари', section: 'handbook', depth: 1, pageOrder: 2, mobileBackTo: { name: 'Handbook' } },
    },
    {
        path: '/handbook/objects',
        name: "HandbookObjects",
        component: ViewHandbook,
        meta: { title: 'Справочник - Коллекции', section: 'handbook', depth: 1, pageOrder: 1, mobileBackTo: { name: 'Handbook' } },
    },
    {
        path: '/handbook/rules',
        name: 'PlayerRules',
        component: ViewPlayerRules,
        meta: { title: 'Как играть', section: 'handbook', depth: 1, pageOrder: 0, mobileBackTo: { name: 'Handbook' } },
    },
    {
        path: '/handbook/rules/:articleSlug',
        name: 'PlayerRuleArticle',
        component: ViewPlayerRules,
        meta: { title: 'Правила', section: 'handbook', depth: 2, pageOrder: 0, mobileBackTo: { name: 'PlayerRules' } },
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

router.beforeEach((to, from) => {
    updatePageTransition(to, from)

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

router.beforeResolve((to, from) => {
    if (!shouldUseMobilePageTransition(to, from)) return
    return startMobilePageTransition(pageTransitionName.value)
})

router.afterEach((to) => {
    completeMobilePageTransitionNavigation()
    if (to.meta?.title) document.title = to.meta.title
})
