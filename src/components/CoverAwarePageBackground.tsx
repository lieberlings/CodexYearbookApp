import { CoverBackgroundLayer } from "./CoverBackgroundLayer";
import { PageBackground } from "./PageBackground";
import { usesSharedCoverBackground } from "../layout/bookSpreads";
import type { Memory, Project } from "../types";

export function CoverAwarePageBackground({ project, role, width, backgroundAssetId, backgroundColor }: {
  project?: Project; role?: Memory["bookRole"]; width: number; backgroundAssetId?: string; backgroundColor?: string;
}) {
  const panel = role === "front-cover" ? "front" : role === "back-cover" ? "back" : undefined;
  return panel && usesSharedCoverBackground(panel, project?.coverDesign)
    ? <CoverBackgroundLayer design={project?.coverDesign} panel={panel} width={width} />
    : <PageBackground backgroundAssetId={backgroundAssetId} backgroundColor={backgroundColor} />;
}
