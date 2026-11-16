import { ref, unref } from "vue";
import { useAccountStore } from "@/stores/account";
import { openLocalDatabase } from "@/platform/storage";
import { fetchPost } from "@/shared/api/http";

export function useRedCommands({ uuid, version, canEdit, flushSave, sync }) {
  const busy = ref(false),
    error = ref("");
  async function roll(input) {
    if (busy.value) throw new Error("Дождитесь завершения текущего броска");
    if (!unref(canEdit))
      throw new Error("Для игрового броска нужен доступ к редактированию");
    const actor = useAccountStore().user?.id,
      character = unref(uuid);
    if (!actor || !character) throw new Error("Сначала сохраните персонажа");
    busy.value = true;
    error.value = "";
    try {
      const db = await openLocalDatabase(),
        key = `account:${actor}:red-roll:${character}`;
      let request = await db.get(key);
      if (!request) {
        if (!(await flushSave()))
          throw new Error("Сначала разрешите конфликт сохранения листа");
        request = {
          ...input,
          actionId: crypto.randomUUID(),
          version: unref(version),
        };
        await db.batch([{ key, value: request }]);
      }
      let result;
      try {
        result = await fetchPost(`/char/${character}/red-roll`, request);
      } catch (e) {
        // An acknowledged rejection has not consumed anything; a lost reply retains the exact request.
        if ([400, 401, 403, 404, 409].includes(e.status)) {
          await db.batch([{ key, value: null }]);
          if (e.status === 409) await sync.catchUp();
        }
        throw e;
      }
      await sync.catchUp();
      await db.batch([{ key, value: null }]);
      return result.roll;
    } catch (e) {
      error.value =
        e.message ||
        "Не удалось подтвердить бросок. Повторите его: ресурс не спишется дважды.";
      throw e;
    } finally {
      busy.value = false;
    }
  }
  return { busy, error, roll };
}
