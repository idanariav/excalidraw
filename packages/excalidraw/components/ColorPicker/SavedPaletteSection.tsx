import clsx from "clsx"; //zsviczian
import React, { useMemo, useState } from "react"; //zsviczian

import {
  generateColorShades,
  isColorDark,
  isTransparent,
  MAX_USER_CUSTOM_COLORS,
  COLOR_OUTLINE_CONTRAST_THRESHOLD,
} from "@excalidraw/common"; //zsviczian

import type { ColorTuple } from "@excalidraw/common"; //zsviczian

import { t } from "../../i18n"; //zsviczian
import { TrashIcon, PlusIcon } from "../icons"; //zsviczian

import PickerHeading from "./PickerHeading"; //zsviczian

import type { ColorPickerType } from "./colorPickerUtils"; //zsviczian
import type { UserCustomColorEntry, UserCustomColors } from "../../types"; //zsviczian

interface SavedPaletteSectionProps { //zsviczian
  type: ColorPickerType; //zsviczian
  currentColor: string | null; //zsviczian
  userCustomColors?: UserCustomColors; //zsviczian
  effectiveTopPicks?: ColorTuple; //zsviczian
  onChange: (color: string) => void; //zsviczian
  onUserCustomColorsChange?: (updated: UserCustomColors) => void; //zsviczian
} //zsviczian

const emptyTopPickOverrides = [null, null, null, null, null]; //zsviczian

const buildEmpty = (): UserCustomColors => ({ //zsviczian
  elementStroke: [], //zsviczian
  elementBackground: [], //zsviczian
  canvasBackground: [], //zsviczian
  topPickOverrides: { //zsviczian
    elementStroke: [...emptyTopPickOverrides], //zsviczian
    elementBackground: [...emptyTopPickOverrides], //zsviczian
    canvasBackground: [...emptyTopPickOverrides], //zsviczian
  }, //zsviczian
}); //zsviczian

// Inline star SVG for the "highlight" action button
const StarIcon = () => ( //zsviczian
  <svg //zsviczian
    viewBox="0 0 24 24" //zsviczian
    fill="none" //zsviczian
    stroke="currentColor" //zsviczian
    strokeWidth="1.5" //zsviczian
    width="12" //zsviczian
    height="12" //zsviczian
  > {/* //zsviczian */}
    <path //zsviczian
      strokeLinecap="round" //zsviczian
      strokeLinejoin="round" //zsviczian
      d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" //zsviczian
    /> {/* //zsviczian */}
  </svg> //zsviczian
); //zsviczian

export const SavedPaletteSection = ({ //zsviczian
  type: typeProp, //zsviczian
  currentColor, //zsviczian
  userCustomColors, //zsviczian
  effectiveTopPicks, //zsviczian
  onChange, //zsviczian
  onUserCustomColorsChange, //zsviczian
}: SavedPaletteSectionProps) => { //zsviczian
  // "elementGradient" reuses the elementBackground saved palette //zsviczian
  const type = typeProp === "elementGradient" ? "elementBackground" : typeProp; //zsviczian
  const [highlightingColor, setHighlightingColor] = useState<string | null>(null); //zsviczian
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null); //zsviczian

  const entries: UserCustomColorEntry[] = useMemo( //zsviczian
    () => userCustomColors?.[type] ?? [], //zsviczian
    [userCustomColors, type], //zsviczian
  ); //zsviczian

  const canSave = useMemo(() => { //zsviczian
    if (!currentColor || isTransparent(currentColor)) { //zsviczian
      return false; //zsviczian
    } //zsviczian
    if (entries.length >= MAX_USER_CUSTOM_COLORS) { //zsviczian
      return false; //zsviczian
    } //zsviczian
    return !entries.some((e) => e.color === currentColor); //zsviczian
  }, [currentColor, entries]); //zsviczian

  // Which saved entry (if any) is the "active" one — i.e. current color is base or a shade
  const activeEntryIndex = useMemo(() => { //zsviczian
    if (!currentColor) { //zsviczian
      return -1; //zsviczian
    } //zsviczian
    return entries.findIndex( //zsviczian
      (e) => e.color === currentColor || e.shades.includes(currentColor as any), //zsviczian
    ); //zsviczian
  }, [currentColor, entries]); //zsviczian

  const mutate = (fn: (draft: UserCustomColors) => void) => { //zsviczian
    const base = userCustomColors ?? buildEmpty(); //zsviczian
    const updated: UserCustomColors = { //zsviczian
      elementStroke: [...base.elementStroke], //zsviczian
      elementBackground: [...base.elementBackground], //zsviczian
      canvasBackground: [...base.canvasBackground], //zsviczian
      topPickOverrides: { //zsviczian
        elementStroke: [...(base.topPickOverrides?.elementStroke ?? emptyTopPickOverrides)], //zsviczian
        elementBackground: [...(base.topPickOverrides?.elementBackground ?? emptyTopPickOverrides)], //zsviczian
        canvasBackground: [...(base.topPickOverrides?.canvasBackground ?? emptyTopPickOverrides)], //zsviczian
      }, //zsviczian
    }; //zsviczian
    fn(updated); //zsviczian
    onUserCustomColorsChange?.(updated); //zsviczian
  }; //zsviczian

  const handleSaveColor = () => { //zsviczian
    if (!currentColor || !canSave) { //zsviczian
      return; //zsviczian
    } //zsviczian
    const entry: UserCustomColorEntry = { //zsviczian
      color: currentColor, //zsviczian
      shades: generateColorShades(currentColor), //zsviczian
    }; //zsviczian
    mutate((draft) => { //zsviczian
      draft[type].unshift(entry); //zsviczian
      if (draft[type].length > MAX_USER_CUSTOM_COLORS) { //zsviczian
        draft[type].pop(); //zsviczian
      } //zsviczian
    }); //zsviczian
  }; //zsviczian

  const handleRemoveColor = (index: number) => { //zsviczian
    const removedColor = entries[index].color; //zsviczian
    mutate((draft) => { //zsviczian
      draft[type].splice(index, 1); //zsviczian
      // clear any top-pick override slot pointing to this color
      const overrides = draft.topPickOverrides[type]; //zsviczian
      for (let i = 0; i < overrides.length; i++) { //zsviczian
        if (overrides[i] === removedColor) { //zsviczian
          overrides[i] = null; //zsviczian
        } //zsviczian
      } //zsviczian
    }); //zsviczian
  }; //zsviczian

  const handlePickSlot = (slotIndex: number, color: string) => { //zsviczian
    mutate((draft) => { //zsviczian
      draft.topPickOverrides[type][slotIndex] = color; //zsviczian
    }); //zsviczian
    setHighlightingColor(null); //zsviczian
  }; //zsviczian

  if (entries.length === 0 && !onUserCustomColorsChange) { //zsviczian
    return null; //zsviczian
  } //zsviczian

  return ( //zsviczian
    <div className="saved-palette"> {/* //zsviczian */}
      <PickerHeading>{t("colorPicker.savedColors")}</PickerHeading>

      {entries.length > 0 && ( //zsviczian
        <div className="saved-palette__swatch-row"> {/* //zsviczian */}
          {entries.map((entry, i) => ( //zsviczian
            <div //zsviczian
              key={entry.color} //zsviczian
              className="saved-palette__swatch-wrap" //zsviczian
              onMouseEnter={() => setHoveredIndex(i)} //zsviczian
              onMouseLeave={() => setHoveredIndex(null)} //zsviczian
            > {/* //zsviczian */}
              <button //zsviczian
                type="button" //zsviczian
                tabIndex={-1} //zsviczian
                className={clsx( //zsviczian
                  "color-picker__button color-picker__button--large", //zsviczian
                  { //zsviczian
                    active: activeEntryIndex === i, //zsviczian
                    "has-outline": !isColorDark(entry.color, COLOR_OUTLINE_CONTRAST_THRESHOLD), //zsviczian
                    "is-transparent": entry.color === "transparent", //zsviczian
                  }, //zsviczian
                )} //zsviczian
                style={{ "--swatch-color": entry.color } as React.CSSProperties} //zsviczian
                title={entry.color} //zsviczian
                aria-label={entry.color} //zsviczian
                onClick={() => onChange(entry.color)} //zsviczian
              > {/* //zsviczian */}
                <div className="color-picker__button-outline" /> {/* //zsviczian */}
              </button> {/* //zsviczian */}

              {hoveredIndex === i && ( //zsviczian
                <div className="saved-palette__micro-toolbar"> {/* //zsviczian */}
                  <button //zsviczian
                    type="button" //zsviczian
                    title={t("colorPicker.highlightColor")} //zsviczian
                    aria-label={t("colorPicker.highlightColor")} //zsviczian
                    onClick={(e) => { //zsviczian
                      e.stopPropagation(); //zsviczian
                      setHighlightingColor(entry.color); //zsviczian
                    }} //zsviczian
                  > {/* //zsviczian */}
                    <StarIcon /> {/* //zsviczian */}
                  </button> {/* //zsviczian */}
                  <button //zsviczian
                    type="button" //zsviczian
                    title={t("colorPicker.removeColor")} //zsviczian
                    aria-label={t("colorPicker.removeColor")} //zsviczian
                    onClick={(e) => { //zsviczian
                      e.stopPropagation(); //zsviczian
                      handleRemoveColor(i); //zsviczian
                      if (highlightingColor === entry.color) { //zsviczian
                        setHighlightingColor(null); //zsviczian
                      } //zsviczian
                    }} //zsviczian
                  > {/* //zsviczian */}
                    {TrashIcon} {/* //zsviczian */}
                  </button> {/* //zsviczian */}
                </div> //zsviczian
              )} {/* //zsviczian */}
            </div> //zsviczian
          ))} {/* //zsviczian */}
        </div> //zsviczian
      )} {/* //zsviczian */}

      {/* Shade row for the active saved entry */}
      {activeEntryIndex >= 0 && !highlightingColor && ( //zsviczian
        <div className="saved-palette__shade-row"> {/* //zsviczian */}
          {([ //zsviczian
            entries[activeEntryIndex].shades[0], //zsviczian
            entries[activeEntryIndex].shades[1], //zsviczian
            entries[activeEntryIndex].color, //zsviczian
            entries[activeEntryIndex].shades[2], //zsviczian
            entries[activeEntryIndex].shades[3], //zsviczian
          ] as string[]).map((shade, i) => ( //zsviczian
            <button //zsviczian
              key={shade} //zsviczian
              type="button" //zsviczian
              tabIndex={-1} //zsviczian
              className={clsx( //zsviczian
                "color-picker__button color-picker__button--large", //zsviczian
                { //zsviczian
                  active: currentColor === shade, //zsviczian
                  "has-outline": !isColorDark(shade, COLOR_OUTLINE_CONTRAST_THRESHOLD), //zsviczian
                }, //zsviczian
              )} //zsviczian
              style={{ "--swatch-color": shade } as React.CSSProperties} //zsviczian
              title={shade} //zsviczian
              aria-label={shade} //zsviczian
              onClick={() => onChange(shade)} //zsviczian
            > {/* //zsviczian */}
              <div className="color-picker__button-outline" /> {/* //zsviczian */}
            </button> //zsviczian
          ))} {/* //zsviczian */}
        </div> //zsviczian
      )} {/* //zsviczian */}

      {/* Slot picker for highlight/replace top pick */}
      {highlightingColor && effectiveTopPicks && ( //zsviczian
        <div className="saved-palette__slot-picker"> {/* //zsviczian */}
          <div className="saved-palette__slot-picker-heading"> {/* //zsviczian */}
            <span>{t("colorPicker.replaceTopPick")}</span> {/* //zsviczian */}
            <button //zsviczian
              type="button" //zsviczian
              aria-label={t("colorPicker.cancelHighlight")} //zsviczian
              onClick={() => setHighlightingColor(null)} //zsviczian
              className="saved-palette__slot-cancel" //zsviczian
            > {/* //zsviczian */}
              ✕ {/* //zsviczian */}
            </button> {/* //zsviczian */}
          </div> {/* //zsviczian */}
          <div className="saved-palette__slot-picker-swatches"> {/* //zsviczian */}
            {effectiveTopPicks.map((pick, slotIndex) => ( //zsviczian
              <button //zsviczian
                key={slotIndex} //zsviczian
                type="button" //zsviczian
                tabIndex={-1} //zsviczian
                className={clsx( //zsviczian
                  "color-picker__button color-picker__button--large", //zsviczian
                  { //zsviczian
                    "has-outline": !isColorDark(pick, COLOR_OUTLINE_CONTRAST_THRESHOLD), //zsviczian
                    "is-transparent": pick === "transparent", //zsviczian
                  }, //zsviczian
                )} //zsviczian
                style={{ "--swatch-color": pick } as React.CSSProperties} //zsviczian
                title={pick} //zsviczian
                aria-label={`${t("colorPicker.replaceTopPick")} ${slotIndex + 1}`} //zsviczian
                onClick={() => handlePickSlot(slotIndex, highlightingColor)} //zsviczian
              > {/* //zsviczian */}
                <div className="color-picker__button-outline" /> {/* //zsviczian */}
              </button> //zsviczian
            ))} {/* //zsviczian */}
          </div> {/* //zsviczian */}
        </div> //zsviczian
      )} {/* //zsviczian */}

      {/* Save current color button */}
      {onUserCustomColorsChange && ( //zsviczian
        <button //zsviczian
          type="button" //zsviczian
          className="saved-palette__save-btn" //zsviczian
          disabled={!canSave} //zsviczian
          onClick={handleSaveColor} //zsviczian
          title={ //zsviczian
            !currentColor || isTransparent(currentColor) //zsviczian
              ? t("colorPicker.saveCurrentColor") //zsviczian
              : entries.length >= MAX_USER_CUSTOM_COLORS //zsviczian
              ? `Max ${MAX_USER_CUSTOM_COLORS} ${t("colorPicker.savedColors").toLowerCase()}` //zsviczian
              : t("colorPicker.saveCurrentColor") //zsviczian
          } //zsviczian
        > {/* //zsviczian */}
          {PlusIcon} {/* //zsviczian */}
          {t("colorPicker.saveCurrentColor")} {/* //zsviczian */}
        </button> //zsviczian
      )} {/* //zsviczian */}
    </div> //zsviczian
  ); //zsviczian
}; //zsviczian
