import { fetchGet } from "./http";
import { prepareImageUpload } from "../lib/imageUpload";

export const getMapDecals = () => fetchGet("/maps/decals");
export async function uploadMapDecal(file, name, category) {
  const prepared = await prepareImageUpload(file, {
    maxBytes: 8 * 1024 * 1024,
    maxDimension: 2048,
  });
  const form = new FormData();
  form.append("file", prepared);
  form.append("name", name);
  form.append("category", category);
  const response = await fetch("/api/maps/decals", {
    method: "POST",
    body: form,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.desc || "Не удалось загрузить декаль");
  return result;
}
