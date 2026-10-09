import { Radio, Text } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useId } from "react";

import type { Verdict } from "../../../shared/api/apiRequestSchemas";

import styles from "./SubmitMenu.module.css";

export interface VerdictOptionProps {
  /**
   * What submitting with this verdict will do
   */
  description: string;

  isDisabled: boolean;
  label: string;
  value: Verdict;
}

/**
 * One verdict the user can submit with: its radio, and what it will do
 */
export function VerdictOption({ description, isDisabled, label, value }: VerdictOptionProps): JSX.Element {
  const descriptionId = useId();
  return (
    <div className={styles.option}>
      <Radio disabled={isDisabled} value={value} aria-describedby={descriptionId}>
        {label}
      </Radio>
      <Text className={styles.description} id={descriptionId} size="sm" tone="muted">
        {description}
      </Text>
    </div>
  );
}
