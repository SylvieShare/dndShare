import { patchCharacterData } from './characterDocuments'
import { fetchDelete, fetchGet, fetchPost, fetchPut } from '@/shared/api/http'

export const charactersApi = {
  list() {
    return fetchGet('/chars')
  },
  get(uuid) {
    return fetchGet('/char/' + uuid)
  },
  create(payload) {
    return fetchPost('/char', payload)
  },
  update(uuid, payload) {
    return fetchPut('/char/' + uuid, payload)
  },
  patchData: patchCharacterData,
  delete(uuid) {
    return fetchDelete('/char/' + uuid)
  },
}
