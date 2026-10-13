import type { ReviewFile } from "../../shared/review/reviewFileSchema";
import { reviewFileVersion } from "../../shared/review/reviewFileVersion";

export const emptyReviewFile: ReviewFile = { round: null, threads: [], version: reviewFileVersion };
