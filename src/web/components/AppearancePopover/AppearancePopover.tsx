import {
  IconButton,
  Popover,
  Radio,
  RadioGroup,
  Segment,
  SegmentedControl,
  Stack,
  Text,
  Theme,
  usePopover,
} from "@krelborn/stylesui";
import type { JSX } from "react";
import { useId } from "react";

import type { PaletteName } from "../../../shared/appearance/Appearance";
import { colorModeSchema, paletteNameSchema } from "../../../shared/appearance/Appearance";
import { useAppearance } from "../../appearance/useAppearance";

import styles from "./AppearancePopover.module.css";

interface PaletteChoice {
  description: string;
  name: PaletteName;
  title: string;
}

const paletteChoices: readonly PaletteChoice[] = [
  { description: "Warm, low glare", name: "paper", title: "Paper" },
  { description: "White, crisp", name: "bright", title: "Bright" },
  { description: "Cool grey page, white cards", name: "mist", title: "Mist" },
  { description: "Dimmest, softest", name: "dusk", title: "Dusk" },
];

/**
 * The Appearance button, which opens a popover where the user chooses the colour mode and the palette the page is drawn
 * in; each choice applies at once and is remembered for every repo's review
 */
export function AppearancePopover(): JSX.Element {
  const popover = usePopover();
  const { appearance, changeAppearance } = useAppearance();
  const descriptionId = useId();
  return (
    <>
      <IconButton {...popover.getTriggerProps()} label="Appearance" placement="bottom" size="sm" variant="ghost">
        <svg
          className={styles.icon}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" />
        </svg>
      </IconButton>
      <Popover {...popover.getOverlayProps()} aria-label="Appearance" role="dialog">
        <Stack gap={4}>
          <SegmentedControl
            label="Mode"
            onValueChange={(mode) => changeAppearance({ mode: colorModeSchema.parse(mode) })}
            size="sm"
            value={appearance.mode}
          >
            <Segment value="system">System</Segment>
            <Segment value="light">Light</Segment>
            <Segment value="dark">Dark</Segment>
          </SegmentedControl>
          <RadioGroup
            label="Palette"
            onValueChange={(palette) => changeAppearance({ palette: paletteNameSchema.parse(palette) })}
            value={appearance.palette}
          >
            {paletteChoices.map(({ description, name, title }) => (
              <Radio
                aria-describedby={`${descriptionId}-${name}`}
                aria-label={title}
                className={styles.choice}
                key={name}
                value={name}
              >
                <span className={styles.content}>
                  <Theme as="span" className={styles.swatch} palette={name}>
                    <span className={styles.lines} />
                    <span className={styles.card} />
                  </Theme>
                  <span className={styles.label}>
                    <Text size="sm" weight="bold">
                      {title}
                    </Text>
                    <Text id={`${descriptionId}-${name}`} size="xs" tone="muted">
                      {description}
                    </Text>
                  </span>
                </span>
              </Radio>
            ))}
          </RadioGroup>
        </Stack>
      </Popover>
    </>
  );
}
