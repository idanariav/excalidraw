import { pointFrom } from "@excalidraw/math";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  DEFAULT_ELEMENT_STROKE_COLOR_PALETTE,
  DEFAULT_ELEMENT_STROKE_PICKS,
  ARROW_TYPE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_FAMILY,
  ROUNDNESS,
  STROKE_WIDTH,
  VERTICAL_ALIGN,
  KEYS,
  randomInteger,
  arrayToMap,
  updateActiveTool, //zsviczian
  getFontFamilyString,
  getLineHeight,
  isTransparent,
  reduceToCommonValue,
  invariant,
  FONT_SIZES,
} from "@excalidraw/common";

import { canBecomePolygon, getNonDeletedElements } from "@excalidraw/element";

import {
  bindBindingElement,
  calculateFixedPointForElbowArrowBinding,
  updateBoundElements,
} from "@excalidraw/element";

import { LinearElementEditor } from "@excalidraw/element";

import { newElementWith } from "@excalidraw/element";
import { //zsviczian
  newRectangleElement, //zsviczian
  newEllipseElement, //zsviczian
  newTriangleElement, //zsviczian
  syncMovedIndices, //zsviczian
} from "@excalidraw/element"; //zsviczian
import { getArrowheadForPicker } from "@excalidraw/element";

import {
  getBoundTextElement,
  redrawTextBoundingBox,
} from "@excalidraw/element";

import {
  isArrowElement,
  isBoundToContainer,
  isElbowArrow,
  isLinearElement,
  isLineElement,
  isTextElement,
  isUsingAdaptiveRadius,
} from "@excalidraw/element";

import { hasStrokeColor } from "@excalidraw/element";

import {
  updateElbowArrowPoints,
  CaptureUpdateAction,
  toggleLinePolygonState,
} from "@excalidraw/element";

import { deriveStylesPanelMode } from "@excalidraw/common";

import type { LocalPoint, Radians } from "@excalidraw/math";

import type {
  Arrowhead,
  ElementsMap,
  ExcalidrawBindableElement,
  ExcalidrawElement,
  ExcalidrawEllipseElement, //zsviczian
  ExcalidrawRectangleElement, //zsviczian
  ExcalidrawTriangleElement, //zsviczian
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  ExcalidrawFrameElement,
  FontFamilyValues,
  TextAlign,
  VerticalAlign,
} from "@excalidraw/element/types";

import type { Scene } from "@excalidraw/element";

import type { CaptureUpdateActionType } from "@excalidraw/element";

import { trackEvent } from "../analytics";
import { RadioSelection } from "../components/RadioSelection";
import { ButtonIcon } from "../components/ButtonIcon";
import { ColorPicker } from "../components/ColorPicker/ColorPicker";
import { FontPicker } from "../components/FontPicker/FontPicker";
import { IconPicker } from "../components/IconPicker";
import { Range } from "../components/Range";
import {
  ArrowheadArrowIcon,
  ArrowheadBarIcon,
  ArrowheadCircleIcon,
  ArrowheadTriangleIcon,
  ArrowheadNoneIcon,
  StrokeStyleDashedIcon,
  StrokeStyleDottedIcon,
  TextAlignTopIcon,
  TextAlignBottomIcon,
  TextAlignMiddleIcon,
  FillHachureIcon,
  FillCrossHatchIcon,
  FillSolidIcon,
  FillGradientIcon, //zsviczian
  SloppinessArchitectIcon,
  SloppinessArtistIcon,
  SloppinessCartoonistIcon,
  StrokeWidthThinIcon,
  StrokeWidthBaseIcon,
  StrokeWidthBoldIcon,
  StrokeWidthExtraBoldIcon,
  FontSizeSmallIcon,
  FontSizeMediumIcon,
  FontSizeLargeIcon,
  FontSizeExtraLargeIcon,
  pencilIcon,
  EdgeSharpIcon,
  EdgeRoundIcon,
  TextAlignLeftIcon,
  TextAlignCenterIcon,
  TextAlignRightIcon,
  FillZigZagIcon,
  ArrowheadTriangleOutlineIcon,
  ArrowheadCircleOutlineIcon,
  ArrowheadDiamondIcon,
  ArrowheadDiamondOutlineIcon,
  fontSizeIcon,
  sharpArrowIcon,
  roundArrowIcon,
  elbowArrowIcon,
  ArrowheadCardinalityExactlyOneIcon,
  ArrowheadCardinalityManyIcon,
  ArrowheadCardinalityOneIcon,
  ArrowheadCardinalityOneOrManyIcon,
  ArrowheadCardinalityZeroOrManyIcon,
  ArrowheadCardinalityZeroOrOneIcon,
  markerFrameIcon,
  ArcOpenIcon, //zsviczian
  ArcClosedIcon, //zsviczian
  ArcThreeQuarterIcon, //zsviczian
  ArcHalfIcon, //zsviczian
  ArcQuarterIcon, //zsviczian
  RectGapNoneIcon, //zsviczian
  RectGapTopIcon, //zsviczian
  RectGapBottomIcon, //zsviczian
  RectGapLeftIcon, //zsviczian
  RectGapRightIcon, //zsviczian
  TriGapNoneIcon, //zsviczian
  TriGapTopIcon, //zsviczian
  TriGapBottomLeftIcon, //zsviczian
  TriGapBottomRightIcon, //zsviczian
  RectPresetSquareIcon, //zsviczian
  RectPreset4x5Icon, //zsviczian
  RectPreset16x9Icon, //zsviczian
  EllipsePresetCircleIcon, //zsviczian
  TriPresetEquilateralIcon, //zsviczian
  TriPresetRightAngleIcon, //zsviczian
} from "../components/icons";

import { Fonts } from "../fonts";
import { getLanguage, t } from "../i18n";
import {
  canHaveArrowheads,
  getSelectedElements,
  getTargetElements,
  isSomeElementSelected,
} from "../scene";

import { isFullPanelMode, t2 } from "../obsidianUtils";
import {
  withCaretPositionPreservation,
  restoreCaretPosition,
} from "../hooks/useTextEditorFocus";

import { getShortcutKey } from "../shortcut";

import { register } from "./register";

import type { AppClassProperties, AppState, Primitive, UserCustomColors } from "../types"; //zsviczian

import { computeEffectiveTopPicks } from "../components/ColorPicker/colorPickerUtils"; //zsviczian

const FONT_SIZE_RELATIVE_INCREASE_STEP = 0.1;

const getStylesPanelInfo = (app: AppClassProperties) => {
  const stylesPanelMode = deriveStylesPanelMode(app.editorInterface);
  return {
    stylesPanelMode,
    isCompact: !(stylesPanelMode === "full" || stylesPanelMode === "tray"), //zsviczian
    isMobile: stylesPanelMode === "mobile",
  } as const;
};

export const changeProperty = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  callback: (element: ExcalidrawElement) => ExcalidrawElement,
  includeBoundText = false,
) => {
  const selectedElementIds = arrayToMap(
    getSelectedElements(elements, appState, {
      includeBoundTextElement: includeBoundText,
    }),
  );

  return elements.map((element) => {
    if (
      selectedElementIds.get(element.id) ||
      element.id === appState.editingTextElement?.id
    ) {
      return callback(element);
    }
    return element;
  });
};

export const getFormValue = function <T extends Primitive>(
  elements: readonly ExcalidrawElement[],
  app: AppClassProperties,
  getAttribute: (element: ExcalidrawElement) => T,
  elementPredicate: true | ((element: ExcalidrawElement) => boolean),
  defaultValue: T | ((isSomeElementSelected: boolean) => T),
): T {
  const editingTextElement = app.state.editingTextElement;
  const nonDeletedElements = getNonDeletedElements(elements);

  let ret: T | null = null;

  if (editingTextElement) {
    ret = getAttribute(editingTextElement);
  }

  if (!ret) {
    const hasSelection = isSomeElementSelected(nonDeletedElements, app.state);

    if (hasSelection) {
      const selectedElements = app.scene.getSelectedElements(app.state);
      const targetElements =
        elementPredicate === true
          ? selectedElements
          : selectedElements.filter((el) => elementPredicate(el));

      ret =
        reduceToCommonValue(targetElements, getAttribute) ??
        (typeof defaultValue === "function"
          ? defaultValue(true)
          : defaultValue);
    } else {
      ret =
        typeof defaultValue === "function" ? defaultValue(false) : defaultValue;
    }
  }

  return ret;
};

const offsetElementAfterFontResize = (
  prevElement: ExcalidrawTextElement,
  nextElement: ExcalidrawTextElement,
  scene: Scene,
) => {
  if (isBoundToContainer(nextElement) || !nextElement.autoResize) {
    return nextElement;
  }
  return scene.mutateElement(nextElement, {
    x:
      prevElement.textAlign === "left"
        ? prevElement.x
        : prevElement.x +
          (prevElement.width - nextElement.width) /
            (prevElement.textAlign === "center" ? 2 : 1),
    // centering vertically is non-standard, but for Excalidraw I think
    // it makes sense
    y: prevElement.y + (prevElement.height - nextElement.height) / 2,
  });
};

const changeFontSize = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  app: AppClassProperties,
  getNewFontSize: (element: ExcalidrawTextElement) => number,
  fallbackValue?: ExcalidrawTextElement["fontSize"],
) => {
  const newFontSizes = new Set<number>();

  const updatedElements = changeProperty(
    elements,
    appState,
    (oldElement) => {
      if (isTextElement(oldElement)) {
        const newFontSize = getNewFontSize(oldElement);
        newFontSizes.add(newFontSize);

        let newElement: ExcalidrawTextElement = newElementWith(oldElement, {
          fontSize: newFontSize,
        });
        redrawTextBoundingBox(
          newElement,
          app.scene.getContainerElement(oldElement),
          app.scene,
        );

        newElement = offsetElementAfterFontResize(
          oldElement,
          newElement,
          app.scene,
        );

        return newElement;
      }
      return oldElement;
    },
    true,
  );

  // Update arrow elements after text elements have been updated
  getSelectedElements(elements, appState, {
    includeBoundTextElement: true,
  }).forEach((element) => {
    if (isTextElement(element)) {
      updateBoundElements(element, app.scene);
    }
  });

  return {
    elements: updatedElements,
    appState: {
      ...appState,
      // update state only if we've set all select text elements to
      // the same font size
      currentItemFontSize:
        newFontSizes.size === 1
          ? [...newFontSizes][0]
          : fallbackValue ?? appState.currentItemFontSize,
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  };
};

// -----------------------------------------------------------------------------

export const actionChangeStrokeColor = register<
  Pick<AppState, "currentItemStrokeColor" | "userCustomColors"> //zsviczian
>({
  name: "changeStrokeColor",
  label: "labels.stroke",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    //zsviczian added containers
    const containers = getSelectedElements(elements, appState, {
      includeBoundTextElement: false,
    })
      .filter((el) => el.boundElements)
      .map((el) => el.id);
    return {
      ...(value?.currentItemStrokeColor && {
        elements: changeProperty(
          elements,
          appState,
          (el) => {
            if (
              //zsviczian
              isTextElement(el) &&
              el.containerId &&
              containers.includes(el.containerId) &&
              app.scene.getContainerElement(el)?.strokeColor !== el.strokeColor
            ) {
              return el;
            }
            return hasStrokeColor(el.type)
              ? newElementWith(el, {
                  strokeColor: value.currentItemStrokeColor,
                })
              : el;
          },
          true,
        ),
      }),
      appState: {
        ...appState,
        ...value,
      },
      captureUpdate: !!value?.currentItemStrokeColor
        ? CaptureUpdateAction.IMMEDIATELY
        : CaptureUpdateAction.EVENTUALLY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app, data }) => (
    <>
      {isFullPanelMode(app) && ( //zsviczian
        <h3 aria-hidden="true">{t("labels.stroke")}</h3>
      )}
      <ColorPicker
        topPicks={computeEffectiveTopPicks( //zsviczian
          appState.colorPalette?.topPicks?.elementStroke ?? //zsviczian
          DEFAULT_ELEMENT_STROKE_PICKS, //zsviczian
          appState.userCustomColors?.topPickOverrides?.elementStroke, //zsviczian
        )} //zsviczian
        palette={
          //zsviczian
          appState.colorPalette?.elementStroke ??
          DEFAULT_ELEMENT_STROKE_COLOR_PALETTE
        }
        type="elementStroke"
        label={t("labels.stroke")}
        color={getFormValue(
          elements,
          app,
          (element) => element.strokeColor,
          true,
          (hasSelection) =>
            !hasSelection ? appState.currentItemStrokeColor : null,
          )}
        onChange={(color) => updateData({ currentItemStrokeColor: color })}
        elements={elements}
        appState={appState}
        updateData={updateData}
        userCustomColors={appState.userCustomColors} //zsviczian
        onUserCustomColorsChange={(updated: UserCustomColors) => updateData({ userCustomColors: updated })} //zsviczian
      />
    </>
  ),
});

export const actionChangeBackgroundColor = register<
  Pick<AppState, "currentItemBackgroundColor" | "viewBackgroundColor" | "userCustomColors"> //zsviczian
>({
  name: "changeBackgroundColor",
  label: "labels.changeBackground",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    if (!value?.currentItemBackgroundColor) {
      return {
        appState: {
          ...appState,
          ...value,
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    let nextElements;

    const selectedElements = app.scene.getSelectedElements(appState);
    const shouldEnablePolygon =
      !isTransparent(value.currentItemBackgroundColor) &&
      selectedElements.every(
        (el) => isLineElement(el) && canBecomePolygon(el.points),
      );

    if (shouldEnablePolygon) {
      const selectedElementsMap = arrayToMap(selectedElements);
      nextElements = elements.map((el) => {
        if (selectedElementsMap.has(el.id) && isLineElement(el)) {
          return newElementWith(el, {
            backgroundColor: value.currentItemBackgroundColor,
            ...toggleLinePolygonState(el, true),
          });
        }
        return el;
      });
    } else {
      nextElements = changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          backgroundColor: value.currentItemBackgroundColor,
        }),
      );
    }

    return {
      elements: nextElements,
      appState: {
        ...appState,
        ...value,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app, data }) => (
    <>
      {isFullPanelMode(app) && ( //zsviczian
        <h3 aria-hidden="true">{t("labels.background")}</h3>
      )}
      <ColorPicker
        topPicks={computeEffectiveTopPicks( //zsviczian
          appState.colorPalette?.topPicks?.elementBackground ?? //zsviczian
          DEFAULT_ELEMENT_BACKGROUND_PICKS, //zsviczian
          appState.userCustomColors?.topPickOverrides?.elementBackground, //zsviczian
        )} //zsviczian
        palette={
          //zsviczian
          appState.colorPalette?.elementBackground ??
          DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE
        }
        type="elementBackground"
        label={t("labels.background")}
        color={getFormValue(
          elements,
          app,
          (element) => element.backgroundColor,
          true,
          (hasSelection) =>
            !hasSelection ? appState.currentItemBackgroundColor : null,
          )}
        onChange={(color) =>
          updateData({ currentItemBackgroundColor: color })
        }
        elements={elements}
        appState={appState}
        updateData={updateData}
        userCustomColors={appState.userCustomColors} //zsviczian
        onUserCustomColorsChange={(updated: UserCustomColors) => updateData({ userCustomColors: updated })} //zsviczian
      />
    </>
  )
});

export const actionManageUserCustomColors = register<Pick<AppState, "userCustomColors">>({ //zsviczian
  name: "manageUserCustomColors", //zsviczian
  label: "labels.manageUserCustomColors", //zsviczian
  trackEvent: false, //zsviczian
  perform: (elements, appState, value) => ({ //zsviczian
    elements, //zsviczian
    appState: { ...appState, ...value }, //zsviczian
    captureUpdate: CaptureUpdateAction.EVENTUALLY, //zsviczian
  }), //zsviczian
}); //zsviczian

export const actionChangeFillStyle = register<ExcalidrawElement["fillStyle"]>({
  name: "changeFillStyle",
  label: "labels.fill",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    trackEvent(
      "element",
      "changeFillStyle",
      `${value} (${
        app.editorInterface.formFactor === "phone" ? "mobile" : "desktop"
      })`,
    );
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          fillStyle: value,
        }),
      ),
      appState: { ...appState, currentItemFillStyle: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const selectedElements = getSelectedElements(elements, appState);
    const allElementsZigZag =
      selectedElements.length > 0 &&
      selectedElements.every((el) => el.fillStyle === "zigzag");

    return (
      <fieldset>
        <legend>{t("labels.fill")}</legend>
        <div className="buttonList">
          <RadioSelection
            type="button"
            options={[
              {
                value: "hachure",
                text: `${
                  allElementsZigZag ? t("labels.zigzag") : t("labels.hachure")
                } (${getShortcutKey("Alt-Click")})`,
                icon: allElementsZigZag ? FillZigZagIcon : FillHachureIcon,
                active: allElementsZigZag ? true : undefined,
                testId: `fill-hachure`,
              },
              {
                value: "cross-hatch",
                text: t("labels.crossHatch"),
                icon: FillCrossHatchIcon,
                testId: `fill-cross-hatch`,
              },
              {
                value: "solid",
                text: t("labels.solid"),
                icon: FillSolidIcon,
                testId: `fill-solid`,
              },
              { //zsviczian
                value: "gradient", //zsviczian
                text: t("labels.gradient"), //zsviczian
                icon: FillGradientIcon, //zsviczian
                testId: "fill-gradient", //zsviczian
              }, //zsviczian
            ]}
            value={getFormValue(
              elements,
              app,
              (element) => element.fillStyle,
              (element) => element.hasOwnProperty("fillStyle"),
              (hasSelection) =>
                hasSelection ? null : appState.currentItemFillStyle,
            )}
            onClick={(value, event) => {
              const nextValue =
                event.altKey &&
                value === "hachure" &&
                selectedElements.every((el) => el.fillStyle === "hachure")
                  ? "zigzag"
                  : value;

              updateData(nextValue);
            }}
          />
        </div>
      </fieldset>
    );
  },
});

export const actionChangeGradientColor = register<Pick<AppState, "currentItemGradientColor">>({ //zsviczian
  name: "changeGradientColor", //zsviczian
  label: "labels.gradientColor", //zsviczian
  trackEvent: false, //zsviczian
  perform: (elements, appState, value) => { //zsviczian
    return { //zsviczian
      elements: changeProperty(elements, appState, (el) => //zsviczian
        newElementWith(el, { gradientColor: value?.currentItemGradientColor }), //zsviczian
      ), //zsviczian
      appState: { //zsviczian
        ...appState, //zsviczian
        ...value, //zsviczian
      }, //zsviczian
      captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
    }; //zsviczian
  }, //zsviczian
  PanelComponent: ({ elements, appState, updateData, app }) => ( //zsviczian
    <fieldset> {/* //zsviczian */}
      <legend>{t("labels.gradientColor")}</legend> {/* //zsviczian */}
      <ColorPicker //zsviczian
        topPicks={ //zsviczian
          appState.colorPalette?.topPicks?.elementBackground ?? //zsviczian
          DEFAULT_ELEMENT_BACKGROUND_PICKS //zsviczian
        } //zsviczian
        palette={ //zsviczian
          appState.colorPalette?.elementBackground ?? //zsviczian
          DEFAULT_ELEMENT_BACKGROUND_COLOR_PALETTE //zsviczian
        } //zsviczian
        type="elementBackground" //zsviczian
        label={t("labels.gradientColor")} //zsviczian
        color={getFormValue( //zsviczian
          elements, //zsviczian
          app, //zsviczian
          (element) => element.gradientColor ?? "transparent", //zsviczian
          true, //zsviczian
          (hasSelection) => //zsviczian
            !hasSelection ? appState.currentItemGradientColor ?? "transparent" : null, //zsviczian
        )} //zsviczian
        onChange={(color) => updateData({ currentItemGradientColor: color })} //zsviczian
        elements={elements} //zsviczian
        appState={appState} //zsviczian
        updateData={updateData} //zsviczian
      /> {/* //zsviczian */}
    </fieldset>
  ), //zsviczian
}); //zsviczian

// zsviczian - custom numeric input with up/down spinner buttons
const CustomSizeInput = ({
  min,
  step,
  defaultValue,
  onCommit,
  onClose,
}: {
  min: number;
  step: number;
  defaultValue: number;
  onCommit: (val: number) => void;
  onClose: () => void;
}) => {
  const [value, setValue] = useState(defaultValue);
  const commit = (v: number) => {
    if (v >= min) {
      onCommit(v);
      onClose();
    }
  };
  return (
    <div className="custom-size-input-wrapper"> {/* zsviczian */}
      <input
        type="number"
        className="custom-size-input" //zsviczian
        min={min}
        step={step}
        value={value}
        autoFocus
        onChange={(e) => setValue(Number(e.currentTarget.value))}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") commit(value);
          else if (e.key === "Escape") onClose();
        }}
        onBlur={() => {
          if (value >= min) onCommit(value);
          onClose();
        }}
      />
      <div className="custom-size-spinners"> {/* zsviczian */}
        <button
          onMouseDown={(e: React.MouseEvent) => {
            e.preventDefault(); // keep focus on input
            const next = parseFloat((value + step).toFixed(10)); //zsviczian
            setValue(next);
            onCommit(next);
          }}
          title="Increase" //zsviczian
        >
          ▲
        </button>
        <button
          onMouseDown={(e: React.MouseEvent) => {
            e.preventDefault(); // keep focus on input
            const next = parseFloat( //zsviczian
              Math.max(min, value - step).toFixed(10),
            );
            setValue(next);
            onCommit(next);
          }}
          title="Decrease" //zsviczian
        >
          ▼
        </button>
      </div>
    </div>
  );
}; //zsviczian

export const actionChangeStrokeWidth = register<
  ExcalidrawElement["strokeWidth"]
>({
  name: "changeStrokeWidth",
  label: "labels.strokeWidth",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          strokeWidth: value,
        }),
      ),
      appState: { ...appState, currentItemStrokeWidth: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app, data }) => {
    const STROKE_PRESETS = [0.5, STROKE_WIDTH.thin, STROKE_WIDTH.bold, STROKE_WIDTH.extraBold];
    const currentValue = getFormValue(
      elements,
      app,
      (element) => element.strokeWidth,
      (element) => element.hasOwnProperty("strokeWidth"),
      (hasSelection) =>
        hasSelection ? null : appState.currentItemStrokeWidth,
    );
    const isCustom =
      currentValue !== null && !STROKE_PRESETS.includes(currentValue);
    const [showInput, setShowInput] = useState(false); //zsviczian - never auto-open; prevents focus steal on selection/tool change

    return (
      <fieldset>
        <legend>{t("labels.strokeWidth")}</legend>
        <div className="buttonList">
          <RadioSelection
            group="stroke-width"
            options={[
              {
                //zsviczian
                value: 0.5,
                text: t("labels.extraThin"),
                icon: StrokeWidthThinIcon,
                subtitle: "0.5",
              },
              {
                value: STROKE_WIDTH.thin,
                text: t("labels.thin"),
                icon: StrokeWidthBaseIcon,
                testId: "strokeWidth-thin",
                subtitle: "1",
              },
              {
                value: STROKE_WIDTH.bold,
                text: t("labels.bold"),
                icon: StrokeWidthBoldIcon,
                testId: "strokeWidth-bold",
                subtitle: "2",
              },
              {
                value: STROKE_WIDTH.extraBold,
                text: t("labels.extraBold"),
                icon: StrokeWidthExtraBoldIcon,
                testId: "strokeWidth-extraBold",
                subtitle: "4",
              },
            ]}
            value={currentValue}
            onChange={(value) => {
              setShowInput(false);
              updateData(value);
            }}
          />
          <ButtonIcon
            icon={pencilIcon}
            title="Custom" //zsviczian
            subtitle={isCustom && currentValue !== null ? String(currentValue) : "Custom"} //zsviczian
            active={isCustom}
            onClick={() => setShowInput((v: boolean) => !v)}
          />
        </div>
        {showInput && ( //zsviczian
          <CustomSizeInput //zsviczian
            min={0.1}
            step={0.5}
            defaultValue={isCustom && currentValue !== null ? currentValue : 1}
            onCommit={(val) => updateData(val)}
            onClose={() => setShowInput(false)}
          />
        )}
      </fieldset>
    );
  },
});

export const actionChangeSloppiness = register<ExcalidrawElement["roughness"]>({
  name: "changeSloppiness",
  label: "labels.sloppiness",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          seed: randomInteger(),
          roughness: value,
        }),
      ),
      appState: { ...appState, currentItemRoughness: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app, data }) => (
    <fieldset>
      <legend>{t("labels.sloppiness")}</legend>
      <div className="buttonList">
        <RadioSelection
          group="sloppiness"
          options={[
            {
              value: 0,
              text: t("labels.architect"),
              icon: SloppinessArchitectIcon,
            },
            {
              value: 1,
              text: t("labels.artist"),
              icon: SloppinessArtistIcon,
            },
            {
              value: 2,
              text: t("labels.cartoonist"),
              icon: SloppinessCartoonistIcon,
            },
          ]}
          value={getFormValue(
            elements,
            app,
            (element) => element.roughness,
            (element) => element.hasOwnProperty("roughness"),
            (hasSelection) =>
              hasSelection ? null : appState.currentItemRoughness,
          )}
          onChange={(value) => updateData(value)}
        />
      </div>
    </fieldset>
  ),
});

export const actionChangeStrokeStyle = register<
  ExcalidrawElement["strokeStyle"]
>({
  name: "changeStrokeStyle",
  label: "labels.strokeStyle",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) =>
        newElementWith(el, {
          strokeStyle: value,
        }),
      ),
      appState: { ...appState, currentItemStrokeStyle: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app, data }) => (
    <fieldset>
      <legend>{t("labels.strokeStyle")}</legend>
      <div className="buttonList">
        <RadioSelection
          group="strokeStyle"
          options={[
            {
              value: "solid",
              text: t("labels.strokeStyle_solid"),
              icon: StrokeWidthBaseIcon,
            },
            {
              value: "dashed",
              text: t("labels.strokeStyle_dashed"),
              icon: StrokeStyleDashedIcon,
            },
            {
              value: "dotted",
              text: t("labels.strokeStyle_dotted"),
              icon: StrokeStyleDottedIcon,
            },
          ]}
          value={getFormValue(
            elements,
            app,
            (element) => element.strokeStyle,
            (element) => element.hasOwnProperty("strokeStyle"),
            (hasSelection) =>
              hasSelection ? null : appState.currentItemStrokeStyle,
          )}
          onChange={(value) => updateData(value)}
        />
      </div>
    </fieldset>
  ),
});

export const actionChangeOpacity = register<ExcalidrawElement["opacity"]>({
  name: "changeOpacity",
  label: "labels.opacity",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(
        elements,
        appState,
        (el) =>
          newElementWith(el, {
            opacity: value,
          }),
        true,
      ),
      appState: { ...appState, currentItemOpacity: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, app, updateData }) => {
    const opacity = getFormValue(
      elements,
      app,
      (element) => element.opacity,
      true,
      (hasSelection) => (hasSelection ? null : appState.currentItemOpacity),
    );

    return (
      <Range
        label={t("labels.opacity")}
        value={opacity ?? appState.currentItemOpacity}
        hasCommonValue={opacity !== null}
        onChange={updateData}
        min={0}
        max={100}
        step={10}
        testId="opacity"
      />
    );
  },
});

export const actionChangeArcGapAngle = register<number>({ //zsviczian
  name: "changeArcGapAngle", //zsviczian
  label: "labels.arcGapAngle", //zsviczian
  trackEvent: false, //zsviczian
  perform: (elements, appState, value) => { //zsviczian
    return { //zsviczian
      elements: changeProperty(elements, appState, (el) => { //zsviczian
        if (el.type !== "ellipse") { return el; } //zsviczian
        return newElementWith(el as ExcalidrawEllipseElement, { arcGapAngle: value }); //zsviczian
      }), //zsviczian
      appState: { ...appState, currentItemArcGapAngle: value }, //zsviczian
      captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
    }; //zsviczian
  }, //zsviczian
  PanelComponent: ({ elements, appState, app, updateData }) => { //zsviczian
    const targetElements = getTargetElements(getNonDeletedElements(elements), appState); //zsviczian
    const hasEllipse = targetElements.some((el) => el.type === "ellipse") || appState.activeTool.type === "ellipse"; //zsviczian
    if (!hasEllipse) { return null; } //zsviczian
    const arcGapDegrees = getFormValue( //zsviczian
      elements, //zsviczian
      app, //zsviczian
      (el) => el.type === "ellipse" ? Math.round(((el as ExcalidrawEllipseElement).arcGapAngle ?? 0) * (180 / Math.PI)) : null, //zsviczian
      (el) => el.type === "ellipse", //zsviczian
      (hasSelection) => hasSelection ? null : Math.round((appState.currentItemArcGapAngle ?? 0) * (180 / Math.PI)), //zsviczian
    ); //zsviczian
    const arcPresets = [ //zsviczian
      { degrees: 90, icon: ArcThreeQuarterIcon, label: t("labels.arcThreeQuarter") }, //zsviczian
      { degrees: 180, icon: ArcHalfIcon, label: t("labels.arcHalf") }, //zsviczian
      { degrees: 270, icon: ArcQuarterIcon, label: t("labels.arcQuarter") }, //zsviczian
    ]; //zsviczian
    return (
      <fieldset>
        <legend>{t("labels.arcGapAngle")}</legend>
        <div className="buttonList">
          {arcPresets.map(({ degrees, icon, label }) => (
            <ButtonIcon
              key={degrees}
              title={label}
              icon={icon}
              active={arcGapDegrees === degrees}
              onClick={() => updateData(degrees * (Math.PI / 180))}
            />
          ))}
        </div>
        <Range
          label=""
          value={arcGapDegrees ?? 0}
          hasCommonValue={arcGapDegrees !== null}
          onChange={(degrees) => updateData(degrees * (Math.PI / 180))}
          min={0}
          max={359}
          step={1}
          testId="arcGapAngle"
        />
      </fieldset>
    );
  }, //zsviczian
}); //zsviczian

export const actionChangeArcGapClosed = register<boolean>({ //zsviczian
  name: "changeArcGapClosed", //zsviczian
  label: "labels.arcGapStyle", //zsviczian
  trackEvent: false, //zsviczian
  perform: (elements, appState, value) => { //zsviczian
    return { //zsviczian
      elements: changeProperty(elements, appState, (el) => { //zsviczian
        if (el.type !== "ellipse") { return el; } //zsviczian
        return newElementWith(el as ExcalidrawEllipseElement, { arcGapClosed: value }); //zsviczian
      }), //zsviczian
      appState: { ...appState, currentItemArcGapClosed: value }, //zsviczian
      captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
    }; //zsviczian
  }, //zsviczian
  PanelComponent: ({ elements, appState, app, updateData }) => { //zsviczian
    const targetElements = getTargetElements(getNonDeletedElements(elements), appState); //zsviczian
    const hasArcWithGap = targetElements.some( //zsviczian
      (el) => el.type === "ellipse" && ((el as ExcalidrawEllipseElement).arcGapAngle ?? 0) > 0, //zsviczian
    ); //zsviczian
    if (!hasArcWithGap) { return null; } //zsviczian
    const arcGapClosed = getFormValue( //zsviczian
      elements, //zsviczian
      app, //zsviczian
      (el) => el.type === "ellipse" && ((el as ExcalidrawEllipseElement).arcGapAngle ?? 0) > 0 //zsviczian
        ? ((el as ExcalidrawEllipseElement).arcGapClosed ?? false) //zsviczian
        : null, //zsviczian
      (el) => el.type === "ellipse" && ((el as ExcalidrawEllipseElement).arcGapAngle ?? 0) > 0, //zsviczian
      (hasSelection) => hasSelection ? null : (appState.currentItemArcGapClosed ?? false), //zsviczian
    ); //zsviczian
    return (
      <fieldset>
        <legend>{t("labels.arcGapStyle")}</legend>
        <div className="buttonList">
          <RadioSelection
            group="arcGapClosed"
            options={[
              { value: false, text: t("labels.arcOpen"), icon: ArcOpenIcon },
              { value: true, text: t("labels.arcClosed"), icon: ArcClosedIcon },
            ]}
            value={arcGapClosed ?? false}
            onChange={(value) => updateData(value)}
          />
        </div>
      </fieldset>
    );
  }, //zsviczian
}); //zsviczian

export const actionChangeRectGapSide = register<"top" | "bottom" | "left" | "right" | null>({ //zsviczian
  name: "changeRectGapSide", //zsviczian
  label: "labels.rectGapSide", //zsviczian
  trackEvent: false, //zsviczian
  perform: (elements, appState, value) => { //zsviczian
    return { //zsviczian
      elements: changeProperty(elements, appState, (el) => { //zsviczian
        if (el.type !== "rectangle") { return el; } //zsviczian
        return newElementWith(el as ExcalidrawRectangleElement, { rectGapSide: value }); //zsviczian
      }), //zsviczian
      appState: { ...appState, currentItemRectGapSide: value }, //zsviczian
      captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
    }; //zsviczian
  }, //zsviczian
  PanelComponent: ({ elements, appState, app, updateData }) => { //zsviczian
    const targetElements = getTargetElements(getNonDeletedElements(elements), appState); //zsviczian
    const hasRect = targetElements.some((el) => el.type === "rectangle") || appState.activeTool.type === "rectangle"; //zsviczian
    if (!hasRect) { return null; } //zsviczian
    const rectGapSide = getFormValue( //zsviczian
      elements, //zsviczian
      app, //zsviczian
      (el) => el.type === "rectangle" ? ((el as ExcalidrawRectangleElement).rectGapSide ?? null) : null, //zsviczian
      (el) => el.type === "rectangle", //zsviczian
      (hasSelection) => hasSelection ? null : appState.currentItemRectGapSide, //zsviczian
    ); //zsviczian
    const sides = [ //zsviczian
      { value: null, icon: RectGapNoneIcon, label: t("labels.rectGapNone") }, //zsviczian
      { value: "top", icon: RectGapTopIcon, label: t("labels.rectGapTop") }, //zsviczian
      { value: "bottom", icon: RectGapBottomIcon, label: t("labels.rectGapBottom") }, //zsviczian
      { value: "left", icon: RectGapLeftIcon, label: t("labels.rectGapLeft") }, //zsviczian
      { value: "right", icon: RectGapRightIcon, label: t("labels.rectGapRight") }, //zsviczian
    ]; //zsviczian
    return (
      <fieldset>
        <legend>{t("labels.rectGapSide")}</legend>
        <div className="buttonList">
          {sides.map((s) => (
            <ButtonIcon
              key={String(s.value)}
              icon={s.icon}
              title={s.label}
              active={rectGapSide === s.value}
              onClick={() => updateData(s.value)}
            />
          ))}
        </div>
      </fieldset>
    );
  }, //zsviczian
}); //zsviczian

export const actionChangeRectGapSize = register<number>({ //zsviczian
  name: "changeRectGapSize", //zsviczian
  label: "labels.rectGapSize", //zsviczian
  trackEvent: false, //zsviczian
  perform: (elements, appState, value) => { //zsviczian
    return { //zsviczian
      elements: changeProperty(elements, appState, (el) => { //zsviczian
        if (el.type !== "rectangle") { return el; } //zsviczian
        return newElementWith(el as ExcalidrawRectangleElement, { rectGapSize: value }); //zsviczian
      }), //zsviczian
      appState: { ...appState, currentItemRectGapSize: value }, //zsviczian
      captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
    }; //zsviczian
  }, //zsviczian
  PanelComponent: ({ elements, appState, app, updateData }) => { //zsviczian
    const targetElements = getTargetElements(getNonDeletedElements(elements), appState); //zsviczian
    const hasRectWithGap = targetElements.some( //zsviczian
      (el) => el.type === "rectangle" && (el as ExcalidrawRectangleElement).rectGapSide != null, //zsviczian
    ); //zsviczian
    if (!hasRectWithGap) { return null; } //zsviczian
    const rectGapSize = getFormValue( //zsviczian
      elements, //zsviczian
      app, //zsviczian
      (el) => el.type === "rectangle" && (el as ExcalidrawRectangleElement).rectGapSide != null //zsviczian
        ? ((el as ExcalidrawRectangleElement).rectGapSize ?? 1) //zsviczian
        : null, //zsviczian
      (el) => el.type === "rectangle" && (el as ExcalidrawRectangleElement).rectGapSide != null, //zsviczian
      (hasSelection) => hasSelection ? null : appState.currentItemRectGapSize, //zsviczian
    ); //zsviczian
    const pct = Math.round((rectGapSize ?? 1) * 100); //zsviczian
    return (
      <fieldset>
        <legend>{t("labels.rectGapSize")}</legend>
        <Range
          label=""
          min={1}
          max={100}
          step={1}
          value={pct}
          hasCommonValue={rectGapSize !== null}
          onChange={(v) => updateData(v / 100)}
          testId="rectGapSize"
        />
      </fieldset>
    );
  }, //zsviczian
}); //zsviczian

export const actionChangeRectGapDepth = register<number>({ //zsviczian
  name: "changeRectGapDepth", //zsviczian
  label: "labels.rectGapDepth", //zsviczian
  trackEvent: false, //zsviczian
  perform: (elements, appState, value) => { //zsviczian
    return { //zsviczian
      elements: changeProperty(elements, appState, (el) => { //zsviczian
        if (el.type !== "rectangle") { return el; } //zsviczian
        return newElementWith(el as ExcalidrawRectangleElement, { rectGapDepth: value }); //zsviczian
      }), //zsviczian
      appState: { ...appState, currentItemRectGapDepth: value }, //zsviczian
      captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
    }; //zsviczian
  }, //zsviczian
  PanelComponent: ({ elements, appState, app, updateData }) => { //zsviczian
    const targetElements = getTargetElements(getNonDeletedElements(elements), appState); //zsviczian
    const hasRectWithGap = targetElements.some( //zsviczian
      (el) => el.type === "rectangle" && (el as ExcalidrawRectangleElement).rectGapSide != null, //zsviczian
    ); //zsviczian
    if (!hasRectWithGap) { return null; } //zsviczian
    const rectGapDepth = getFormValue( //zsviczian
      elements, //zsviczian
      app, //zsviczian
      (el) => el.type === "rectangle" && (el as ExcalidrawRectangleElement).rectGapSide != null //zsviczian
        ? ((el as ExcalidrawRectangleElement).rectGapDepth ?? 0) //zsviczian
        : null, //zsviczian
      (el) => el.type === "rectangle" && (el as ExcalidrawRectangleElement).rectGapSide != null, //zsviczian
      (hasSelection) => hasSelection ? null : appState.currentItemRectGapDepth, //zsviczian
    ); //zsviczian
    const pct = Math.round((rectGapDepth ?? 0) * 100); //zsviczian
    return (
      <fieldset>
        <legend>{t("labels.rectGapDepth")}</legend>
        <Range
          label=""
          min={0}
          max={100}
          step={1}
          value={pct}
          hasCommonValue={rectGapDepth !== null}
          onChange={(v) => updateData(v / 100)}
          testId="rectGapDepth"
        />
      </fieldset>
    );
  }, //zsviczian
}); //zsviczian

export const actionChangeTriGapVertex = register<"top" | "bottom-left" | "bottom-right" | null>({ //zsviczian
  name: "changeTriGapVertex", //zsviczian
  label: "labels.triGapVertex", //zsviczian
  trackEvent: false, //zsviczian
  perform: (elements, appState, value) => { //zsviczian
    return { //zsviczian
      elements: changeProperty(elements, appState, (el) => { //zsviczian
        if (el.type !== "triangle") { return el; } //zsviczian
        return newElementWith(el as ExcalidrawTriangleElement, { triGapVertex: value }); //zsviczian
      }), //zsviczian
      appState: { ...appState, currentItemTriGapVertex: value }, //zsviczian
      captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
    }; //zsviczian
  }, //zsviczian
  PanelComponent: ({ elements, appState, app, updateData }) => { //zsviczian
    const targetElements = getTargetElements(getNonDeletedElements(elements), appState); //zsviczian
    const hasTri = targetElements.some((el) => el.type === "triangle") || appState.activeTool.type === "triangle"; //zsviczian
    if (!hasTri) { return null; } //zsviczian
    const triGapVertex = getFormValue( //zsviczian
      elements, //zsviczian
      app, //zsviczian
      (el) => el.type === "triangle" ? ((el as ExcalidrawTriangleElement).triGapVertex ?? null) : null, //zsviczian
      (el) => el.type === "triangle", //zsviczian
      (hasSelection) => hasSelection ? null : appState.currentItemTriGapVertex, //zsviczian
    ); //zsviczian
    const vertices = [ //zsviczian
      { value: null, icon: TriGapNoneIcon, label: t("labels.triGapNone") }, //zsviczian
      { value: "top", icon: TriGapTopIcon, label: t("labels.triGapTop") }, //zsviczian
      { value: "bottom-left", icon: TriGapBottomLeftIcon, label: t("labels.triGapBottomLeft") }, //zsviczian
      { value: "bottom-right", icon: TriGapBottomRightIcon, label: t("labels.triGapBottomRight") }, //zsviczian
    ]; //zsviczian
    return (
      <fieldset>
        <legend>{t("labels.triGapVertex")}</legend>
        <div className="buttonList">
          {vertices.map((v) => (
            <ButtonIcon
              key={String(v.value)}
              icon={v.icon}
              title={v.label}
              active={triGapVertex === v.value}
              onClick={() => updateData(v.value)}
            />
          ))}
        </div>
      </fieldset>
    );
  }, //zsviczian
}); //zsviczian

export const actionChangeTriGapSize = register<number>({ //zsviczian
  name: "changeTriGapSize", //zsviczian
  label: "labels.triGapSize", //zsviczian
  trackEvent: false, //zsviczian
  perform: (elements, appState, value) => { //zsviczian
    return { //zsviczian
      elements: changeProperty(elements, appState, (el) => { //zsviczian
        if (el.type !== "triangle") { return el; } //zsviczian
        return newElementWith(el as ExcalidrawTriangleElement, { triGapSize: value }); //zsviczian
      }), //zsviczian
      appState: { ...appState, currentItemTriGapSize: value }, //zsviczian
      captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
    }; //zsviczian
  }, //zsviczian
  PanelComponent: ({ elements, appState, app, updateData }) => { //zsviczian
    const targetElements = getTargetElements(getNonDeletedElements(elements), appState); //zsviczian
    const hasTriWithGap = targetElements.some( //zsviczian
      (el) => el.type === "triangle" && (el as ExcalidrawTriangleElement).triGapVertex != null, //zsviczian
    ); //zsviczian
    if (!hasTriWithGap) { return null; } //zsviczian
    const triGapSize = getFormValue( //zsviczian
      elements, //zsviczian
      app, //zsviczian
      (el) => el.type === "triangle" && (el as ExcalidrawTriangleElement).triGapVertex != null //zsviczian
        ? ((el as ExcalidrawTriangleElement).triGapSize ?? 0.5) //zsviczian
        : null, //zsviczian
      (el) => el.type === "triangle" && (el as ExcalidrawTriangleElement).triGapVertex != null, //zsviczian
      (hasSelection) => hasSelection ? null : appState.currentItemTriGapSize, //zsviczian
    ); //zsviczian
    const pct = Math.round((triGapSize ?? 0.5) * 100); //zsviczian
    return (
      <fieldset>
        <legend>{t("labels.triGapSize")}</legend>
        <Range
          label=""
          min={1}
          max={100}
          step={1}
          value={pct}
          hasCommonValue={triGapSize !== null}
          onChange={(v) => updateData(v / 100)}
          testId="triGapSize"
        />
      </fieldset>
    );
  }, //zsviczian
}); //zsviczian

export const actionChangeTriGapClosed = register<boolean>({ //zsviczian
  name: "changeTriGapClosed", //zsviczian
  label: "labels.triGapClosed", //zsviczian
  trackEvent: false, //zsviczian
  perform: (elements, appState, value) => { //zsviczian
    return { //zsviczian
      elements: changeProperty(elements, appState, (el) => { //zsviczian
        if (el.type !== "triangle") { return el; } //zsviczian
        return newElementWith(el as ExcalidrawTriangleElement, { triGapClosed: value }); //zsviczian
      }), //zsviczian
      appState: { ...appState, currentItemTriGapClosed: value }, //zsviczian
      captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
    }; //zsviczian
  }, //zsviczian
  PanelComponent: ({ elements, appState, app, updateData }) => { //zsviczian
    const targetElements = getTargetElements(getNonDeletedElements(elements), appState); //zsviczian
    const hasTriWithGap = targetElements.some( //zsviczian
      (el) => el.type === "triangle" && (el as ExcalidrawTriangleElement).triGapVertex != null, //zsviczian
    ); //zsviczian
    if (!hasTriWithGap) { return null; } //zsviczian
    const triGapClosed = getFormValue( //zsviczian
      elements, //zsviczian
      app, //zsviczian
      (el) => el.type === "triangle" && (el as ExcalidrawTriangleElement).triGapVertex != null //zsviczian
        ? ((el as ExcalidrawTriangleElement).triGapClosed ?? true) //zsviczian
        : null, //zsviczian
      (el) => el.type === "triangle" && (el as ExcalidrawTriangleElement).triGapVertex != null, //zsviczian
      (hasSelection) => hasSelection ? null : appState.currentItemTriGapClosed, //zsviczian
    ); //zsviczian
    return (
      <fieldset>
        <legend>{t("labels.triGapClosed")}</legend>
        <div className="buttonList">
          <RadioSelection
            group="triGapClosed"
            options={[
              { value: false, text: t("labels.triGapOpen"), icon: ArcOpenIcon }, //zsviczian
              { value: true, text: t("labels.triGapClosedLabel"), icon: ArcClosedIcon }, //zsviczian
            ]}
            value={triGapClosed ?? true}
            onChange={(value) => updateData(value)}
          />
        </div>
      </fieldset>
    );
  }, //zsviczian
}); //zsviczian

let scaleFontSize = false; //zsviczian
let useFibonacci = false; //zsviczian
//zsviczian
//with a random noise of +-0.05 to avoid duplicates
const fibonacciValues = [
  [
    177.38, 109.63, 67.75, 41.9, 25.91, 16, 9.9, 6.14, 3.83, 2.29, 1.47, 0.9,
    0.57,
  ],
  [
    287.06, 177.43, 109.64, 67.73, 41.92, 26, 16.01, 9.92, 6.1, 3.75, 2.34,
    1.41, 0.87,
  ],
  [
    464.44, 287.11, 177.44, 109.65, 67.76, 42, 25.9, 15.97, 9.93, 6.12, 3.82,
    2.3, 1.46,
  ],
  [
    751.52, 464.45, 287.08, 177.42, 109.67, 68, 41.89, 25.93, 15.99, 9.88, 6.07,
    3.77, 2.35,
  ],
];

//zsviczian
const normalValues = [
  [
    182.22, 121.46, 80, 53, 35.99, 23.96, 16, 10.68, 7.1, 4.74, 3.16, 2.11,
    1.45, 0.97, 0.66,
  ],
  [
    227.82, 151.88, 101.25, 67.51, 44.95, 29.98, 20, 13.31, 8.85, 5.97, 3.95,
    2.68, 1.77, 1.19, 0.82,
  ],
  [
    318.96, 212.59, 141.8, 94.51, 62.98, 42.01, 28, 18.63, 12.45, 8.26, 5.52,
    3.7, 2.47, 1.61, 1.07,
  ],
  [
    410.02, 273.42, 182.28, 121.5, 81, 54, 36, 24.01, 16.05, 10.69, 7.13, 4.78,
    3.12, 2.07, 1.38,
  ],
];

//zsviczian
const valueToIndex: { [key: number]: number } = {
  16: 0,
  20: 1,
  28: 2,
  36: 3,
};

//zsviczian
const getFibonacciFontSize = (zoom: number, buttonValue: number): number => {
  const index = valueToIndex[buttonValue];
  if (typeof index !== "number") {
    return buttonValue;
  }
  const range = [
    [0, 0.12],
    [0.12, 0.19],
    [0.19, 0.31],
    [0.31, 0.5],
    [0.5, 0.81],
    [0.81, 1.31],
    [1.31, 2.12],
    [2.12, 3.43],
    [3.43, 5.54],
    [5.54, 8.97],
    [8.97, 14.52],
    [14.52, 23.49],
    [23.49, 100],
  ];
  for (let i = 0; i < range.length; i++) {
    const [from, to] = range[i];
    if (zoom >= from && zoom < to) {
      return fibonacciValues[index][i];
      break;
    }
  }
  return buttonValue;
};

//zsviczian
const getScaledFontSize = (zoom: number, buttonValue: number): number => {
  const index = valueToIndex[buttonValue];
  if (typeof index !== "number") {
    return buttonValue;
  }
  const range = [
    [0, 0.11],
    [0.11, 0.16],
    [0.16, 0.25],
    [0.25, 0.37],
    [0.37, 0.56],
    [0.56, 0.83],
    [0.83, 1.25],
    [1.25, 1.88],
    [1.88, 2.81],
    [2.81, 4.22],
    [4.22, 6.33],
    [6.33, 9.49],
    [9.49, 14.24],
    [14.24, 21.36],
    [21.36, 100],
  ];
  for (let i = 0; i < range.length; i++) {
    const [from, to] = range[i];
    if (zoom >= from && zoom < to) {
      return normalValues[index][i];
      break;
    }
  }
  return buttonValue;
};

//zsviczian
const findIndex = (values: number[][], value: number): number | null => {
  for (let i = 0; i < values.length; i++) {
    const idx = values[i].indexOf(value);
    if (idx !== -1) {
      return i;
    }
  }
  return null;
};

//zsviczian
export const getFontSize = (size: number, zoom: number): number => {
  zoom = scaleFontSize ? zoom : 1;
  let normalizedSizeIdx = findIndex(fibonacciValues, size);
  if (!normalizedSizeIdx) {
    normalizedSizeIdx = findIndex(normalValues, size);
  }
  if (normalizedSizeIdx === null) {
    return size;
  }
  size = [16, 20, 28, 36][normalizedSizeIdx];
  const nextValue = useFibonacci
    ? getFibonacciFontSize(zoom, size)
    : getScaledFontSize(zoom, size);
  return nextValue ?? size;
};

export const actionChangeFontSize = register<ExcalidrawTextElement["fontSize"]>(
  {
    name: "changeFontSize",
    label: "labels.fontSize",
    trackEvent: false,
    perform: (elements, appState, value, app) => {
      return changeFontSize(
        elements,
        appState,
        app,
        () => {
          invariant(value, "actionChangeFontSize: Expected a font size value");
          return value;
        },
        value,
      );
    },
    PanelComponent: ({ elements, appState, updateData, app, data }) => {
      // zsviczian - start insert
      let selectedElements = getSelectedElements(elements, appState).filter(
        (el) => isTextElement(el),
      ) as ExcalidrawTextElement[];
      if (selectedElements.length === 0) {
        selectedElements = (
          appState.editingTextElement ? [appState.editingTextElement] : []
        ) as ExcalidrawTextElement[];
      }
      const size = selectedElements[0]?.fontSize;
      let idx: number | null = null;
      if (size && selectedElements.every((el) => el.fontSize === size)) {
        idx = findIndex(normalValues, size);
        if (idx === null) {
          idx = findIndex(fibonacciValues, size);
        }
      }
      const isSmall = idx === 0;
      const isMedium = idx === 1;
      const isLarge = idx === 2;
      const isVeryLarge = idx === 3;
      const isCustom = size !== undefined && idx === null; //zsviczian
      // zsviczian - end insert

      const { isCompact } = getStylesPanelInfo(app);
      const [showFontSizeInput, setShowFontSizeInput] = useState(false); //zsviczian - never auto-open; prevents focus steal on selection/tool change

      return (
        <fieldset>
          <legend>{t("labels.fontSize")}</legend>
          <div className="buttonList">
            <RadioSelection
              type="button" //zsviczian
              //group="font-size" //zsviczian
              options={[
                {
                  value: FONT_SIZES.sm,
                  text: `${t("labels.small")}\nSHIFT: zoomed, ALT/OPT: Fibonacci`, //zsviczian
                  icon: FontSizeSmallIcon,
                  testId: "fontSize-small",
                  active: isSmall ? true : undefined, //zsviczian
                  subtitle: String(FONT_SIZES.sm), //zsviczian
                },
                {
                  value: FONT_SIZES.md,
                  text: `${t("labels.medium")}\nSHIFT: zoomed, ALT/OPT: Fibonacci`, //zsviczian
                  icon: FontSizeMediumIcon,
                  testId: "fontSize-medium",
                  active: isMedium ? true : undefined, //zsviczian
                  subtitle: String(FONT_SIZES.md), //zsviczian
                },
                {
                  value: FONT_SIZES.lg,
                  text: `${t("labels.large")}\nSHIFT: zoomed, ALT/OPT: Fibonacci`, //zsviczian
                  icon: FontSizeLargeIcon,
                  testId: "fontSize-large",
                  active: isLarge ? true : undefined, //zsviczian
                  subtitle: String(FONT_SIZES.lg), //zsviczian
                },
                {
                  value: FONT_SIZES.xl,
                  text: `${t(
                    "labels.veryLarge",
                  )}\nSHIFT: zoomed, ALT/OPT: Fibonacci`, //zsviczian
                  icon: FontSizeExtraLargeIcon,
                  testId: "fontSize-veryLarge",
                  active: isVeryLarge ? true : undefined, //zsviczian
                  subtitle: String(FONT_SIZES.xl), //zsviczian
                },
              ]}
              value={getFormValue(
                elements,
                app,
                (element) => {
                  if (isTextElement(element)) {
                    return element.fontSize;
                  }
                  const boundTextElement = getBoundTextElement(
                    element,
                    app.scene.getNonDeletedElementsMap(),
                  );
                  if (boundTextElement) {
                    return boundTextElement.fontSize;
                  }
                  return null;
                },
                (element) =>
                  isTextElement(element) ||
                  getBoundTextElement(
                    element,
                    app.scene.getNonDeletedElementsMap(),
                  ) !== null,
                (hasSelection) =>
                  hasSelection
                    ? null
                    : appState.currentItemFontSize || DEFAULT_FONT_SIZE,
              )}
              //zsviczian onClick
              onClick={(
                value: number,
                event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
              ) => {
                scaleFontSize = event.shiftKey;
                useFibonacci = event.altKey;
                setShowFontSizeInput(false); //zsviczian
                withCaretPositionPreservation(
                  () => updateData(getFontSize(value, appState.zoom.value)),
                  isCompact,
                  !!appState.editingTextElement,
                  data?.onPreventClose,
                );
              }}
              /* onChange={(value) => {
                withCaretPositionPreservation(
                  () => updateData(value),
                  isCompact,
                  !!appState.editingTextElement,
                  data?.onPreventClose,
                );
              }}*/ //zsviczian
            />
            {/* zsviczian - custom font size button */}
            <ButtonIcon
              icon={pencilIcon}
              title="Custom" //zsviczian
              subtitle={isCustom && size ? String(Math.round(size * 2) / 2) : "Custom"} //zsviczian
              active={isCustom}
              onClick={() => setShowFontSizeInput((v: boolean) => !v)}
            />
          </div>
          {/* zsviczian - custom font size input */}
          {showFontSizeInput && (
            <CustomSizeInput //zsviczian
              min={1}
              step={1}
              defaultValue={isCustom && size ? size : DEFAULT_FONT_SIZE}
              onCommit={(val) =>
                withCaretPositionPreservation(
                  () => updateData(val),
                  isCompact,
                  !!appState.editingTextElement,
                  data?.onPreventClose,
                )
              }
              onClose={() => setShowFontSizeInput(false)}
            />
          )}
        </fieldset>
      );
    },
  }
);

export const actionDecreaseFontSize = register({
  name: "decreaseFontSize",
  label: "labels.decreaseFontSize",
  icon: fontSizeIcon,
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    return changeFontSize(elements, appState, app, (element) =>
      Math.round(
        // get previous value before relative increase (doesn't work fully
        // due to rounding and float precision issues)
        (1 / (1 + FONT_SIZE_RELATIVE_INCREASE_STEP)) * element.fontSize,
      ),
    );
  },
  keyTest: (event) => {
    return (
      event[KEYS.CTRL_OR_CMD] &&
      event.shiftKey &&
      // KEYS.COMMA needed for MacOS
      (event.key === KEYS.CHEVRON_LEFT || event.key === KEYS.COMMA)
    );
  },
});

export const actionIncreaseFontSize = register({
  name: "increaseFontSize",
  label: "labels.increaseFontSize",
  icon: fontSizeIcon,
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    return changeFontSize(elements, appState, app, (element) =>
      Math.round(element.fontSize * (1 + FONT_SIZE_RELATIVE_INCREASE_STEP)),
    );
  },
  keyTest: (event) => {
    return (
      event[KEYS.CTRL_OR_CMD] &&
      event.shiftKey &&
      // KEYS.PERIOD needed for MacOS
      (event.key === KEYS.CHEVRON_RIGHT || event.key === KEYS.PERIOD)
    );
  },
});

type ChangeFontFamilyData = Partial<
  Pick<
    AppState,
    "openPopup" | "currentItemFontFamily" | "currentHoveredFontFamily"
  >
> & {
  /** cache of selected & editing elements populated on opened popup */
  cachedElements?: ElementsMap;
  /** flag to reset all elements to their cached versions  */
  resetAll?: true;
  /** flag to reset all containers to their cached versions */
  resetContainers?: true;
};

export const actionChangeFontFamily = register<{
  currentItemFontFamily: any;
  currentHoveredFontFamily: any;
}>({
  name: "changeFontFamily",
  label: "labels.fontFamily",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    const { cachedElements, resetAll, resetContainers, ...nextAppState } =
      value as ChangeFontFamilyData;

    if (resetAll) {
      const nextElements = changeProperty(
        elements,
        appState,
        (element) => {
          const cachedElement = cachedElements?.get(element.id);
          if (cachedElement) {
            const newElement = newElementWith(element, {
              ...cachedElement,
            });

            return newElement;
          }

          return element;
        },
        true,
      );

      return {
        elements: nextElements,
        appState: {
          ...appState,
          ...nextAppState,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      };
    }

    invariant(value, "actionChangeFontFamily: value must be defined");

    const { currentItemFontFamily, currentHoveredFontFamily } = value;

    let nextCaptureUpdateAction: CaptureUpdateActionType =
      CaptureUpdateAction.EVENTUALLY;
    let nextFontFamily: FontFamilyValues | undefined;
    let skipOnHoverRender = false;

    if (currentItemFontFamily) {
      nextFontFamily = currentItemFontFamily;
      nextCaptureUpdateAction = CaptureUpdateAction.IMMEDIATELY;
    } else if (currentHoveredFontFamily) {
      nextFontFamily = currentHoveredFontFamily;
      nextCaptureUpdateAction = CaptureUpdateAction.EVENTUALLY;

      const selectedTextElements = getSelectedElements(elements, appState, {
        includeBoundTextElement: true,
      }).filter((element) => isTextElement(element));

      // skip on hover re-render for more than 200 text elements or for text element with more than 5000 chars combined
      if (selectedTextElements.length > 200) {
        skipOnHoverRender = true;
      } else {
        let i = 0;
        let textLengthAccumulator = 0;

        while (
          i < selectedTextElements.length &&
          textLengthAccumulator < 5000
        ) {
          const textElement = selectedTextElements[i] as ExcalidrawTextElement;
          textLengthAccumulator += textElement?.originalText.length || 0;
          i++;
        }

        if (textLengthAccumulator > 5000) {
          skipOnHoverRender = true;
        }
      }
    }

    const result = {
      appState: {
        ...appState,
        ...nextAppState,
      },
      captureUpdate: nextCaptureUpdateAction,
    };

    if (nextFontFamily && !skipOnHoverRender) {
      const elementContainerMapping = new Map<
        ExcalidrawTextElement,
        ExcalidrawElement | null
      >();
      let uniqueChars = new Set<string>();
      let skipFontFaceCheck = false;

      const fontsCache = Array.from(Fonts.loadedFontsCache.values());
      const fontFamily = Object.entries(FONT_FAMILY).find(
        ([_, value]) => value === nextFontFamily,
      )?.[0];

      // skip `document.font.check` check on hover, if at least one font family has loaded as it's super slow (could result in slightly different bbox, which is fine)
      if (
        currentHoveredFontFamily &&
        fontFamily &&
        fontsCache.some((sig) => sig.startsWith(fontFamily))
      ) {
        skipFontFaceCheck = true;
      }

      // following causes re-render so make sure we changed the family
      // otherwise it could cause unexpected issues, such as preventing opening the popover when in wysiwyg
      Object.assign(result, {
        elements: changeProperty(
          elements,
          appState,
          (oldElement) => {
            if (
              isTextElement(oldElement) &&
              (oldElement.fontFamily !== nextFontFamily ||
                currentItemFontFamily) // force update on selection
            ) {
              const newElement: ExcalidrawTextElement = newElementWith(
                oldElement,
                {
                  fontFamily: nextFontFamily,
                  lineHeight: getLineHeight(nextFontFamily!),
                },
              );

              const cachedContainer =
                cachedElements?.get(oldElement.containerId || "") || {};

              const container = app.scene.getContainerElement(oldElement);

              if (resetContainers && container && cachedContainer) {
                // reset the container back to it's cached version
                app.scene.mutateElement(container, { ...cachedContainer });
              }

              if (!skipFontFaceCheck) {
                uniqueChars = new Set([
                  ...uniqueChars,
                  ...Array.from(newElement.originalText),
                ]);
              }

              elementContainerMapping.set(newElement, container);

              return newElement;
            }

            return oldElement;
          },
          true,
        ),
      });

      // size is irrelevant, but necessary
      const fontString = `10px ${getFontFamilyString({
        fontFamily: nextFontFamily,
      })}`;
      const chars = Array.from(uniqueChars.values()).join();

      if (skipFontFaceCheck || window.document.fonts.check(fontString, chars)) {
        // we either skip the check (have at least one font face loaded) or do the check and find out all the font faces have loaded
        for (const [element, container] of elementContainerMapping) {
          // trigger synchronous redraw
          redrawTextBoundingBox(element, container, app.scene);
        }
      } else {
        // otherwise try to load all font faces for the given chars and redraw elements once our font faces loaded
        window.document.fonts.load(fontString, chars).then((fontFaces) => {
          for (const [element, container] of elementContainerMapping) {
            // use latest element state to ensure we don't have closure over an old instance in order to avoid possible race conditions (i.e. font faces load out-of-order while rapidly switching fonts)
            const latestElement = app.scene.getElement(element.id);
            const latestContainer = container
              ? app.scene.getElement(container.id)
              : null;

            if (latestElement) {
              // trigger async redraw
              redrawTextBoundingBox(
                latestElement as ExcalidrawTextElement,
                latestContainer,
                app.scene,
              );
            }
          }

          // trigger update once we've mutated all the elements, which also updates our cache
          app.fonts.onLoaded(fontFaces);
        });
      }
    }

    return result;
  },
  PanelComponent: ({ elements, appState, app, updateData }) => {
    const cachedElementsRef = useRef<ElementsMap>(new Map());
    const prevSelectedFontFamilyRef = useRef<number | null>(null);
    // relying on state batching as multiple `FontPicker` handlers could be called in rapid succession and we want to combine them
    const [batchedData, setBatchedData] = useState<ChangeFontFamilyData>({});
    const isUnmounted = useRef(true);
    const { stylesPanelMode, isCompact } = getStylesPanelInfo(app);

    const selectedFontFamily = useMemo(() => {
      const getFontFamily = (
        elementsArray: readonly ExcalidrawElement[],
        elementsMap: ElementsMap,
      ) =>
        getFormValue(
          elementsArray,
          app,
          (element) => {
            if (isTextElement(element)) {
              return element.fontFamily;
            }
            const boundTextElement = getBoundTextElement(element, elementsMap);
            if (boundTextElement) {
              return boundTextElement.fontFamily;
            }
            return null;
          },
          (element) =>
            isTextElement(element) ||
            getBoundTextElement(element, elementsMap) !== null,
          (hasSelection) =>
            hasSelection
              ? null
              : appState.currentItemFontFamily || DEFAULT_FONT_FAMILY,
        );

      // popup opened, use cached elements
      if (
        batchedData.openPopup === "fontFamily" &&
        appState.openPopup === "fontFamily"
      ) {
        return getFontFamily(
          Array.from(cachedElementsRef.current?.values() ?? []),
          cachedElementsRef.current,
        );
      }

      // popup closed, use all elements
      if (!batchedData.openPopup && appState.openPopup !== "fontFamily") {
        return getFontFamily(elements, app.scene.getNonDeletedElementsMap());
      }

      // popup props are not in sync, hence we are in the middle of an update, so keeping the previous value we've had
      return prevSelectedFontFamilyRef.current;
    }, [batchedData.openPopup, appState, elements, app]);

    useEffect(() => {
      prevSelectedFontFamilyRef.current = selectedFontFamily;
    }, [selectedFontFamily]);

    useEffect(() => {
      if (Object.keys(batchedData).length) {
        updateData(batchedData);
        // reset the data after we've used the data
        setBatchedData({});
      }
      // call update only on internal state changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [batchedData]);

    useEffect(() => {
      isUnmounted.current = false;

      return () => {
        isUnmounted.current = true;
      };
    }, []);

    return (
      <>
        {isFullPanelMode(app) && ( //zsviczian
          <legend>{t("labels.fontFamily")}</legend>
        )}
        <FontPicker
          isOpened={appState.openPopup === "fontFamily"}
          selectedFontFamily={selectedFontFamily}
          hoveredFontFamily={appState.currentHoveredFontFamily}
          compactMode={!isFullPanelMode(app) /*zsviczian*/}
          onSelect={(fontFamily) => {
            withCaretPositionPreservation(
              () => {
                setBatchedData({
                  openPopup: null,
                  currentHoveredFontFamily: null,
                  currentItemFontFamily: fontFamily,
                });
                // defensive clear so immediate close won't abuse the cached elements
                cachedElementsRef.current.clear();
              },
              isCompact,
              !!appState.editingTextElement,
            );
          }}
          onHover={(fontFamily) => {
            setBatchedData({
              currentHoveredFontFamily: fontFamily,
              cachedElements: new Map(cachedElementsRef.current),
              resetContainers: true,
            });
          }}
          onLeave={() => {
            setBatchedData({
              currentHoveredFontFamily: null,
              cachedElements: new Map(cachedElementsRef.current),
              resetAll: true,
            });
          }}
          onPopupChange={(open) => {
            if (open) {
              // open, populate the cache from scratch
              cachedElementsRef.current.clear();

              const { editingTextElement } = appState;

              // still check type to be safe
              if (editingTextElement?.type === "text") {
                // retrieve the latest version from the scene, as `editingTextElement` isn't mutated
                const latesteditingTextElement = app.scene.getElement(
                  editingTextElement.id,
                );

                // inside the wysiwyg editor
                cachedElementsRef.current.set(
                  editingTextElement.id,
                  newElementWith(
                    latesteditingTextElement || editingTextElement,
                    {},
                    true,
                  ),
                );
              } else {
                const selectedElements = getSelectedElements(
                  elements,
                  appState,
                  {
                    includeBoundTextElement: true,
                  },
                );

                for (const element of selectedElements) {
                  cachedElementsRef.current.set(
                    element.id,
                    newElementWith(element, {}, true),
                  );
                }
              }

              setBatchedData({
                ...batchedData,
                openPopup: "fontFamily",
              });
            } else {
              const fontFamilyData = {
                currentHoveredFontFamily: null,
                cachedElements: new Map(cachedElementsRef.current),
                resetAll: true,
              } as ChangeFontFamilyData;

              setBatchedData({
                ...fontFamilyData,
              });
              cachedElementsRef.current.clear();

              // Refocus text editor when font picker closes if we were editing text
              if (isCompact && appState.editingTextElement) {
                restoreCaretPosition(null); // Just refocus without saved position
              }
            }
          }}
        />
      </>
    );
  },
});

export const actionChangeTextAlign = register<TextAlign>({
  name: "changeTextAlign",
  label: "Change text alignment",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    return {
      elements: changeProperty(
        elements,
        appState,
        (oldElement) => {
          if (isTextElement(oldElement)) {
            const newElement: ExcalidrawTextElement = newElementWith(
              oldElement,
              { textAlign: value },
            );
            redrawTextBoundingBox(
              newElement,
              app.scene.getContainerElement(oldElement),
              app.scene,
            );
            return newElement;
          }

          return oldElement;
        },
        true,
      ),
      appState: {
        ...appState,
        currentItemTextAlign: value,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app, data }) => {
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const { isCompact } = getStylesPanelInfo(app);

    return (
      <fieldset>
        <legend>{t("labels.textAlign")}</legend>
        <div className="buttonList">
          <RadioSelection<TextAlign | false>
            group="text-align"
            options={[
              {
                value: "left",
                text: t("labels.left"),
                icon: TextAlignLeftIcon,
                testId: "align-left",
              },
              {
                value: "center",
                text: t("labels.center"),
                icon: TextAlignCenterIcon,
                testId: "align-horizontal-center",
              },
              {
                value: "right",
                text: t("labels.right"),
                icon: TextAlignRightIcon,
                testId: "align-right",
              },
            ]}
            value={getFormValue(
              elements,
              app,
              (element) => {
                if (isTextElement(element)) {
                  return element.textAlign;
                }
                const boundTextElement = getBoundTextElement(
                  element,
                  elementsMap,
                );
                if (boundTextElement) {
                  return boundTextElement.textAlign;
                }
                return null;
              },
              (element) =>
                isTextElement(element) ||
                getBoundTextElement(element, elementsMap) !== null,
              (hasSelection) =>
                hasSelection ? null : appState.currentItemTextAlign,
            )}
            onChange={(value) => {
              withCaretPositionPreservation(
                () => updateData(value),
                isCompact,
                !!appState.editingTextElement,
                data?.onPreventClose,
              );
            }}
          />
        </div>
      </fieldset>
    );
  },
});

export const actionChangeVerticalAlign = register<VerticalAlign>({
  name: "changeVerticalAlign",
  label: "Change vertical alignment",
  trackEvent: { category: "element" },
  perform: (elements, appState, value, app) => {
    return {
      elements: changeProperty(
        elements,
        appState,
        (oldElement) => {
          if (isTextElement(oldElement)) {
            const newElement: ExcalidrawTextElement = newElementWith(
              oldElement,
              { verticalAlign: value },
            );

            redrawTextBoundingBox(
              newElement,
              app.scene.getContainerElement(oldElement),
              app.scene,
            );
            return newElement;
          }

          return oldElement;
        },
        true,
      ),
      appState: {
        ...appState,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app, data }) => {
    const { isCompact } = getStylesPanelInfo(app);
    return (
      <fieldset>
        <div className="buttonList">
          <RadioSelection<VerticalAlign | false>
            group="text-align"
            options={[
              {
                value: VERTICAL_ALIGN.TOP,
                text: t("labels.alignTop"),
                icon: <TextAlignTopIcon theme={appState.theme} />,
                testId: "align-top",
              },
              {
                value: VERTICAL_ALIGN.MIDDLE,
                text: t("labels.centerVertically"),
                icon: <TextAlignMiddleIcon theme={appState.theme} />,
                testId: "align-middle",
              },
              {
                value: VERTICAL_ALIGN.BOTTOM,
                text: t("labels.alignBottom"),
                icon: <TextAlignBottomIcon theme={appState.theme} />,
                testId: "align-bottom",
              },
            ]}
            value={getFormValue(
              elements,
              app,
              (element) => {
                if (isTextElement(element) && element.containerId) {
                  return element.verticalAlign;
                }
                const boundTextElement = getBoundTextElement(
                  element,
                  app.scene.getNonDeletedElementsMap(),
                );
                if (boundTextElement) {
                  return boundTextElement.verticalAlign;
                }
                return null;
              },
              (element) =>
                isTextElement(element) ||
                getBoundTextElement(
                  element,
                  app.scene.getNonDeletedElementsMap(),
                ) !== null,
              (hasSelection) => (hasSelection ? null : VERTICAL_ALIGN.MIDDLE),
            )}
            onChange={(value) => {
              withCaretPositionPreservation(
                () => updateData(value),
                isCompact,
                !!appState.editingTextElement,
                data?.onPreventClose,
              );
            }}
          />
        </div>
      </fieldset>
    );
  },
});

export const actionChangeRoundness = register<"sharp" | "round">({
  name: "changeRoundness",
  label: "Change edge roundness",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      elements: changeProperty(elements, appState, (el) => {
        if (isElbowArrow(el)) {
          return el;
        }

        return newElementWith(el, {
          roundness:
            value === "round"
              ? {
                  type: isUsingAdaptiveRadius(el.type)
                    ? ROUNDNESS.ADAPTIVE_RADIUS
                    : ROUNDNESS.PROPORTIONAL_RADIUS,
                }
              : null,
        });
      }),
      appState: {
        ...appState,
        currentItemRoundness: value,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app, renderAction }) => {
    const targetElements = getTargetElements(
      getNonDeletedElements(elements),
      appState,
    );

    const hasLegacyRoundness = targetElements.some(
      (el) => el.roundness?.type === ROUNDNESS.LEGACY,
    );

    return (
      <fieldset>
        <legend>{t("labels.edges")}</legend>
        <div className="buttonList">
          <RadioSelection
            group="edges"
            options={[
              {
                value: "sharp",
                text: t("labels.sharp"),
                icon: EdgeSharpIcon,
              },
              {
                value: "round",
                text: t("labels.round"),
                icon: EdgeRoundIcon,
              },
            ]}
            value={getFormValue(
              elements,
              app,
              (element) =>
                hasLegacyRoundness
                  ? null
                  : element.roundness
                  ? "round"
                  : "sharp",
              (element) =>
                !isArrowElement(element) && element.hasOwnProperty("roundness"),
              (hasSelection) =>
                hasSelection ? null : appState.currentItemRoundness,
            )}
            onChange={(value) => updateData(value)}
          />
          {renderAction("togglePolygon")}
        </div>
      </fieldset>
    );
  },
});

const getArrowheadOptions = (flip: boolean) => {
  return {
    visibleSections: [
      {
        name: "default",
        options: [
          {
            value: null,
            text: t("labels.arrowhead_none"),
            keyBinding: "q",
            icon: <ArrowheadNoneIcon flip={flip} />,
          },
          {
            value: "arrow",
            text: t("labels.arrowhead_arrow"),
            keyBinding: "w",
            icon: <ArrowheadArrowIcon flip={flip} />,
          },
          {
            value: "triangle",
            text: t("labels.arrowhead_triangle"),
            icon: <ArrowheadTriangleIcon flip={flip} />,
            keyBinding: "e",
          },
          {
            value: "triangle_outline",
            text: t("labels.arrowhead_triangle_outline"),
            icon: <ArrowheadTriangleOutlineIcon flip={flip} />,
            keyBinding: "r",
          },
        ],
      },
    ],
    hiddenSections: [
      {
        name: "default",
        options: [
          {
            value: "circle",
            text: t("labels.arrowhead_circle"),
            keyBinding: "a",
            icon: <ArrowheadCircleIcon flip={flip} />,
          },
          {
            value: "circle_outline",
            text: t("labels.arrowhead_circle_outline"),
            keyBinding: "s",
            icon: <ArrowheadCircleOutlineIcon flip={flip} />,
          },
          {
            value: "diamond",
            text: t("labels.arrowhead_diamond"),
            icon: <ArrowheadDiamondIcon flip={flip} />,
            keyBinding: "d",
          },
          {
            value: "diamond_outline",
            text: t("labels.arrowhead_diamond_outline"),
            icon: <ArrowheadDiamondOutlineIcon flip={flip} />,
            keyBinding: "f",
          },
          {
            value: "bar",
            text: t("labels.arrowhead_bar"),
            keyBinding: "z",
            icon: <ArrowheadBarIcon flip={flip} />,
          },
        ],
      },
      {
        name: t("labels.cardinality"),
        options: [
          {
            value: "cardinality_one",
            text: t("labels.arrowhead_cardinality_one"),
            icon: <ArrowheadCardinalityOneIcon flip={flip} />,
            keyBinding: "x",
          },
          {
            value: "cardinality_many",
            text: t("labels.arrowhead_cardinality_many"),
            icon: <ArrowheadCardinalityManyIcon flip={flip} />,
            keyBinding: "c",
          },
          {
            value: "cardinality_one_or_many",
            text: t("labels.arrowhead_cardinality_one_or_many"),
            icon: <ArrowheadCardinalityOneOrManyIcon flip={flip} />,
            keyBinding: "v",
          },
          {
            value: "cardinality_exactly_one",
            text: t("labels.arrowhead_cardinality_exactly_one"),
            icon: <ArrowheadCardinalityExactlyOneIcon flip={flip} />,
            keyBinding: null,
          },
          {
            value: "cardinality_zero_or_one",
            text: t("labels.arrowhead_cardinality_zero_or_one"),
            icon: <ArrowheadCardinalityZeroOrOneIcon flip={flip} />,
            keyBinding: null,
          },
          {
            value: "cardinality_zero_or_many",
            text: t("labels.arrowhead_cardinality_zero_or_many"),
            icon: <ArrowheadCardinalityZeroOrManyIcon flip={flip} />,
            keyBinding: null,
          },
        ],
      },
    ],
  } as const;
};

export const actionChangeArrowhead = register<{
  position: "start" | "end";
  type: Arrowhead;
}>({
  name: "changeArrowhead",
  label: "Change arrowheads",
  trackEvent: false,
  perform: (elements, appState, value) => {
    invariant(value, "actionChangeArrowhead: value must be defined");

    return {
      elements: changeProperty(elements, appState, (el) => {
        if (isLinearElement(el)) {
          const { position, type } = value;

          if (position === "start") {
            const element: ExcalidrawLinearElement = newElementWith(el, {
              startArrowhead: type,
            });
            return element;
          } else if (position === "end") {
            const element: ExcalidrawLinearElement = newElementWith(el, {
              endArrowhead: type,
            });
            return element;
          }
        }

        return el;
      }),
      appState: {
        ...appState,
        [value.position === "start"
          ? "currentItemStartArrowhead"
          : "currentItemEndArrowhead"]: value.type,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const isRTL = getLanguage().rtl;
    const startArrowheadOptions = useMemo(
      () => getArrowheadOptions(!isRTL),
      [isRTL],
    );
    const endArrowheadOptions = useMemo(
      () => getArrowheadOptions(!!isRTL),
      [isRTL],
    );

    return (
      <fieldset>
        <legend>{t("labels.arrowheads")}</legend>
        <div className="iconSelectList buttonList">
          <IconPicker
            visibleSections={startArrowheadOptions.visibleSections}
            hiddenSections={startArrowheadOptions.hiddenSections}
            label="arrowhead_start"
            value={getFormValue<Arrowhead | null>(
              elements,
              app,
              (element) =>
                isLinearElement(element) && canHaveArrowheads(element.type)
                  ? getArrowheadForPicker(element.startArrowhead)
                  : appState.currentItemStartArrowhead,
              true,
              (hasSelection) =>
                hasSelection ? null : appState.currentItemStartArrowhead,
            )}
            onChange={(value) => updateData({ position: "start", type: value })}
          />
          <IconPicker
            visibleSections={endArrowheadOptions.visibleSections}
            hiddenSections={endArrowheadOptions.hiddenSections}
            label="arrowhead_end"
            value={getFormValue<Arrowhead | null>(
              elements,
              app,
              (element) =>
                isLinearElement(element) && canHaveArrowheads(element.type)
                  ? getArrowheadForPicker(element.endArrowhead)
                  : appState.currentItemEndArrowhead,
              true,
              (hasSelection) =>
                hasSelection ? null : appState.currentItemEndArrowhead,
            )}
            onChange={(value) => updateData({ position: "end", type: value })}
          />
        </div>
      </fieldset>
    );
  },
});

export const actionChangeArrowProperties = register({
  name: "changeArrowProperties",
  label: "Change arrow properties",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    // This action doesn't perform any changes directly
    // It's just a container for the arrow type and arrowhead actions
    return false;
  },
  PanelComponent: ({ elements, appState, updateData, app, renderAction }) => {
    return (
      <div className="selected-shape-actions">
        {renderAction("changeArrowhead")}
        {renderAction("changeArrowType")}
      </div>
    );
  },
});

export const actionChangeArrowType = register<keyof typeof ARROW_TYPE>({
  name: "changeArrowType",
  label: "Change arrow types",
  trackEvent: false,
  perform: (elements, appState, value, app) => {
    const newElements = changeProperty(elements, appState, (el) => {
      if (!isArrowElement(el)) {
        return el;
      }
      const elementsMap = app.scene.getNonDeletedElementsMap();
      const startPoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
        el,
        0,
        elementsMap,
      );
      const endPoint = LinearElementEditor.getPointAtIndexGlobalCoordinates(
        el,
        -1,
        elementsMap,
      );
      let newElement = newElementWith(el, {
        x: value === ARROW_TYPE.elbow ? startPoint[0] : el.x,
        y: value === ARROW_TYPE.elbow ? startPoint[1] : el.y,
        roundness:
          value === ARROW_TYPE.round
            ? {
                type: ROUNDNESS.PROPORTIONAL_RADIUS,
              }
            : null,
        elbowed: value === ARROW_TYPE.elbow,
        angle: value === ARROW_TYPE.elbow ? (0 as Radians) : el.angle,
        points:
          value === ARROW_TYPE.elbow || el.elbowed
            ? [
                LinearElementEditor.pointFromAbsoluteCoords(
                  {
                    ...el,
                    x: startPoint[0],
                    y: startPoint[1],
                    angle: 0 as Radians,
                  },
                  startPoint,
                  elementsMap,
                ),
                LinearElementEditor.pointFromAbsoluteCoords(
                  {
                    ...el,
                    x: startPoint[0],
                    y: startPoint[1],
                    angle: 0 as Radians,
                  },
                  endPoint,
                  elementsMap,
                ),
              ]
            : el.points,
      });

      if (isElbowArrow(newElement)) {
        newElement.fixedSegments = null;

        const elementsMap = app.scene.getNonDeletedElementsMap();

        app.dismissLinearEditor();

        const startGlobalPoint =
          LinearElementEditor.getPointAtIndexGlobalCoordinates(
            newElement,
            0,
            elementsMap,
          );
        const endGlobalPoint =
          LinearElementEditor.getPointAtIndexGlobalCoordinates(
            newElement,
            -1,
            elementsMap,
          );
        const startElement =
          newElement.startBinding &&
          (elementsMap.get(
            newElement.startBinding.elementId,
          ) as ExcalidrawBindableElement);
        const endElement =
          newElement.endBinding &&
          (elementsMap.get(
            newElement.endBinding.elementId,
          ) as ExcalidrawBindableElement);

        const startBinding =
          startElement && newElement.startBinding
            ? {
                // @ts-ignore TS cannot discern check above
                ...newElement.startBinding!,
                ...calculateFixedPointForElbowArrowBinding(
                  newElement,
                  startElement,
                  "start",
                  elementsMap,
                  appState.isBindingEnabled,
                ),
              }
            : null;
        const endBinding =
          endElement && newElement.endBinding
            ? {
                // @ts-ignore TS cannot discern check above
                ...newElement.endBinding,
                ...calculateFixedPointForElbowArrowBinding(
                  newElement,
                  endElement,
                  "end",
                  elementsMap,
                  appState.isBindingEnabled,
                ),
              }
            : null;

        newElement = {
          ...newElement,
          startBinding,
          endBinding,
          ...updateElbowArrowPoints(newElement, elementsMap, {
            points: [startGlobalPoint, endGlobalPoint].map(
              (p): LocalPoint =>
                pointFrom(p[0] - newElement.x, p[1] - newElement.y),
            ),
            startBinding,
            endBinding,
            fixedSegments: null,
          }),
        };
      } else {
        const elementsMap = app.scene.getNonDeletedElementsMap();
        if (newElement.startBinding) {
          const startElement = elementsMap.get(
            newElement.startBinding.elementId,
          ) as ExcalidrawBindableElement;
          if (startElement) {
            bindBindingElement(
              newElement,
              startElement,
              appState.bindMode === "inside" ? "inside" : "orbit",
              "start",
              app.scene,
            );
          }
        }
        if (newElement.endBinding) {
          const endElement = elementsMap.get(
            newElement.endBinding.elementId,
          ) as ExcalidrawBindableElement;
          if (endElement) {
            bindBindingElement(
              newElement,
              endElement,
              appState.bindMode === "inside" ? "inside" : "orbit",
              "end",
              app.scene,
            );
          }
        }
      }

      return newElement;
    });

    const newState = {
      ...appState,
      currentItemArrowType: value,
    };

    // Change the arrow type and update any other state settings for
    // the arrow.
    const selectedId = appState.selectedLinearElement?.elementId;
    if (selectedId) {
      const selected = newElements.find((el) => el.id === selectedId);
      if (selected) {
        newState.selectedLinearElement = new LinearElementEditor(
          selected as ExcalidrawLinearElement,
          arrayToMap(elements),
        );
      }
    }

    return {
      elements: newElements,
      appState: newState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData, app }) => {
    return (
      <fieldset>
        <legend>{t("labels.arrowtypes")}</legend>
        <div className="buttonList">
          <RadioSelection
            group="arrowtypes"
            options={[
              {
                value: ARROW_TYPE.sharp,
                text: t("labels.arrowtype_sharp"),
                icon: sharpArrowIcon,
                testId: "sharp-arrow",
              },
              {
                value: ARROW_TYPE.round,
                text: t("labels.arrowtype_round"),
                icon: roundArrowIcon,
                testId: "round-arrow",
              },
              {
                value: ARROW_TYPE.elbow,
                text: t("labels.arrowtype_elbowed"),
                icon: elbowArrowIcon,
                testId: "elbow-arrow",
              },
            ]}
            value={getFormValue(
              elements,
              app,
              (element) => {
                if (isArrowElement(element)) {
                  return element.elbowed
                    ? ARROW_TYPE.elbow
                    : element.roundness
                    ? ARROW_TYPE.round
                    : ARROW_TYPE.sharp;
                }

                return null;
              },
              (element) => isArrowElement(element),
              (hasSelection) =>
                hasSelection ? null : appState.currentItemArrowType,
            )}
            onChange={(value) => updateData(value)}
          />
        </div>
      </fieldset>
    );
  },
});

// zsviczian
export const actionToggleFrameRole = register({
  name: "toggleFrameRole",
  label: "labels.toggleFrameRole",
  icon: markerFrameIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState, value, app) => {
    const selected = getSelectedElements(elements, appState);
    const frames = selected.filter(
      (el) => el.type === "frame",
    ) as ExcalidrawFrameElement[];
    const onlyFramesSelected = selected.length > 0 && selected.length === frames.length;

    if (onlyFramesSelected) {
      const selectedIds = new Set(selected.map((el) => el.id));
      const hasNonMarker = frames.some((el) => el.frameRole !== "marker");

      const explicit = (value as { frameRole?: "marker" | null })?.frameRole;
      const targetRole =
        explicit !== undefined ? explicit : hasNonMarker ? null : "marker";

      const next = elements.map((el) => {
        if (selectedIds.has(el.id) && el.type === "frame") {
          return newElementWith(el, { frameRole: targetRole });
        }
        return el;
      });

      return {
        elements: next,
        appState,
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    }

    // no (or non-frame) selection → toggle current item default
    const nextRole =
      appState.currentItemFrameRole === "marker" ? null : "marker";
    return {
      elements,
      appState: { ...appState, currentItemFrameRole: nextRole },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (_elements, appState, _props, app) => {
    if(appState.activeTool.type === "frame") {
      return true;
    }
    const selected = app.scene.getSelectedElements(appState);
    return selected.length > 0
      ? selected.every((el) => el.type === "frame")
      : false;
  },
  checked: (appState) => appState.currentItemFrameRole === "marker",
  PanelComponent: ({ elements, appState, updateData, app }) => {
    const selected = getSelectedElements(elements, appState);
    const frames = selected.filter(
      (el) => el.type === "frame",
    ) as ExcalidrawFrameElement[];
    const onlyFramesSelected = selected.length > 0 && selected.length === frames.length;

    const isMarker = onlyFramesSelected
      ? frames.every((el) => el.frameRole === "marker")
      : appState.currentItemFrameRole === "marker";

    const label = t2("COMP_FRAME_HINT");
    return (
      <RadioSelection<"marker" | false>
        type="button"
        options={[
          {
            value: "marker",
            text: label,
            icon: markerFrameIcon,
            active: isMarker ? true : undefined,
            testId: "frame-role-marker",
          },
        ]}
        value={isMarker ? "marker" : false}
        onClick={() =>
          updateData({
            frameRole: isMarker ? null : "marker",
          })
        }
      />
    );
  },
});

export const actionChangeTextOutlineColor = register< //zsviczian
  Pick<AppState, "currentItemTextOutlineColor"> //zsviczian
>({ //zsviczian
  name: "changeTextOutlineColor", //zsviczian
  label: "labels.textOutlineColor", //zsviczian
  trackEvent: false, //zsviczian
  perform: (elements, appState, value) => { //zsviczian
    return { //zsviczian
      ...(value?.currentItemTextOutlineColor && { //zsviczian
        elements: changeProperty( //zsviczian
          elements, //zsviczian
          appState, //zsviczian
          (el) => { //zsviczian
            if (!isTextElement(el)) { return el; } //zsviczian
            return newElementWith(el, { textOutlineColor: value.currentItemTextOutlineColor }); //zsviczian
          }, //zsviczian
          true, //zsviczian
        ), //zsviczian
      }), //zsviczian
      appState: { ...appState, ...value }, //zsviczian
      captureUpdate: value?.currentItemTextOutlineColor //zsviczian
        ? CaptureUpdateAction.IMMEDIATELY //zsviczian
        : CaptureUpdateAction.EVENTUALLY, //zsviczian
    }; //zsviczian
  }, //zsviczian
  PanelComponent: ({ elements, appState, updateData, app }) => ( //zsviczian
    <>
      {isFullPanelMode(app) && ( //zsviczian
        <h3 aria-hidden="true">{t("labels.textOutlineColor")}</h3>
      )}
      <ColorPicker //zsviczian
        topPicks={ //zsviczian
          appState.colorPalette?.topPicks?.elementStroke ?? //zsviczian
          DEFAULT_ELEMENT_STROKE_PICKS //zsviczian
        } //zsviczian
        palette={ //zsviczian
          appState.colorPalette?.elementStroke ?? //zsviczian
          DEFAULT_ELEMENT_STROKE_COLOR_PALETTE //zsviczian
        } //zsviczian
        type="elementStroke" //zsviczian
        label={t("labels.textOutlineColor")} //zsviczian
        color={getFormValue( //zsviczian
          elements, //zsviczian
          app, //zsviczian
          (element) => isTextElement(element) ? element.textOutlineColor : null, //zsviczian
          true, //zsviczian
          (hasSelection) => //zsviczian
            !hasSelection ? appState.currentItemTextOutlineColor : null, //zsviczian
        )} //zsviczian
        onChange={(color) => updateData({ currentItemTextOutlineColor: color })} //zsviczian
        elements={elements} //zsviczian
        appState={appState} //zsviczian
        updateData={updateData} //zsviczian
      />
    </>
  ), //zsviczian
}); //zsviczian

export const actionChangeTextOutlineWidth = register<number>({ //zsviczian
  name: "changeTextOutlineWidth", //zsviczian
  label: "labels.textOutlineWidth", //zsviczian
  trackEvent: false, //zsviczian
  perform: (elements, appState, value) => { //zsviczian
    return { //zsviczian
      elements: changeProperty( //zsviczian
        elements, //zsviczian
        appState, //zsviczian
        (el) => { //zsviczian
          if (!isTextElement(el)) { return el; } //zsviczian
          return newElementWith(el, { textOutlineWidth: value }); //zsviczian
        }, //zsviczian
        true, //zsviczian
      ), //zsviczian
      appState: { ...appState, currentItemTextOutlineWidth: value }, //zsviczian
      captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
    }; //zsviczian
  }, //zsviczian
  PanelComponent: ({ elements, appState, updateData, app }) => { //zsviczian
    const currentValue = getFormValue( //zsviczian
      elements, //zsviczian
      app, //zsviczian
      (element) => isTextElement(element) ? element.textOutlineWidth : null, //zsviczian
      true, //zsviczian
      (hasSelection) => hasSelection ? null : appState.currentItemTextOutlineWidth, //zsviczian
    ); //zsviczian
    return (
      <fieldset>
        <legend>{t("labels.textOutlineWidth")}</legend>
        <div className="buttonList">
          <RadioSelection //zsviczian
            group="text-outline-width" //zsviczian
            options={[ //zsviczian
              { value: 0, text: t("labels.none"), icon: StrokeWidthThinIcon, subtitle: "0" }, //zsviczian
              { value: 1, text: t("labels.thin"), icon: StrokeWidthBaseIcon, subtitle: "1" }, //zsviczian
              { value: 2, text: t("labels.bold"), icon: StrokeWidthBoldIcon, subtitle: "2" }, //zsviczian
              { value: 4, text: t("labels.extraBold"), icon: StrokeWidthExtraBoldIcon, subtitle: "4" }, //zsviczian
            ]} //zsviczian
            value={currentValue} //zsviczian
            onChange={updateData} //zsviczian
          />
        </div>
      </fieldset>
    ); //zsviczian
  }, //zsviczian
}); //zsviczian

export const actionChangeTextOutlineOpacity = register<number>({ //zsviczian
  name: "changeTextOutlineOpacity", //zsviczian
  label: "labels.textOutlineOpacity", //zsviczian
  trackEvent: false, //zsviczian
  perform: (elements, appState, value) => { //zsviczian
    return { //zsviczian
      elements: changeProperty( //zsviczian
        elements, //zsviczian
        appState, //zsviczian
        (el) => { //zsviczian
          if (!isTextElement(el)) { return el; } //zsviczian
          return newElementWith(el, { textOutlineOpacity: value }); //zsviczian
        }, //zsviczian
        true, //zsviczian
      ), //zsviczian
      appState: { ...appState, currentItemTextOutlineOpacity: value }, //zsviczian
      captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
    }; //zsviczian
  }, //zsviczian
  PanelComponent: ({ elements, appState, updateData, app }) => { //zsviczian
    const opacity = getFormValue( //zsviczian
      elements, //zsviczian
      app, //zsviczian
      (element) => isTextElement(element) ? element.textOutlineOpacity : null, //zsviczian
      true, //zsviczian
      (hasSelection) => hasSelection ? null : appState.currentItemTextOutlineOpacity, //zsviczian
    ); //zsviczian
    return ( //zsviczian
      <Range //zsviczian
        label={t("labels.textOutlineOpacity")} //zsviczian
        value={opacity ?? appState.currentItemTextOutlineOpacity} //zsviczian
        hasCommonValue={opacity !== null} //zsviczian
        onChange={updateData} //zsviczian
        min={0} //zsviczian
        max={100} //zsviczian
        step={10} //zsviczian
        testId="text-outline-opacity" //zsviczian
      /> //zsviczian
    ); //zsviczian
  }, //zsviczian
}); //zsviczian

export const actionChangeTextPerspectiveX = register<number>({ //zsviczian
  name: "changeTextPerspectiveX", //zsviczian
  label: "labels.textPerspectiveX", //zsviczian
  trackEvent: false, //zsviczian
  perform: (elements, appState, value) => { //zsviczian
    if (value == null) { return false; } //zsviczian
    return { //zsviczian
      elements: changeProperty( //zsviczian
        elements, //zsviczian
        appState, //zsviczian
        (el) => { //zsviczian
          if (!isTextElement(el)) { return el; } //zsviczian
          return newElementWith(el, { perspectiveX: value / 100 }); //zsviczian
        }, //zsviczian
        true, //zsviczian
      ), //zsviczian
      appState: { ...appState, currentItemTextPerspectiveX: value }, //zsviczian
      captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
    }; //zsviczian
  }, //zsviczian
  PanelComponent: ({ elements, appState, updateData, app }) => { //zsviczian
    const currentValue = getFormValue( //zsviczian
      elements, //zsviczian
      app, //zsviczian
      (element) => isTextElement(element) ? Math.round((element.perspectiveX ?? 0) * 100) : null, //zsviczian
      true, //zsviczian
      (hasSelection) => hasSelection ? null : appState.currentItemTextPerspectiveX, //zsviczian
    ); //zsviczian
    return ( //zsviczian
      <Range //zsviczian
        label={t("labels.textPerspectiveX")} //zsviczian
        value={currentValue ?? appState.currentItemTextPerspectiveX} //zsviczian
        hasCommonValue={currentValue !== null} //zsviczian
        onChange={updateData} //zsviczian
        min={-100} //zsviczian
        max={100} //zsviczian
        step={5} //zsviczian
        testId="text-perspective-x" //zsviczian
      /> //zsviczian
    ); //zsviczian
  }, //zsviczian
}); //zsviczian

export const actionChangeTextPerspectiveY = register<number>({ //zsviczian
  name: "changeTextPerspectiveY", //zsviczian
  label: "labels.textPerspectiveY", //zsviczian
  trackEvent: false, //zsviczian
  perform: (elements, appState, value) => { //zsviczian
    if (value == null) { return false; } //zsviczian
    return { //zsviczian
      elements: changeProperty( //zsviczian
        elements, //zsviczian
        appState, //zsviczian
        (el) => { //zsviczian
          if (!isTextElement(el)) { return el; } //zsviczian
          return newElementWith(el, { perspectiveY: value / 100 }); //zsviczian
        }, //zsviczian
        true, //zsviczian
      ), //zsviczian
      appState: { ...appState, currentItemTextPerspectiveY: value }, //zsviczian
      captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
    }; //zsviczian
  }, //zsviczian
  PanelComponent: ({ elements, appState, updateData, app }) => { //zsviczian
    const currentValue = getFormValue( //zsviczian
      elements, //zsviczian
      app, //zsviczian
      (element) => isTextElement(element) ? Math.round((element.perspectiveY ?? 0) * 100) : null, //zsviczian
      true, //zsviczian
      (hasSelection) => hasSelection ? null : appState.currentItemTextPerspectiveY, //zsviczian
    ); //zsviczian
    return ( //zsviczian
      <Range //zsviczian
        label={t("labels.textPerspectiveY")} //zsviczian
        value={currentValue ?? appState.currentItemTextPerspectiveY} //zsviczian
        hasCommonValue={currentValue !== null} //zsviczian
        onChange={updateData} //zsviczian
        min={-100} //zsviczian
        max={100} //zsviczian
        step={5} //zsviczian
        testId="text-perspective-y" //zsviczian
      /> //zsviczian
    ); //zsviczian
  }, //zsviczian
}); //zsviczian

export const actionInsertRectanglePreset = register<{ widthRatio: number; heightRatio: number }>({ //zsviczian
  name: "insertRectanglePreset", //zsviczian
  label: "labels.rectPreset", //zsviczian
  trackEvent: false, //zsviczian
  perform: (elements, appState, value) => { //zsviczian
    if (!value) { return false; } //zsviczian
    const { widthRatio, heightRatio } = value; //zsviczian
    const targetEls = getTargetElements(getNonDeletedElements(elements), appState) //zsviczian
      .filter((el) => el.type === "rectangle"); //zsviczian
    if (targetEls.length > 0) { //zsviczian
      return { //zsviczian
        elements: changeProperty(elements, appState, (el) => { //zsviczian
          if (el.type !== "rectangle") { return el; } //zsviczian
          const newH = el.width * (heightRatio / widthRatio); //zsviczian
          const newY = el.y + el.height / 2 - newH / 2; //zsviczian
          return newElementWith(el, { height: newH, y: newY }); //zsviczian
        }), //zsviczian
        appState, //zsviczian
        captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
      }; //zsviczian
    } //zsviczian
    const BASE = 160 / appState.zoom.value; //zsviczian
    const w = BASE; //zsviczian
    const h = BASE * (heightRatio / widthRatio); //zsviczian
    const cx = appState.width / 2 / appState.zoom.value - appState.scrollX; //zsviczian
    const cy = appState.height / 2 / appState.zoom.value - appState.scrollY; //zsviczian
    const roundness = appState.currentItemRoundness === "round" //zsviczian
      ? { type: ROUNDNESS.ADAPTIVE_RADIUS } //zsviczian
      : null; //zsviczian
    const element = newRectangleElement({ //zsviczian
      type: "rectangle", //zsviczian
      x: cx - w / 2, //zsviczian
      y: cy - h / 2, //zsviczian
      width: w, //zsviczian
      height: h, //zsviczian
      strokeColor: appState.currentItemStrokeColor, //zsviczian
      backgroundColor: appState.currentItemBackgroundColor, //zsviczian
      fillStyle: appState.currentItemFillStyle, //zsviczian
      strokeWidth: appState.currentItemStrokeWidth, //zsviczian
      strokeStyle: appState.currentItemStrokeStyle, //zsviczian
      roughness: appState.currentItemRoughness, //zsviczian
      roundness, //zsviczian
      opacity: appState.currentItemOpacity, //zsviczian
      rectGapSide: appState.currentItemRectGapSide, //zsviczian
      rectGapSize: appState.currentItemRectGapSize, //zsviczian
      rectGapDepth: appState.currentItemRectGapDepth, //zsviczian
      locked: false, //zsviczian
    }); //zsviczian
    const nextElements = syncMovedIndices([...elements, element], arrayToMap([element])); //zsviczian
    return { //zsviczian
      elements: nextElements, //zsviczian
      appState: { //zsviczian
        ...appState, //zsviczian
        selectedElementIds: { [element.id]: true }, //zsviczian
        activeTool: updateActiveTool(appState, { type: "selection" }), //zsviczian
      }, //zsviczian
      captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
    }; //zsviczian
  }, //zsviczian
  PanelComponent: ({ updateData }) => ( //zsviczian
    <fieldset> {/* //zsviczian */}
      <legend>{t("labels.rectPreset")}</legend> {/* //zsviczian */}
      <div className="buttonList"> {/* //zsviczian */}
        <ButtonIcon //zsviczian
          icon={<RectPresetSquareIcon />} //zsviczian
          title={t("labels.rectPresetSquare")} //zsviczian
          subtitle="1:1" //zsviczian
          onClick={() => updateData({ widthRatio: 1, heightRatio: 1 })} //zsviczian
        /> {/* //zsviczian */}
        <ButtonIcon //zsviczian
          icon={<RectPreset4x5Icon />} //zsviczian
          title={t("labels.rectPreset4x5")} //zsviczian
          subtitle="4:5" //zsviczian
          onClick={() => updateData({ widthRatio: 4, heightRatio: 5 })} //zsviczian
        /> {/* //zsviczian */}
        <ButtonIcon //zsviczian
          icon={<RectPreset16x9Icon />} //zsviczian
          title={t("labels.rectPreset16x9")} //zsviczian
          subtitle="16:9" //zsviczian
          onClick={() => updateData({ widthRatio: 16, heightRatio: 9 })} //zsviczian
        /> {/* //zsviczian */}
      </div> {/* //zsviczian */}
    </fieldset> //zsviczian
  ), //zsviczian
}); //zsviczian

export const actionInsertEllipsePreset = register<{ widthRatio: number; heightRatio: number }>({ //zsviczian
  name: "insertEllipsePreset", //zsviczian
  label: "labels.ellipsePreset", //zsviczian
  trackEvent: false, //zsviczian
  perform: (elements, appState, value) => { //zsviczian
    if (!value) { return false; } //zsviczian
    const { widthRatio, heightRatio } = value; //zsviczian
    const targetEls = getTargetElements(getNonDeletedElements(elements), appState) //zsviczian
      .filter((el) => el.type === "ellipse"); //zsviczian
    if (targetEls.length > 0) { //zsviczian
      return { //zsviczian
        elements: changeProperty(elements, appState, (el) => { //zsviczian
          if (el.type !== "ellipse") { return el; } //zsviczian
          const newH = el.width * (heightRatio / widthRatio); //zsviczian
          const newY = el.y + el.height / 2 - newH / 2; //zsviczian
          return newElementWith(el, { height: newH, y: newY }); //zsviczian
        }), //zsviczian
        appState, //zsviczian
        captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
      }; //zsviczian
    } //zsviczian
    const BASE = 160 / appState.zoom.value; //zsviczian
    const w = BASE; //zsviczian
    const h = BASE * (heightRatio / widthRatio); //zsviczian
    const cx = appState.width / 2 / appState.zoom.value - appState.scrollX; //zsviczian
    const cy = appState.height / 2 / appState.zoom.value - appState.scrollY; //zsviczian
    const element = newEllipseElement({ //zsviczian
      type: "ellipse", //zsviczian
      x: cx - w / 2, //zsviczian
      y: cy - h / 2, //zsviczian
      width: w, //zsviczian
      height: h, //zsviczian
      strokeColor: appState.currentItemStrokeColor, //zsviczian
      backgroundColor: appState.currentItemBackgroundColor, //zsviczian
      fillStyle: appState.currentItemFillStyle, //zsviczian
      strokeWidth: appState.currentItemStrokeWidth, //zsviczian
      strokeStyle: appState.currentItemStrokeStyle, //zsviczian
      roughness: appState.currentItemRoughness, //zsviczian
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS }, //zsviczian
      opacity: appState.currentItemOpacity, //zsviczian
      arcGapAngle: appState.currentItemArcGapAngle, //zsviczian
      arcGapClosed: appState.currentItemArcGapClosed, //zsviczian
      locked: false, //zsviczian
    }); //zsviczian
    const nextElements = syncMovedIndices([...elements, element], arrayToMap([element])); //zsviczian
    return { //zsviczian
      elements: nextElements, //zsviczian
      appState: { //zsviczian
        ...appState, //zsviczian
        selectedElementIds: { [element.id]: true }, //zsviczian
        activeTool: updateActiveTool(appState, { type: "selection" }), //zsviczian
      }, //zsviczian
      captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
    }; //zsviczian
  }, //zsviczian
  PanelComponent: ({ updateData }) => ( //zsviczian
    <fieldset> {/* //zsviczian */}
      <legend>{t("labels.ellipsePreset")}</legend> {/* //zsviczian */}
      <div className="buttonList"> {/* //zsviczian */}
        <ButtonIcon //zsviczian
          icon={<EllipsePresetCircleIcon />} //zsviczian
          title={t("labels.ellipsePresetCircle")} //zsviczian
          subtitle="1:1" //zsviczian
          onClick={() => updateData({ widthRatio: 1, heightRatio: 1 })} //zsviczian
        /> {/* //zsviczian */}
      </div> {/* //zsviczian */}
    </fieldset> //zsviczian
  ), //zsviczian
}); //zsviczian

export const actionInsertTrianglePreset = register<{ widthRatio: number; heightRatio: number }>({ //zsviczian
  name: "insertTrianglePreset", //zsviczian
  label: "labels.trianglePreset", //zsviczian
  trackEvent: false, //zsviczian
  perform: (elements, appState, value) => { //zsviczian
    if (!value) { return false; } //zsviczian
    const { widthRatio, heightRatio } = value; //zsviczian
    const targetEls = getTargetElements(getNonDeletedElements(elements), appState) //zsviczian
      .filter((el) => el.type === "triangle"); //zsviczian
    if (targetEls.length > 0) { //zsviczian
      return { //zsviczian
        elements: changeProperty(elements, appState, (el) => { //zsviczian
          if (el.type !== "triangle") { return el; } //zsviczian
          const newH = el.width * (heightRatio / widthRatio); //zsviczian
          const newY = el.y + el.height / 2 - newH / 2; //zsviczian
          return newElementWith(el, { height: newH, y: newY }); //zsviczian
        }), //zsviczian
        appState, //zsviczian
        captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
      }; //zsviczian
    } //zsviczian
    const BASE = 160 / appState.zoom.value; //zsviczian
    const w = BASE; //zsviczian
    const h = BASE * (heightRatio / widthRatio); //zsviczian
    const cx = appState.width / 2 / appState.zoom.value - appState.scrollX; //zsviczian
    const cy = appState.height / 2 / appState.zoom.value - appState.scrollY; //zsviczian
    const roundness = appState.currentItemRoundness === "round" //zsviczian
      ? { type: ROUNDNESS.ADAPTIVE_RADIUS } //zsviczian
      : null; //zsviczian
    const element = newTriangleElement({ //zsviczian
      type: "triangle", //zsviczian
      x: cx - w / 2, //zsviczian
      y: cy - h / 2, //zsviczian
      width: w, //zsviczian
      height: h, //zsviczian
      strokeColor: appState.currentItemStrokeColor, //zsviczian
      backgroundColor: appState.currentItemBackgroundColor, //zsviczian
      fillStyle: appState.currentItemFillStyle, //zsviczian
      strokeWidth: appState.currentItemStrokeWidth, //zsviczian
      strokeStyle: appState.currentItemStrokeStyle, //zsviczian
      roughness: appState.currentItemRoughness, //zsviczian
      roundness, //zsviczian
      opacity: appState.currentItemOpacity, //zsviczian
      triGapVertex: appState.currentItemTriGapVertex, //zsviczian
      triGapSize: appState.currentItemTriGapSize, //zsviczian
      triGapClosed: appState.currentItemTriGapClosed, //zsviczian
      locked: false, //zsviczian
    }); //zsviczian
    const nextElements = syncMovedIndices([...elements, element], arrayToMap([element])); //zsviczian
    return { //zsviczian
      elements: nextElements, //zsviczian
      appState: { //zsviczian
        ...appState, //zsviczian
        selectedElementIds: { [element.id]: true }, //zsviczian
        activeTool: updateActiveTool(appState, { type: "selection" }), //zsviczian
      }, //zsviczian
      captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
    }; //zsviczian
  }, //zsviczian
  PanelComponent: ({ updateData }) => ( //zsviczian
    <fieldset> {/* //zsviczian */}
      <legend>{t("labels.trianglePreset")}</legend> {/* //zsviczian */}
      <div className="buttonList"> {/* //zsviczian */}
        <ButtonIcon //zsviczian
          icon={<TriPresetEquilateralIcon />} //zsviczian
          title={t("labels.triPresetEquilateral")} //zsviczian
          subtitle={t("labels.triPresetEquilateral")} //zsviczian
          onClick={() => updateData({ widthRatio: 1, heightRatio: 0.866 })} //zsviczian
        /> {/* //zsviczian */}
        <ButtonIcon //zsviczian
          icon={<TriPresetRightAngleIcon />} //zsviczian
          title={t("labels.triPresetRightAngle")} //zsviczian
          subtitle={t("labels.triPresetRightAngle")} //zsviczian
          onClick={() => updateData({ widthRatio: 1, heightRatio: 1 })} //zsviczian
        /> {/* //zsviczian */}
      </div> {/* //zsviczian */}
    </fieldset> //zsviczian
  ), //zsviczian
}); //zsviczian
