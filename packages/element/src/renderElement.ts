import rough from "roughjs/bin/rough";

import {
  type GlobalPoint,
  isRightAngleRads,
  lineSegment,
  pointFrom,
  pointRotateRads,
  type Radians,
} from "@excalidraw/math";

import {
  BOUND_TEXT_PADDING,
  DEFAULT_REDUCED_GLOBAL_ALPHA,
  ELEMENT_READY_TO_ERASE_OPACITY,
  FRAME_STYLE,
  DARK_THEME_FILTER,
  MIME_TYPES,
  THEME,
  distance,
  getFontString,
  isRTL,
  getVerticalOffset,
  invariant,
  getAreaLimit,
  getWidthHeightLimit,
  applyDarkModeFilter,
  isIOS,
  isTransparent, //zsviczian
} from "@excalidraw/common";

import type {
  AppState,
  StaticCanvasAppState,
  Zoom,
  InteractiveCanvasAppState,
  ElementsPendingErasure,
  PendingExcalidrawElements,
  NormalizedZoomValue,
} from "@excalidraw/excalidraw/types";

import type {
  StaticCanvasRenderConfig,
  RenderableElementsMap,
  InteractiveCanvasRenderConfig,
} from "@excalidraw/excalidraw/scene/types";

import { getElementAbsoluteCoords, getElementBounds, getDiamondPoints, getTrianglePoints } from "./bounds"; //zsviczian
import { getUncroppedImageElement } from "./cropElement";
import { LinearElementEditor } from "./linearElementEditor";
import {
  getBoundTextElement,
  getContainerCoords,
  getContainerElement,
  getBoundTextMaxHeight,
  getBoundTextMaxWidth,
} from "./textElement";
import { getLineHeightInPx } from "./textMeasurements";
import {
  isTextElement,
  isLinearElement,
  isFreeDrawElement,
  isInitializedImageElement,
  isArrowElement,
  hasBoundTextElement,
  isMagicFrameElement,
  isImageElement,
} from "./typeChecks";
import { getContainingFrame } from "./frame";
import { getCornerRadius, isPathALoop } from "./utils"; //zsviczian

import { ShapeCache } from "./shape";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawImageElement,
  ExcalidrawTextElementWithContainer,
  ExcalidrawFrameLikeElement,
  NonDeletedSceneElementsMap,
  ElementsMap,
} from "./types";

import type { RoughCanvas } from "roughjs/bin/canvas";
import { isIframeLikeElement } from "@excalidraw/element/typeChecks";
import { getFreeDrawSvgPath } from "./freedrawPath";

const isPendingImageElement = (
  element: ExcalidrawElement,
  renderConfig: StaticCanvasRenderConfig,
) =>
  isInitializedImageElement(element) &&
  !renderConfig.imageCache.has(element.fileId);

const getCanvasPadding = (element: ExcalidrawElement) => {
  switch (element.type) {
    case "freedraw":
      return element.strokeWidth * 12;
    case "text":
      return element.fontSize / 2;
    case "arrow":
      if (element.endArrowhead || element.endArrowhead) {
        return 40;
      }
      return 20;
    default:
      return 20;
  }
};

export const getRenderOpacity = (
  element: ExcalidrawElement,
  containingFrame: ExcalidrawFrameLikeElement | null,
  elementsPendingErasure: ElementsPendingErasure,
  pendingNodes: Readonly<PendingExcalidrawElements> | null,
  globalAlpha: number = 1,
) => {
  // multiplying frame opacity with element opacity to combine them
  // (e.g. frame 50% and element 50% opacity should result in 25% opacity)
  let opacity =
    (((containingFrame?.opacity ?? 100) * element.opacity) / 10000) *
    globalAlpha;

  // if pending erasure, multiply again to combine further
  // (so that erasing always results in lower opacity than original)
  if (
    elementsPendingErasure.has(element.id) ||
    (pendingNodes && pendingNodes.some((node) => node.id === element.id)) ||
    (containingFrame && elementsPendingErasure.has(containingFrame.id))
  ) {
    opacity *= ELEMENT_READY_TO_ERASE_OPACITY / 100;
  }

  return opacity;
};

export interface ExcalidrawElementWithCanvas {
  element: ExcalidrawElement | ExcalidrawTextElement;
  canvas: HTMLCanvasElement;
  theme: AppState["theme"];
  scale: number;
  angle: number;
  zoomValue: AppState["zoom"]["value"];
  canvasOffsetX: number;
  canvasOffsetY: number;
  boundTextElementVersion: number | null;
  imageCrop: ExcalidrawImageElement["crop"] | null;
  containingFrameOpacity: number;
  boundTextCanvas: HTMLCanvasElement;
}

const cappedElementCanvasSize = (
  element: NonDeletedExcalidrawElement,
  elementsMap: ElementsMap,
  zoom: Zoom,
): {
  width: number;
  height: number;
  scale: number;
} => {
  // these limits are ballpark, they depend on specific browsers and device.
  // We've chosen lower limits to be safe. We might want to change these limits
  // based on browser/device type, if we get reports of low quality rendering
  // on zoom.
  //
  // ~ safari mobile canvas area limit
  const AREA_LIMIT = getAreaLimit(); //zsviczian
  // ~ safari width/height limit based on developer.mozilla.org.
  const WIDTH_HEIGHT_LIMIT = getWidthHeightLimit(); //zsviczian

  const padding = getCanvasPadding(element);

  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
  const elementWidth =
    isLinearElement(element) || isFreeDrawElement(element)
      ? distance(x1, x2)
      : element.width;
  const elementHeight =
    isLinearElement(element) || isFreeDrawElement(element)
      ? distance(y1, y2)
      : element.height;

  let width = elementWidth * window.devicePixelRatio + padding * 2;
  let height = elementHeight * window.devicePixelRatio + padding * 2;

  let scale: number = zoom.value;

  // rescale to ensure width and height is within limits
  if (
    width * scale > WIDTH_HEIGHT_LIMIT ||
    height * scale > WIDTH_HEIGHT_LIMIT
  ) {
    scale = Math.min(WIDTH_HEIGHT_LIMIT / width, WIDTH_HEIGHT_LIMIT / height);
  }

  // rescale to ensure canvas area is within limits
  if (width * height * scale * scale > AREA_LIMIT) {
    scale = Math.sqrt(AREA_LIMIT / (width * height));
  }

  width = Math.floor(width * scale);
  height = Math.floor(height * scale);

  return { width, height, scale };
};

const generateElementCanvas = (
  element: NonDeletedExcalidrawElement,
  elementsMap: NonDeletedSceneElementsMap,
  zoom: Zoom,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState | InteractiveCanvasAppState,
): ExcalidrawElementWithCanvas | null => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const padding = getCanvasPadding(element);

  const { width, height, scale } = cappedElementCanvasSize(
    element,
    elementsMap,
    zoom,
  );

  if (!width || !height) {
    return null;
  }

  canvas.width = width;
  canvas.height = height;

  let canvasOffsetX = -100;
  let canvasOffsetY = 0;

  if (isLinearElement(element) || isFreeDrawElement(element)) {
    const [x1, y1] = getElementAbsoluteCoords(element, elementsMap);

    canvasOffsetX =
      element.x > x1
        ? distance(element.x, x1) * window.devicePixelRatio * scale
        : 0;

    canvasOffsetY =
      element.y > y1
        ? distance(element.y, y1) * window.devicePixelRatio * scale
        : 0;

    context.translate(canvasOffsetX, canvasOffsetY);
  }

  context.save();
  context.translate(padding * scale, padding * scale);
  context.scale(
    window.devicePixelRatio * scale,
    window.devicePixelRatio * scale,
  );

  const rc = rough.canvas(canvas);

  drawElementOnCanvas(element, rc, context, renderConfig);

  context.restore();

  const boundTextElement = getBoundTextElement(element, elementsMap);
  const boundTextCanvas = document.createElement("canvas");
  const boundTextCanvasContext = boundTextCanvas.getContext("2d")!;

  if (isArrowElement(element) && boundTextElement) {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
    // Take max dimensions of arrow canvas so that when canvas is rotated
    // the arrow doesn't get clipped
    const maxDim = Math.max(distance(x1, x2), distance(y1, y2));
    boundTextCanvas.width =
      maxDim * window.devicePixelRatio * scale + padding * scale * 10;
    boundTextCanvas.height =
      maxDim * window.devicePixelRatio * scale + padding * scale * 10;
    boundTextCanvasContext.translate(
      boundTextCanvas.width / 2,
      boundTextCanvas.height / 2,
    );
    boundTextCanvasContext.rotate(element.angle);
    boundTextCanvasContext.drawImage(
      canvas!,
      -canvas.width / 2,
      -canvas.height / 2,
      canvas.width,
      canvas.height,
    );

    const [, , , , boundTextCx, boundTextCy] = getElementAbsoluteCoords(
      boundTextElement,
      elementsMap,
    );

    boundTextCanvasContext.rotate(-element.angle);
    const offsetX = (boundTextCanvas.width - canvas!.width) / 2;
    const offsetY = (boundTextCanvas.height - canvas!.height) / 2;
    const shiftX =
      boundTextCanvas.width / 2 -
      (boundTextCx - x1) * window.devicePixelRatio * scale -
      offsetX -
      padding * scale;

    const shiftY =
      boundTextCanvas.height / 2 -
      (boundTextCy - y1) * window.devicePixelRatio * scale -
      offsetY -
      padding * scale;
    boundTextCanvasContext.translate(-shiftX, -shiftY);
    // Clear the bound text area
    boundTextCanvasContext.clearRect(
      -(boundTextElement.width / 2 + BOUND_TEXT_PADDING) *
        window.devicePixelRatio *
        scale,
      -(boundTextElement.height / 2 + BOUND_TEXT_PADDING) *
        window.devicePixelRatio *
        scale,
      (boundTextElement.width + BOUND_TEXT_PADDING * 2) *
        window.devicePixelRatio *
        scale,
      (boundTextElement.height + BOUND_TEXT_PADDING * 2) *
        window.devicePixelRatio *
        scale,
    );
  }

  return {
    element,
    canvas,
    theme: appState.theme,
    scale,
    zoomValue: zoom.value,
    canvasOffsetX,
    canvasOffsetY,
    boundTextElementVersion:
      getBoundTextElement(element, elementsMap)?.version || null,
    containingFrameOpacity:
      getContainingFrame(element, elementsMap)?.opacity || 100,
    boundTextCanvas,
    angle: element.angle,
    imageCrop: isImageElement(element) ? element.crop : null,
  };
};

export const DEFAULT_LINK_SIZE = 14;

const IMAGE_PLACEHOLDER_IMG =
  typeof document !== "undefined"
    ? document.createElement("img")
    : ({ src: "" } as HTMLImageElement); // mock image element outside of browser

IMAGE_PLACEHOLDER_IMG.src = `data:${MIME_TYPES.svg},${encodeURIComponent(
  `<svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="image" class="svg-inline--fa fa-image fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#888" d="M464 448H48c-26.51 0-48-21.49-48-48V112c0-26.51 21.49-48 48-48h416c26.51 0 48 21.49 48 48v288c0 26.51-21.49 48-48 48zM112 120c-30.928 0-56 25.072-56 56s25.072 56 56 56 56-25.072 56-56-25.072-56-56-56zM64 384h384V272l-87.515-87.515c-4.686-4.686-12.284-4.686-16.971 0L208 320l-55.515-55.515c-4.686-4.686-12.284-4.686-16.971 0L64 336v48z"></path></svg>`,
)}`;

const IMAGE_ERROR_PLACEHOLDER_IMG =
  typeof document !== "undefined"
    ? document.createElement("img")
    : ({ src: "" } as HTMLImageElement); // mock image element outside of browser

IMAGE_ERROR_PLACEHOLDER_IMG.src = `data:${MIME_TYPES.svg},${encodeURIComponent(
  `<svg viewBox="0 0 668 668" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2"><path d="M464 448H48c-26.51 0-48-21.49-48-48V112c0-26.51 21.49-48 48-48h416c26.51 0 48 21.49 48 48v288c0 26.51-21.49 48-48 48ZM112 120c-30.928 0-56 25.072-56 56s25.072 56 56 56 56-25.072 56-56-25.072-56-56-56ZM64 384h384V272l-87.515-87.515c-4.686-4.686-12.284-4.686-16.971 0L208 320l-55.515-55.515c-4.686-4.686-12.284-4.686-16.971 0L64 336v48Z" style="fill:#888;fill-rule:nonzero" transform="matrix(.81709 0 0 .81709 124.825 145.825)"/><path d="M256 8C119.034 8 8 119.033 8 256c0 136.967 111.034 248 248 248s248-111.034 248-248S392.967 8 256 8Zm130.108 117.892c65.448 65.448 70 165.481 20.677 235.637L150.47 105.216c70.204-49.356 170.226-44.735 235.638 20.676ZM125.892 386.108c-65.448-65.448-70-165.481-20.677-235.637L361.53 406.784c-70.203 49.356-170.226 44.736-235.638-20.676Z" style="fill:#888;fill-rule:nonzero" transform="matrix(.30366 0 0 .30366 506.822 60.065)"/></svg>`,
)}`;

const drawImagePlaceholder = (
  element: ExcalidrawImageElement,
  context: CanvasRenderingContext2D,
  theme: StaticCanvasRenderConfig["theme"],
) => {
  context.fillStyle = theme === THEME.DARK ? "#2E2E2E" : "#E7E7E7";
  context.fillRect(0, 0, element.width, element.height);

  const imageMinWidthOrHeight = Math.min(element.width, element.height);

  const size = Math.min(
    imageMinWidthOrHeight,
    Math.min(imageMinWidthOrHeight * 0.4, 100),
  );

  context.drawImage(
    element.status === "error"
      ? IMAGE_ERROR_PLACEHOLDER_IMG
      : IMAGE_PLACEHOLDER_IMG,
    element.width / 2 - size / 2,
    element.height / 2 - size / 2,
    size,
    size,
  );
};

const drawGradientFill = ( //zsviczian
  element: NonDeletedExcalidrawElement, //zsviczian
  context: CanvasRenderingContext2D, //zsviczian
  renderConfig: StaticCanvasRenderConfig, //zsviczian
) => { //zsviczian
  const { width: w, height: h } = element; //zsviczian
  const isDark = renderConfig.theme === THEME.DARK; //zsviczian
  const startColor = element.gradientColor ?? "transparent"; //zsviczian
  const endColor = isDark //zsviczian
    ? applyDarkModeFilter(element.backgroundColor) //zsviczian
    : element.backgroundColor; //zsviczian
  const resolvedStart = //zsviczian
    startColor === "transparent" //zsviczian
      ? "transparent" //zsviczian
      : isDark //zsviczian
      ? applyDarkModeFilter(startColor) //zsviczian
      : startColor; //zsviczian
  context.save(); //zsviczian
  context.beginPath(); //zsviczian
  switch (element.type) { //zsviczian
    case "ellipse": //zsviczian
      context.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); //zsviczian
      break; //zsviczian
    case "diamond": { //zsviczian
      const [topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY] = //zsviczian
        getDiamondPoints(element); //zsviczian
      context.moveTo(topX, topY); //zsviczian
      context.lineTo(rightX, rightY); //zsviczian
      context.lineTo(bottomX, bottomY); //zsviczian
      context.lineTo(leftX, leftY); //zsviczian
      context.closePath(); //zsviczian
      break; //zsviczian
    } //zsviczian
    case "triangle": { //zsviczian
      const [apexX, apexY, brX, brY, blX, blY] = getTrianglePoints(element); //zsviczian
      context.moveTo(apexX, apexY); //zsviczian
      context.lineTo(brX, brY); //zsviczian
      context.lineTo(blX, blY); //zsviczian
      context.closePath(); //zsviczian
      break; //zsviczian
    } //zsviczian
    case "line": { //zsviczian
      if (isLinearElement(element)) { //zsviczian
        const pts = element.points; //zsviczian
        if (pts.length >= 2) { //zsviczian
          context.moveTo(pts[0][0], pts[0][1]); //zsviczian
          for (let i = 1; i < pts.length; i++) { //zsviczian
            context.lineTo(pts[i][0], pts[i][1]); //zsviczian
          } //zsviczian
          context.closePath(); //zsviczian
        } //zsviczian
      } //zsviczian
      break; //zsviczian
    } //zsviczian
    default: //zsviczian
      if (element.roundness && context.roundRect) { //zsviczian
        const r = getCornerRadius(Math.min(w, h), element); //zsviczian
        context.roundRect(0, 0, w, h, r); //zsviczian
      } else { //zsviczian
        context.rect(0, 0, w, h); //zsviczian
      } //zsviczian
  } //zsviczian
  context.clip(); //zsviczian
  const gradient = context.createLinearGradient(0, 0, 0, h); //zsviczian
  gradient.addColorStop(0, resolvedStart); //zsviczian
  gradient.addColorStop(1, endColor); //zsviczian
  context.fillStyle = gradient; //zsviczian
  context.fillRect(0, 0, w, h); //zsviczian
  context.restore(); //zsviczian
}; //zsviczian

const drawElementOnCanvas = (
  element: NonDeletedExcalidrawElement,
  rc: RoughCanvas,
  context: CanvasRenderingContext2D,
  renderConfig: StaticCanvasRenderConfig,
) => {
  switch (element.type) {
    case "rectangle":
    case "iframe":
    case "embeddable":
    case "diamond":
    case "triangle": //zsviczian
    case "ellipse": {
      context.lineJoin = "round";
      context.lineCap = "round";

      if (element.fillStyle === "gradient" && !isTransparent(element.backgroundColor)) { //zsviczian
        drawGradientFill(element, context, renderConfig); //zsviczian
      } //zsviczian
      rc.draw(ShapeCache.generateElementShape(element, renderConfig));
      break;
    }
    case "arrow":
    case "line": {
      context.lineJoin = "round";
      context.lineCap = "round";

      if ( //zsviczian
        element.type === "line" && //zsviczian
        element.fillStyle === "gradient" && //zsviczian
        !isTransparent(element.backgroundColor) && //zsviczian
        isPathALoop(element.points) //zsviczian
      ) { //zsviczian
        drawGradientFill(element, context, renderConfig); //zsviczian
      } //zsviczian

      ShapeCache.generateElementShape(element, renderConfig).forEach(
        (shape) => {
          rc.draw(shape);
        },
      );
      break;
    }
    case "freedraw": {
      // Draw directly to canvas
      context.save();

      const shapes = ShapeCache.generateElementShape(element, renderConfig);

      for (const shape of shapes) {
        if (typeof shape === "string") {
          const { path, fillStyle } = (() => { //zsviczian
            const path = new Path2D(getFreeDrawSvgPath(element));
            const hasOutline = element.customData?.strokeOptions?.hasOutline;
            const outlineWidth =
              element.customData?.strokeOptions?.outlineWidth ?? 1;
            const fillColor = hasOutline
              ? element.backgroundColor
              : element.strokeColor;
            const fillStyle =
              renderConfig.theme === THEME.DARK
                ? applyDarkModeFilter(fillColor)
                : fillColor;

            if (hasOutline) {
              context.lineWidth = element.strokeWidth * outlineWidth;
              context.strokeStyle =
                renderConfig.theme === THEME.DARK
                  ? applyDarkModeFilter(element.strokeColor)
                  : element.strokeColor;
              context.stroke(path);
            }

            return { path, fillStyle };
          })();

          context.fillStyle = fillStyle; //zsviczian
          context.fill(path); //zsviczian
          /*
          context.fillStyle =
            renderConfig.theme === THEME.DARK
              ? applyDarkModeFilter(element.strokeColor)
              : element.strokeColor;
          context.fill(new Path2D(shape));
          */ //zsviczian
        } else {
          rc.draw(shape);
        }
      }

      context.restore();
      break;
    }
    case "image": {
      context.save();
      const cacheEntry =
        element.fileId !== null
          ? renderConfig.imageCache.get(element.fileId)
          : null;
      const img = isInitializedImageElement(element)
        ? cacheEntry?.image
        : undefined;

      if (img != null && !(img instanceof Promise)) {
        if (element.roundness && context.roundRect) {
          context.beginPath();
          context.roundRect(
            0,
            0,
            element.width,
            element.height,
            getCornerRadius(Math.min(element.width, element.height), element),
          );
          context.clip();
        }

        const { x, y, width, height } = element.crop
          ? element.crop
          : {
              x: 0,
              y: 0,
              width: img.naturalWidth,
              height: img.naturalHeight,
            };

        const shouldInvertImage =
          renderConfig.theme === THEME.DARK &&
          ((cacheEntry?.mimeType === MIME_TYPES.svg && !element.customData?.doNotInvertSVGInDarkMode) ||
            (!!element.customData?.pdfPageViewProps && (element.customData?.invertBitmapInDarkmode ?? true)) ||
            !!element.customData?.invertBitmapInDarkmode); //zsviczian

        if (shouldInvertImage && isIOS) {
          const devicePixelRatio = window.devicePixelRatio || 1;
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = element.width * devicePixelRatio;
          tempCanvas.height = element.height * devicePixelRatio;
          const tempContext = tempCanvas.getContext("2d");

          if (tempContext) {
            tempContext.scale(devicePixelRatio, devicePixelRatio);
            tempContext.drawImage(
              img,
              x,
              y,
              width,
              height,
              0,
              0,
              element.width,
              element.height,
            );

            const imageData = tempContext.getImageData(
              0,
              0,
              tempCanvas.width,
              tempCanvas.height,
            );

            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
              data[i] = 255 - data[i];
              data[i + 1] = 255 - data[i + 1];
              data[i + 2] = 255 - data[i + 2];
            }

            tempContext.putImageData(imageData, 0, 0);
            context.drawImage(
              tempCanvas,
              0,
              0,
              tempCanvas.width,
              tempCanvas.height,
              0,
              0,
              element.width,
              element.height,
            );
          }
        } else {
          if (shouldInvertImage) {
            context.filter = DARK_THEME_FILTER;
          }

          context.drawImage(
            img,
            x,
            y,
            width,
            height,
            0 /* hardcoded for the selection box*/,
            0,
            element.width,
            element.height,
          );
        }
      } else {
        drawImagePlaceholder(element, context, renderConfig.theme);
      }
      context.restore();
      break;
    }
    default: {
      if (isTextElement(element)) {
        const rtl = isRTL(element.text);
        const shouldTemporarilyAttach = rtl && !context.canvas.isConnected;
        if (shouldTemporarilyAttach) {
          // to correctly render RTL text mixed with LTR, we have to append it
          // to the DOM
          document.body.appendChild(context.canvas);
        }
        context.canvas.setAttribute("dir", rtl ? "rtl" : "ltr");
        context.save();
        context.font = getFontString(element);
        context.fillStyle =
          renderConfig.theme === THEME.DARK
            ? applyDarkModeFilter(element.strokeColor)
            : element.strokeColor;
        context.textAlign = element.textAlign as CanvasTextAlign;

        // Canvas does not support multiline text by default
        const lines = element.text.replace(/\r\n?/g, "\n").split("\n");

        const horizontalOffset =
          element.textAlign === "center"
            ? element.width / 2
            : element.textAlign === "right"
            ? element.width
            : 0;

        const lineHeightPx = getLineHeightInPx(
          element.fontSize,
          element.lineHeight,
        );

        const verticalOffset = getVerticalOffset(
          element.fontFamily,
          element.fontSize,
          lineHeightPx,
        );

        // Draw text outline (halo) behind fill //zsviczian
        if (element.textOutlineWidth > 0) { //zsviczian
          const prevAlpha = context.globalAlpha; //zsviczian
          context.globalAlpha = prevAlpha * (element.textOutlineOpacity / 100); //zsviczian
          context.strokeStyle = //zsviczian
            renderConfig.theme === THEME.DARK //zsviczian
              ? applyDarkModeFilter(element.textOutlineColor) //zsviczian
              : element.textOutlineColor; //zsviczian
          context.lineWidth = element.textOutlineWidth * 2; //zsviczian
          context.lineJoin = "round"; //zsviczian
          for (let index = 0; index < lines.length; index++) { //zsviczian
            context.strokeText( //zsviczian
              lines[index], //zsviczian
              horizontalOffset, //zsviczian
              index * lineHeightPx + verticalOffset, //zsviczian
            ); //zsviczian
          } //zsviczian
          context.globalAlpha = prevAlpha; //zsviczian
        } //zsviczian

        for (let index = 0; index < lines.length; index++) {
          context.fillText(
            lines[index],
            horizontalOffset,
            index * lineHeightPx + verticalOffset,
          );
        }
        context.restore();
        if (shouldTemporarilyAttach) {
          context.canvas.remove();
        }
      } else {
        throw new Error(`Unimplemented type ${element.type}`);
      }
    }
  }
};

export const elementWithCanvasCache = new WeakMap<
  ExcalidrawElement,
  ExcalidrawElementWithCanvas
>();

const generateElementWithCanvas = (
  element: NonDeletedExcalidrawElement,
  elementsMap: NonDeletedSceneElementsMap,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState | InteractiveCanvasAppState,
) => {
  const zoom: Zoom = renderConfig
    ? appState.zoom
    : {
        value: 1 as NormalizedZoomValue,
      };
  const prevElementWithCanvas = elementWithCanvasCache.get(element);
  const shouldRegenerateBecauseZoom =
    prevElementWithCanvas &&
    prevElementWithCanvas.zoomValue !== zoom.value &&
    !appState?.shouldCacheIgnoreZoom;
  const boundTextElement = getBoundTextElement(element, elementsMap);
  const boundTextElementVersion = boundTextElement?.version || null;
  const imageCrop = isImageElement(element) ? element.crop : null;

  const containingFrameOpacity =
    getContainingFrame(element, elementsMap)?.opacity || 100;

  if (
    !prevElementWithCanvas ||
    shouldRegenerateBecauseZoom ||
    prevElementWithCanvas.theme !== appState.theme ||
    prevElementWithCanvas.boundTextElementVersion !== boundTextElementVersion ||
    prevElementWithCanvas.imageCrop !== imageCrop ||
    prevElementWithCanvas.containingFrameOpacity !== containingFrameOpacity ||
    // since we rotate the canvas when copying from cached canvas, we don't
    // regenerate the cached canvas. But we need to in case of labels which are
    // cached alongside the arrow, and we want the labels to remain unrotated
    // with respect to the arrow.
    (isArrowElement(element) &&
      boundTextElement &&
      element.angle !== prevElementWithCanvas.angle)
  ) {
    const elementWithCanvas = generateElementCanvas(
      element,
      elementsMap,
      zoom,
      renderConfig,
      appState,
    );

    if (!elementWithCanvas) {
      return null;
    }

    elementWithCanvasCache.set(element, elementWithCanvas);

    return elementWithCanvas;
  }
  return prevElementWithCanvas;
};

//zsviczian
// perspectiveY: horizontal strips — top/bottom trapezoid, varying strip WIDTH. //zsviczian
// perspectiveX: vertical strips — left/right trapezoid, varying strip HEIGHT and WIDTH. //zsviczian
// When both non-zero the X warp is applied first to a temp canvas, then Y warp follows. //zsviczian
const _applyHorizStripWarp = ( //zsviczian
  srcCanvas: HTMLCanvasElement, //zsviczian
  destCtx: CanvasRenderingContext2D, //zsviczian
  dstX: number, dstY: number, dstW: number, dstH: number, //zsviczian
  pY: number, //zsviczian
): void => { //zsviczian
  const srcW = srcCanvas.width; //zsviczian
  const srcH = srcCanvas.height; //zsviczian
  const shrinkY = Math.abs(pY) * dstW * 0.25; //zsviczian
  // Trapezoid: pY>0 → top narrows; pY<0 → bottom narrows //zsviczian
  const tlX = dstX + (pY > 0 ? shrinkY : 0); //zsviczian
  const trX = dstX + dstW - (pY > 0 ? shrinkY : 0); //zsviczian
  const blX = dstX + (pY < 0 ? shrinkY : 0); //zsviczian
  const brX = dstX + dstW - (pY < 0 ? shrinkY : 0); //zsviczian
  const tlY = dstY + (pY > 0 ? shrinkY * 0.5 : 0); //zsviczian
  const blY = dstY + dstH - (pY < 0 ? shrinkY * 0.5 : 0); //zsviczian
  const numStrips = Math.max(32, Math.min(128, Math.floor(srcH / 4))); //zsviczian
  for (let i = 0; i < numStrips; i++) { //zsviczian
    const t0 = i / numStrips; //zsviczian
    const t1 = (i + 1) / numStrips; //zsviczian
    const sy = t0 * srcH; //zsviczian
    const sh = (t1 - t0) * srcH; //zsviczian
    const dstLX0 = tlX + t0 * (blX - tlX); //zsviczian
    const dstRX0 = trX + t0 * (brX - trX); //zsviczian
    const dstLX1 = tlX + t1 * (blX - tlX); //zsviczian
    const dstRX1 = trX + t1 * (brX - trX); //zsviczian
    const dstY0 = tlY + t0 * (blY - tlY); //zsviczian
    const dstY1 = tlY + t1 * (blY - tlY); //zsviczian
    const dstWTop = dstRX0 - dstLX0; //zsviczian
    const dstWBot = dstRX1 - dstLX1; //zsviczian
    const dstHStrip = dstY1 - dstY0; //zsviczian
    if (dstWTop <= 0 || dstHStrip <= 0) { continue; } //zsviczian
    const scaleX = dstWTop / srcW; //zsviczian
    const scaleY = dstHStrip / sh; //zsviczian
    const skewX = (dstWBot - dstWTop) / srcH; //zsviczian
    destCtx.save(); //zsviczian
    destCtx.setTransform(scaleX, 0, skewX, scaleY, dstLX0, dstY0); //zsviczian
    destCtx.drawImage(srcCanvas, 0, sy, srcW, sh, 0, 0, srcW, sh); //zsviczian
    destCtx.restore(); //zsviczian
  } //zsviczian
}; //zsviczian
//zsviczian
// perspectiveX: vertical strips. pX>0 → right side shorter; pX<0 → left side shorter. //zsviczian
// Each strip's HEIGHT and WIDTH both scale with distance, matching perspectiveY behaviour. //zsviczian
const _applyVertStripWarp = ( //zsviczian
  srcCanvas: HTMLCanvasElement, //zsviczian
  destCtx: CanvasRenderingContext2D, //zsviczian
  dstX: number, dstY: number, dstW: number, dstH: number, //zsviczian
  pX: number, //zsviczian
): void => { //zsviczian
  const srcW = srcCanvas.width; //zsviczian
  const srcH = srcCanvas.height; //zsviczian
  const absPX = Math.abs(pX); //zsviczian
  // scaleFn(t): relative size at source fraction t (0=left,1=right) //zsviczian
  // pX>0 → right vanishes: scaleFn = 1 - t*absPX //zsviczian
  // pX<0 → left vanishes:  scaleFn = 1 - (1-t)*absPX //zsviczian
  // Integral of scaleFn from 0→1 = 1 - absPX/2; normalise so strips sum to dstW //zsviczian
  const normFactor = 1 / (1 - absPX / 2); //zsviczian
  // y-shear per source pixel: d(topY)/d(srcX) = pX*dstH/(2*srcW) //zsviczian
  const yShearPerSrcX = pX * dstH / (2 * srcW); //zsviczian
  const numStrips = Math.max(32, Math.min(128, Math.floor(srcW / 4))); //zsviczian
  const srcStripW = srcW / numStrips; //zsviczian
  let xAccum = dstX; //zsviczian
  for (let i = 0; i < numStrips; i++) { //zsviczian
    const t0 = i / numStrips; //zsviczian
    const scaleFn = pX > 0 ? (1 - t0 * absPX) : (1 - (1 - t0) * absPX); //zsviczian
    const dstStripW = (dstW / numStrips) * scaleFn * normFactor; //zsviczian
    const dstStripH = dstH * scaleFn; //zsviczian
    // topY: centered vertically, = dstY + (dstH - dstStripH)/2 //zsviczian
    const topY = dstY + (dstH - dstStripH) / 2; //zsviczian
    const srcX = t0 * srcW; //zsviczian
    if (dstStripH <= 0 || dstStripW <= 0) { xAccum += dstStripW; continue; } //zsviczian
    // setTransform(a,b,c,d,e,f): dest = (a*sx + c*sy + e, b*sx + d*sy + f) //zsviczian
    const a = dstStripW / srcStripW; // horizontal scale //zsviczian
    const b = yShearPerSrcX;         // y-shear: top edge slopes as x increases //zsviczian
    const d = dstStripH / srcH;      // vertical scale (varies per strip) //zsviczian
    destCtx.save(); //zsviczian
    destCtx.setTransform(a, b, 0, d, xAccum, topY); //zsviczian
    destCtx.drawImage(srcCanvas, srcX, 0, srcStripW, srcH, 0, 0, srcStripW, srcH); //zsviczian
    destCtx.restore(); //zsviczian
    xAccum += dstStripW; //zsviczian
  } //zsviczian
}; //zsviczian
//zsviczian
const drawPerspectiveWarped = ( //zsviczian
  srcCanvas: HTMLCanvasElement, //zsviczian
  destCtx: CanvasRenderingContext2D, //zsviczian
  dstX: number, dstY: number, dstW: number, dstH: number, //zsviczian
  perspectiveX: number, //zsviczian
  perspectiveY: number, //zsviczian
): void => { //zsviczian
  if (perspectiveX !== 0 && perspectiveY !== 0) { //zsviczian
    // Apply X first to a same-size temp canvas, then Y to dest //zsviczian
    const srcW = srcCanvas.width; //zsviczian
    const srcH = srcCanvas.height; //zsviczian
    const temp = document.createElement("canvas"); //zsviczian
    temp.width = srcW; //zsviczian
    temp.height = srcH; //zsviczian
    _applyVertStripWarp(srcCanvas, temp.getContext("2d")!, 0, 0, srcW, srcH, perspectiveX); //zsviczian
    _applyHorizStripWarp(temp, destCtx, dstX, dstY, dstW, dstH, perspectiveY); //zsviczian
  } else if (perspectiveX !== 0) { //zsviczian
    _applyVertStripWarp(srcCanvas, destCtx, dstX, dstY, dstW, dstH, perspectiveX); //zsviczian
  } else { //zsviczian
    _applyHorizStripWarp(srcCanvas, destCtx, dstX, dstY, dstW, dstH, perspectiveY); //zsviczian
  } //zsviczian
}; //zsviczian

const drawElementFromCanvas = (
  elementWithCanvas: ExcalidrawElementWithCanvas,
  context: CanvasRenderingContext2D,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState | InteractiveCanvasAppState,
  allElementsMap: NonDeletedSceneElementsMap,
) => {
  const element = elementWithCanvas.element;
  const padding = getCanvasPadding(element);
  const zoom = elementWithCanvas.scale;
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, allElementsMap);
  const cx = ((x1 + x2) / 2 + appState.scrollX) * window.devicePixelRatio;
  const cy = ((y1 + y2) / 2 + appState.scrollY) * window.devicePixelRatio;

  context.save();
  context.scale(1 / window.devicePixelRatio, 1 / window.devicePixelRatio);

  const boundTextElement = getBoundTextElement(element, allElementsMap);

  if (isArrowElement(element) && boundTextElement) {
    const offsetX =
      (elementWithCanvas.boundTextCanvas.width -
        elementWithCanvas.canvas!.width) /
      2;
    const offsetY =
      (elementWithCanvas.boundTextCanvas.height -
        elementWithCanvas.canvas!.height) /
      2;
    context.translate(cx, cy);
    context.drawImage(
      elementWithCanvas.boundTextCanvas,
      (-(x2 - x1) / 2) * window.devicePixelRatio - offsetX / zoom - padding,
      (-(y2 - y1) / 2) * window.devicePixelRatio - offsetY / zoom - padding,
      elementWithCanvas.boundTextCanvas.width / zoom,
      elementWithCanvas.boundTextCanvas.height / zoom,
    );
  } else {
    // we translate context to element center so that rotation and scale
    // originates from the element center
    context.translate(cx, cy);

    context.rotate(element.angle);

    if (
      "scale" in elementWithCanvas.element &&
      !isPendingImageElement(element, renderConfig) &&
      !isIframeLikeElement(element) //zsviczian
    ) {
      context.scale(
        elementWithCanvas.element.scale[0],
        elementWithCanvas.element.scale[1],
      );
    }

    // revert afterwards we don't have account for it during drawing
    context.translate(-cx, -cy);

    if ( //zsviczian
      isTextElement(element) && //zsviczian
      !element.containerId && //zsviczian
      ((element.perspectiveX ?? 0) !== 0 || (element.perspectiveY ?? 0) !== 0) //zsviczian
    ) { //zsviczian
      const srcCanvas = elementWithCanvas.canvas!; //zsviczian
      const dstX = (x1 + appState.scrollX) * window.devicePixelRatio - //zsviczian
        (padding * elementWithCanvas.scale) / elementWithCanvas.scale; //zsviczian
      const dstY = (y1 + appState.scrollY) * window.devicePixelRatio - //zsviczian
        (padding * elementWithCanvas.scale) / elementWithCanvas.scale; //zsviczian
      const dstW = srcCanvas.width / elementWithCanvas.scale; //zsviczian
      const dstH = srcCanvas.height / elementWithCanvas.scale; //zsviczian
      const tempCanvas = document.createElement("canvas"); //zsviczian
      tempCanvas.width = srcCanvas.width; //zsviczian
      tempCanvas.height = srcCanvas.height; //zsviczian
      const tempCtx = tempCanvas.getContext("2d")!; //zsviczian
      drawPerspectiveWarped( //zsviczian
        srcCanvas, tempCtx, //zsviczian
        0, 0, srcCanvas.width, srcCanvas.height, //zsviczian
        element.perspectiveX ?? 0, element.perspectiveY ?? 0, //zsviczian
      ); //zsviczian
      context.drawImage(tempCanvas, dstX, dstY, dstW, dstH); //zsviczian
    } else { //zsviczian
      context.drawImage(
        elementWithCanvas.canvas!,
        (x1 + appState.scrollX) * window.devicePixelRatio -
          (padding * elementWithCanvas.scale) / elementWithCanvas.scale,
        (y1 + appState.scrollY) * window.devicePixelRatio -
          (padding * elementWithCanvas.scale) / elementWithCanvas.scale,
        elementWithCanvas.canvas!.width / elementWithCanvas.scale,
        elementWithCanvas.canvas!.height / elementWithCanvas.scale,
      );
    } //zsviczian

    if (
      import.meta.env.VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX ===
        "true" &&
      hasBoundTextElement(element)
    ) {
      const textElement = getBoundTextElement(
        element,
        allElementsMap,
      ) as ExcalidrawTextElementWithContainer;
      const coords = getContainerCoords(element);
      context.strokeStyle = "#c92a2a";
      context.lineWidth = 3;
      context.strokeRect(
        (coords.x + appState.scrollX) * window.devicePixelRatio,
        (coords.y + appState.scrollY) * window.devicePixelRatio,
        getBoundTextMaxWidth(element, textElement) * window.devicePixelRatio,
        getBoundTextMaxHeight(element, textElement) * window.devicePixelRatio,
      );
    }
  }
  context.restore();

  // Clear the nested element we appended to the DOM
};

export const renderSelectionElement = (
  element: NonDeletedExcalidrawElement,
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  selectionColor: InteractiveCanvasRenderConfig["selectionColor"],
) => {
  context.save();
  context.translate(element.x + appState.scrollX, element.y + appState.scrollY);
  context.fillStyle = "rgba(0, 0, 200, 0.04)";

  // render from 0.5px offset  to get 1px wide line
  // https://stackoverflow.com/questions/7530593/html5-canvas-and-line-width/7531540#7531540
  // TODO can be be improved by offseting to the negative when user selects
  // from right to left
  const offset = 0.5 / appState.zoom.value;

  context.fillRect(offset, offset, element.width, element.height);
  context.lineWidth = 1.5 / appState.zoom.value; //zsviczian changed from 1 to 1.5
  context.strokeStyle = selectionColor;
  context.strokeRect(offset, offset, element.width, element.height);

  context.restore();
};

export const renderElement = (
  element: NonDeletedExcalidrawElement,
  elementsMap: RenderableElementsMap,
  allElementsMap: NonDeletedSceneElementsMap,
  rc: RoughCanvas,
  context: CanvasRenderingContext2D,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState | InteractiveCanvasAppState,
) => {
  const reduceAlphaForSelection =
    appState.openDialog?.name === "elementLinkSelector" &&
    !appState.selectedElementIds[element.id] &&
    !appState.hoveredElementIds[element.id];

  context.globalAlpha = getRenderOpacity(
    element,
    getContainingFrame(element, elementsMap),
    renderConfig.elementsPendingErasure,
    renderConfig.pendingFlowchartNodes,
    reduceAlphaForSelection ? DEFAULT_REDUCED_GLOBAL_ALPHA : 1,
  );

  switch (element.type) {
    case "magicframe":
    case "frame": {
      if ( //zsviczian
        appState.frameRendering.enabled && appState.frameRendering.outline &&
        !(!appState.frameRendering.markerEnabled && element.frameRole === "marker")
      ) {
        context.save();
        context.translate(
          element.x + appState.scrollX,
          element.y + appState.scrollY,
        );
        context.fillStyle =
          element.customData?.frameColor?.fill ??
          appState?.frameColor?.fill ??
          "rgba(0, 0, 200, 0.04)"; //zsviczian

        context.lineWidth = FRAME_STYLE.strokeWidth / appState.zoom.value;
        context.strokeStyle =
          appState.theme === THEME.DARK
            ? applyDarkModeFilter(
                element.customData?.frameColor?.stroke ??
                  appState?.frameColor?.stroke ??
                  FRAME_STYLE.strokeColor, //zsviczian
              )
            : element.customData?.frameColor?.stroke ??
              appState?.frameColor?.stroke ??
              FRAME_STYLE.strokeColor; //zsviczian

        // TODO change later to only affect AI frames
        if (isMagicFrameElement(element)) {
          context.strokeStyle =
            appState.theme === THEME.LIGHT
              ? "#7affd7"
              : applyDarkModeFilter("#1d8264");
        }

        //zsviczian
        if (element.frameRole === "marker") {
          const dash = 8 / appState.zoom.value;
          const gap = 6 / appState.zoom.value;
          context.setLineDash([dash, gap]);
        }

        if (FRAME_STYLE.radius && context.roundRect && element.frameRole !== "marker") { //zsviczian
          context.beginPath();
          context.roundRect(
            0,
            0,
            element.width,
            element.height,
            FRAME_STYLE.radius / appState.zoom.value,
          );
          context.stroke();
          context.closePath();
        } else {
          context.strokeRect(0, 0, element.width, element.height);
        }

        context.restore();
      }
      break;
    }
    case "freedraw": {
      if (renderConfig.isExporting) {
        const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
        const cx = (x1 + x2) / 2 + appState.scrollX;
        const cy = (y1 + y2) / 2 + appState.scrollY;
        const shiftX = (x2 - x1) / 2 - (element.x - x1);
        const shiftY = (y2 - y1) / 2 - (element.y - y1);
        context.save();
        context.translate(cx, cy);
        context.rotate(element.angle);
        context.translate(-shiftX, -shiftY);
        drawElementOnCanvas(element, rc, context, renderConfig);
        context.restore();
      } else {
        const elementWithCanvas = generateElementWithCanvas(
          element,
          allElementsMap,
          renderConfig,
          appState,
        );
        if (!elementWithCanvas) {
          return;
        }

        drawElementFromCanvas(
          elementWithCanvas,
          context,
          renderConfig,
          appState,
          allElementsMap,
        );
      }

      break;
    }
    case "rectangle":
    case "diamond":
    case "triangle": //zsviczian
    case "ellipse":
    case "line":
    case "arrow":
    case "image":
    case "text":
    case "iframe":
    case "embeddable": {
      if (renderConfig.isExporting) {
        const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
        const cx = (x1 + x2) / 2 + appState.scrollX;
        const cy = (y1 + y2) / 2 + appState.scrollY;
        let shiftX = (x2 - x1) / 2 - (element.x - x1);
        let shiftY = (y2 - y1) / 2 - (element.y - y1);
        if (isTextElement(element)) {
          const container = getContainerElement(element, elementsMap);
          if (isArrowElement(container)) {
            const boundTextCoords =
              LinearElementEditor.getBoundTextElementPosition(
                container,
                element as ExcalidrawTextElementWithContainer,
                elementsMap,
              );
            shiftX = (x2 - x1) / 2 - (boundTextCoords.x - x1);
            shiftY = (y2 - y1) / 2 - (boundTextCoords.y - y1);
          }
        }
        context.save();
        context.translate(cx, cy);

        const boundTextElement = getBoundTextElement(element, elementsMap);

        if (isArrowElement(element) && boundTextElement) {
          const tempCanvas = document.createElement("canvas");

          const tempCanvasContext = tempCanvas.getContext("2d")!;

          // Take max dimensions of arrow canvas so that when canvas is rotated
          // the arrow doesn't get clipped
          const maxDim = Math.max(distance(x1, x2), distance(y1, y2));
          const padding = getCanvasPadding(element);
          tempCanvas.width =
            maxDim * appState.exportScale + padding * 10 * appState.exportScale;
          tempCanvas.height =
            maxDim * appState.exportScale + padding * 10 * appState.exportScale;

          tempCanvasContext.translate(
            tempCanvas.width / 2,
            tempCanvas.height / 2,
          );
          tempCanvasContext.scale(appState.exportScale, appState.exportScale);

          // Shift the canvas to left most point of the arrow
          shiftX = element.width / 2 - (element.x - x1);
          shiftY = element.height / 2 - (element.y - y1);

          tempCanvasContext.rotate(element.angle);
          const tempRc = rough.canvas(tempCanvas);

          tempCanvasContext.translate(-shiftX, -shiftY);

          drawElementOnCanvas(element, tempRc, tempCanvasContext, renderConfig);

          tempCanvasContext.translate(shiftX, shiftY);

          tempCanvasContext.rotate(-element.angle);

          // Shift the canvas to center of bound text
          const [, , , , boundTextCx, boundTextCy] = getElementAbsoluteCoords(
            boundTextElement,
            elementsMap,
          );
          const boundTextShiftX = (x1 + x2) / 2 - boundTextCx;
          const boundTextShiftY = (y1 + y2) / 2 - boundTextCy;
          tempCanvasContext.translate(-boundTextShiftX, -boundTextShiftY);

          // Clear the bound text area
          tempCanvasContext.clearRect(
            -boundTextElement.width / 2,
            -boundTextElement.height / 2,
            boundTextElement.width,
            boundTextElement.height,
          );
          context.scale(1 / appState.exportScale, 1 / appState.exportScale);
          context.drawImage(
            tempCanvas,
            -tempCanvas.width / 2,
            -tempCanvas.height / 2,
            tempCanvas.width,
            tempCanvas.height,
          );
        } else {
          context.rotate(element.angle);

          if (element.type === "image") {
            // note: scale must be applied *after* rotating
            context.scale(element.scale[0], element.scale[1]);
          }

          context.translate(-shiftX, -shiftY);
          drawElementOnCanvas(element, rc, context, renderConfig);
        }

        context.restore();
        // not exporting → optimized rendering (cache & render from element
        // canvases)
      } else {
        const elementWithCanvas = generateElementWithCanvas(
          element,
          allElementsMap,
          renderConfig,
          appState,
        );

        if (!elementWithCanvas) {
          return;
        }

        const currentImageSmoothingStatus = context.imageSmoothingEnabled;

        if (
          // do not disable smoothing during zoom as blurry shapes look better
          // on low resolution (while still zooming in) than sharp ones
          !appState?.shouldCacheIgnoreZoom &&
          // angle is 0 -> always disable smoothing
          (!element.angle ||
            // or check if angle is a right angle in which case we can still
            // disable smoothing without adversely affecting the result
            // We need less-than comparison because of FP artihmetic
            isRightAngleRads(element.angle))
        ) {
          // Disabling smoothing makes output much sharper, especially for
          // text. Unless for non-right angles, where the aliasing is really
          // terrible on Chromium.
          //
          // Note that `context.imageSmoothingQuality="high"` has almost
          // zero effect.
          //
          context.imageSmoothingEnabled = false;
        }

        if (
          element.id === appState.croppingElementId &&
          isImageElement(elementWithCanvas.element) &&
          elementWithCanvas.element.crop !== null
        ) {
          context.save();
          context.globalAlpha = 0.1;

          const uncroppedElementCanvas = generateElementCanvas(
            getUncroppedImageElement(elementWithCanvas.element, elementsMap),
            allElementsMap,
            appState.zoom,
            renderConfig,
            appState,
          );

          if (uncroppedElementCanvas) {
            drawElementFromCanvas(
              uncroppedElementCanvas,
              context,
              renderConfig,
              appState,
              allElementsMap,
            );
          }

          context.restore();
        }

        drawElementFromCanvas(
          elementWithCanvas,
          context,
          renderConfig,
          appState,
          allElementsMap,
        );

        // reset
        context.imageSmoothingEnabled = currentImageSmoothingStatus;
      }
      break;
    }
    default: {
      // @ts-ignore
      throw new Error(`Unimplemented type ${element.type}`);
    }
  }

  context.globalAlpha = 1;
};

export function getFreedrawOutlineAsSegments(
  element: ExcalidrawFreeDrawElement,
  points: [number, number][],
  elementsMap: ElementsMap,
) {
  const bounds = getElementBounds(
    {
      ...element,
      angle: 0 as Radians,
    },
    elementsMap,
  );
  const center = pointFrom<GlobalPoint>(
    (bounds[0] + bounds[2]) / 2,
    (bounds[1] + bounds[3]) / 2,
  );

  invariant(points.length >= 2, "Freepath outline must have at least 2 points");

  return points.slice(2).reduce(
    (acc, curr) => {
      acc.push(
        lineSegment<GlobalPoint>(
          acc[acc.length - 1][1],
          pointRotateRads(
            pointFrom<GlobalPoint>(curr[0] + element.x, curr[1] + element.y),
            center,
            element.angle,
          ),
        ),
      );
      return acc;
    },
    [
      lineSegment<GlobalPoint>(
        pointRotateRads(
          pointFrom<GlobalPoint>(
            points[0][0] + element.x,
            points[0][1] + element.y,
          ),
          center,
          element.angle,
        ),
        pointRotateRads(
          pointFrom<GlobalPoint>(
            points[1][0] + element.x,
            points[1][1] + element.y,
          ),
          center,
          element.angle,
        ),
      ),
    ],
  );
}
