import type { ReviewFile } from "../../shared/review/reviewFileSchema";
import { storeFileVersion } from "../../shared/review/storeFileVersion";

export const emptyReviewFile: ReviewFile = {
  approvedAt: null,
  requestedAt: null,
  threads: [],
  version: storeFileVersion,
};
