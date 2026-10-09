import { createHash } from "node:crypto";
// Only an explicitly measured source footprint may replace ambiguous old pad loops.
export function reviewedCaveFootprint(profile, model) {
  if (!profile) return undefined;
  if (
    profile.sourceSHA256 !== model.assets?.source?.sha256 ||
    !/^[a-f0-9]{64}$/.test(profile.sourceSHA256) ||
    typeof profile.reason !== "string" ||
    profile.reason.trim().length < 30 ||
    !Number.isFinite(profile.mountDepthMM) ||
    ![model.width, model.height].every((v) => Number.isInteger(v) && v > 0) ||
    profile.centresMM?.length > model.width * model.height ||
    Math.abs(profile.mountDepthMM - model.mountDepth * 35) > 0.002 ||
    profile.sourceTopWidthMM !== 35 ||
    !(model.mountDepth > 0) ||
    !Array.isArray(profile.centresMM) ||
    !profile.centresMM.length
  )
    throw new Error(
      "Verified native cell footprint and unchanged mounting depth required",
    );
  const seen = new Set();
  const pads = profile.centresMM.map((centre) => {
    if (
      !Array.isArray(centre) ||
      centre.length !== 2 ||
      !centre.every(Number.isFinite) ||
      centre.some(
        (v, i) =>
          Math.abs(v) > ([model.width, model.height][i] - 1) * 17.5 + 0.1,
      ) ||
      centre.some(
        (v, i) =>
          Math.abs(
            v / 35 +
              [model.width, model.height][i] / 2 -
              0.5 -
              Math.round(v / 35 + [model.width, model.height][i] / 2 - 0.5),
          ) > 0.003,
      ) ||
      seen.has(centre.join(","))
    )
      throw new Error(
        "Distinct centres inside the reviewed footprint required",
      );
    seen.add(centre.join(","));
    const p = [centre[0] / 35, -centre[1] / 35];
    return {
      top: { min: p.map((v) => v - 0.5), max: p.map((v) => v + 0.5) },
      bottom: { min: p.map((v) => v - 0.325), max: p.map((v) => v + 0.325) },
    };
  });
  return {
    pads,
    signature: createHash("sha256")
      .update(JSON.stringify({ pads, depth: model.mountDepth }))
      .digest("hex"),
  };
}
