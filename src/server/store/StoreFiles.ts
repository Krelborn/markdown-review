import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

import type { DocumentThreadsFile } from "../../shared/review/documentThreadsFileSchema";
import { documentThreadsFileSchema } from "../../shared/review/documentThreadsFileSchema";
import type { ReviewFile } from "../../shared/review/reviewFileSchema";
import { reviewFileSchema } from "../../shared/review/reviewFileSchema";
import { isFileNotFound } from "../files/isFileNotFound";
import { readTextFileOrNull } from "../files/readTextFileOrNull";
import { writeJsonAtomically } from "../files/writeJsonAtomically";
import { writeTextFileUnlessExists } from "../files/writeTextFileUnlessExists";

import { emptyReviewFile } from "./emptyReviewFile";
import { readStoreFile } from "./readStoreFile";
import type { StoreFileResult } from "./StoreFileResult";
import {
  documentSourcePath,
  documentsDirectory,
  documentThreadsFilePath,
  reviewFilePath,
  storeDirectory,
} from "./storePaths";

/**
 * Reads and writes the files of one root's `.markdown-review/` directory and the docs they refer to
 */
export class StoreFiles {
  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  /**
   * Creates the store directory, and a `.gitignore` that keeps it out of git unless the user has written their own
   */
  public async ensureStoreDirectory(): Promise<void> {
    await mkdir(storeDirectory(this.root), { recursive: true });
    await writeTextFileUnlessExists(path.join(storeDirectory(this.root), ".gitignore"), "*\n");
  }

  /**
   * @returns the review file, or an empty one when it does not exist yet
   */
  public async readReviewFile(): Promise<StoreFileResult<ReviewFile>> {
    const result = await readStoreFile(reviewFilePath(this.root), reviewFileSchema);
    return result.kind === "valid" ? { kind: "valid", value: result.value ?? emptyReviewFile } : result;
  }

  public writeReviewFile(file: ReviewFile): Promise<void> {
    return writeJsonAtomically(reviewFilePath(this.root), file);
  }

  /**
   * @returns the repo-relative paths of the docs that have a threads file
   */
  public async listDocuments(): Promise<string[]> {
    let entries: string[];
    try {
      entries = await readdir(documentsDirectory(this.root), { recursive: true });
    } catch (error) {
      if (isFileNotFound(error)) {
        return [];
      }
      throw error;
    }
    return entries
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => entry.slice(0, -".json".length).split(path.sep).join("/"))
      .sort();
  }

  /**
   * @param document a repo-relative POSIX path
   * @returns the doc's threads file as stored, or null when the doc has none
   */
  public readDocumentFile(document: string): Promise<StoreFileResult<DocumentThreadsFile | null>> {
    return readStoreFile(documentThreadsFilePath(this.root, document), documentThreadsFileSchema);
  }

  public writeDocumentFile(file: DocumentThreadsFile): Promise<void> {
    return writeJsonAtomically(documentThreadsFilePath(this.root, file.document), file);
  }

  /**
   * @param document a repo-relative POSIX path
   * @returns the doc's markdown source, or null when it does not exist
   */
  public readDocumentSource(document: string): Promise<string | null> {
    return readTextFileOrNull(documentSourcePath(this.root, document));
  }
}
