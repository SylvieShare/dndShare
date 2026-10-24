export const MODEL_STAGES = {
  catalogue: "Получение каталога",
  download: "Получение файла",
  decode: "Декодирование GLB и текстур",
  geometry: "Подготовка геометрии",
  scene: "Подготовка сцены",
  webgl: "Запуск WebGL",
};
export const MODEL_KINDS = {
  render: "Основная модель",
  lod: "LOD",
  shadow: "Теневая модель",
  catalogue: "Каталог моделей",
};
export function modelLoadError(cause, context = {}) {
  if (cause?.name === "AbortError") return cause;
  const status =
    Number(cause?.status || cause?.response?.status || cause?.target?.status) ||
    undefined;
  const error = new Error(
    cause?.message ||
      (typeof cause === "string" ? cause : "Соединение прервалось"),
    { cause },
  );
  error.name = "ModelLoadError";
  Object.assign(error, cause?.name === "ModelLoadError" ? cause : {}, context);
  error.message = String(
    context.message || cause?.message || error.message,
  ).slice(0, 2000);
  error.status = status;
  error.stage ||= "download";
  error.kind ||=
    (status === 404 || status === 410) && error.stage !== "catalogue"
      ? "file-missing"
      : status === 401 || status === 403
        ? "access"
        : "unavailable";
  error.retryable ??= ![400, 401, 403, 404, 410, 422].includes(status);
  error.key ||= `${error.stage}:${error.url || error.modelIds?.join(",") || error.modelId || error.kind}`;
  return error;
}
export function missingModels(ids) {
  return modelLoadError(null, {
    message: "Модели отсутствуют в успешно загруженном каталоге",
    stage: "catalogue",
    kind: "model-missing",
    modelIds: ids,
    retryable: false,
  });
}
