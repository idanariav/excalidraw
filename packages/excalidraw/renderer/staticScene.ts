import {
  applyDarkModeFilter,
  FRAME_STYLE,
  THEME,
  throttleRAF,
} from "@excalidraw/common";
import { isElementLink } from "@excalidraw/element";
import { createPlaceholderEmbeddableLabel } from "@excalidraw/element";
import { getBoundTextElement } from "@excalidraw/element";
import {
  isEmbeddableElement,
  isIframeLikeElement,
  isTextElement,
} from "@excalidraw/element";
import {
  elementOverlapsWithFrame,
  getTargetFrame,
  shouldApplyFrameClip,
} from "@excalidraw/element";

import { renderElement } from "@excalidraw/element";

import { getElementAbsoluteCoords } from "@excalidraw/element";

import type {
  ElementsMap,
  ExcalidrawFrameLikeElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import {
  EXTERNAL_LINK_IMG,
  ELEMENT_LINK_IMG,
  getLinkHandleFromCoords,
} from "../components/hyperlink/helpers";

import { bootstrapCanvas, getNormalizedCanvasDimensions } from "./helpers";

import type {
  StaticCanvasRenderConfig,
  StaticSceneRenderConfig,
} from "../scene/types";
import type { StaticCanvasAppState, Zoom } from "../types";

/*const GridLineColor = {
  [THEME.LIGHT]: {
    bold: "#dddddd",
    regular: "#e5e5e5",
  },
  [THEME.DARK]: {
    bold: applyDarkModeFilter("#dddddd"),
    regular: applyDarkModeFilter("#e5e5e5"),
  },
} as const;*/ //zsviczian

/** //zsviczian
 * Draws one family of parallel lines at a given angle (radians from +x axis). //zsviczian
 * Handles scroll tiling via normal-direction projection. //zsviczian
 */ //zsviczian
const strokeAngledLines = ( //zsviczian
  context: CanvasRenderingContext2D, //zsviczian
  angle: number, //zsviczian
  gridSize: number, //zsviczian
  gridStep: number, //zsviczian
  scrollX: number, //zsviczian
  scrollY: number, //zsviczian
  zoom: Zoom, //zsviczian
  width: number, //zsviczian
  height: number, //zsviczian
  bold: string, //zsviczian
  regular: string, //zsviczian
) => { //zsviczian
  const cos = Math.cos(angle); //zsviczian
  const sin = Math.sin(angle); //zsviczian
  // Unit normal (perpendicular, 90° CCW from line direction)
  const nx = -sin; //zsviczian
  const ny = cos; //zsviczian
  // Unit direction along the lines
  const dx = cos; //zsviczian
  const dy = sin; //zsviczian

  const actualGridSize = gridSize * zoom.value; //zsviczian
  const spaceWidth = 1 / zoom.value; //zsviczian
  const pad = gridSize * 2; //zsviczian

  // Project scroll offset onto the normal direction
  const scrollProj = scrollX * nx + scrollY * ny; //zsviczian
  // Tile offset analogous to (scrollX % gridSize) - gridSize in the square grid
  const tileOffset = //zsviczian
    ((scrollProj % gridSize) + gridSize) % gridSize - gridSize; //zsviczian

  // Project padded viewport corners onto normal to get the draw range
  const c0x = -pad, c0y = -pad; //zsviczian
  const c1x = width + pad, c1y = -pad; //zsviczian
  const c2x = -pad, c2y = height + pad; //zsviczian
  const c3x = width + pad, c3y = height + pad; //zsviczian
  const p0 = c0x * nx + c0y * ny; //zsviczian
  const p1 = c1x * nx + c1y * ny; //zsviczian
  const p2 = c2x * nx + c2y * ny; //zsviczian
  const p3 = c3x * nx + c3y * ny; //zsviczian
  const minProj = Math.min(p0, p1, p2, p3); //zsviczian
  const maxProj = Math.max(p0, p1, p2, p3); //zsviczian

  const startProj = //zsviczian
    tileOffset + //zsviczian
    Math.floor((minProj - tileOffset) / gridSize) * gridSize; //zsviczian

  for (let lv = startProj; lv <= maxProj; lv += gridSize) { //zsviczian
    const isBold = //zsviczian
      gridStep > 1 && //zsviczian
      Math.round(lv - scrollProj) % (gridStep * gridSize) === 0; //zsviczian
    if (!isBold && actualGridSize < 10) { //zsviczian
      continue; //zsviczian
    } //zsviczian

    // Anchor point on this line (closest to canvas origin)
    const px = lv * nx; //zsviczian
    const py = lv * ny; //zsviczian

    // Parametric clip: find t-range keeping segment inside padded viewport
    let tMin = -Infinity; //zsviczian
    let tMax = Infinity; //zsviczian
    if (Math.abs(dx) > 1e-9) { //zsviczian
      const t1 = (-pad - px) / dx; //zsviczian
      const t2 = (width + pad - px) / dx; //zsviczian
      tMin = Math.max(tMin, Math.min(t1, t2)); //zsviczian
      tMax = Math.min(tMax, Math.max(t1, t2)); //zsviczian
    } //zsviczian
    if (Math.abs(dy) > 1e-9) { //zsviczian
      const t1 = (-pad - py) / dy; //zsviczian
      const t2 = (height + pad - py) / dy; //zsviczian
      tMin = Math.max(tMin, Math.min(t1, t2)); //zsviczian
      tMax = Math.min(tMax, Math.max(t1, t2)); //zsviczian
    } //zsviczian
    if (tMin >= tMax) { //zsviczian
      continue; //zsviczian
    } //zsviczian

    const lineWidth = Math.min(1 / zoom.value, isBold ? 4 : 1); //zsviczian
    context.lineWidth = lineWidth; //zsviczian
    const lineDash = [lineWidth * 3, spaceWidth + lineWidth + spaceWidth]; //zsviczian
    context.beginPath(); //zsviczian
    context.setLineDash(isBold ? [] : lineDash); //zsviczian
    context.strokeStyle = isBold ? bold : regular; //zsviczian
    context.moveTo(px + tMin * dx, py + tMin * dy); //zsviczian
    context.lineTo(px + tMax * dx, py + tMax * dy); //zsviczian
    context.stroke(); //zsviczian
  } //zsviczian
}; //zsviczian

/** Isometric grid: two diagonal line families at ±30° from horizontal. */ //zsviczian
const strokeIsometricGrid = ( //zsviczian
  context: CanvasRenderingContext2D, //zsviczian
  gridSize: number, //zsviczian
  gridStep: number, //zsviczian
  scrollX: number, //zsviczian
  scrollY: number, //zsviczian
  zoom: Zoom, //zsviczian
  theme: StaticCanvasRenderConfig["theme"], //zsviczian
  width: number, //zsviczian
  height: number, //zsviczian
  gridLineColor: { Bold: string; Regular: string }, //zsviczian
) => { //zsviczian
  const bold = //zsviczian
    theme === THEME.DARK //zsviczian
      ? applyDarkModeFilter(gridLineColor.Bold) //zsviczian
      : gridLineColor.Bold; //zsviczian
  const regular = //zsviczian
    theme === THEME.DARK //zsviczian
      ? applyDarkModeFilter(gridLineColor.Regular) //zsviczian
      : gridLineColor.Regular; //zsviczian
  context.save(); //zsviczian
  strokeAngledLines( //zsviczian
    context, Math.PI / 6, gridSize, gridStep, scrollX, scrollY, zoom, width, height, bold, regular, //zsviczian
  ); //zsviczian
  strokeAngledLines( //zsviczian
    context, -Math.PI / 6, gridSize, gridStep, scrollX, scrollY, zoom, width, height, bold, regular, //zsviczian
  ); //zsviczian
  context.restore(); //zsviczian
}; //zsviczian

/** Triangle grid: horizontal lines + diagonals at ±60°, forming equilateral triangles. */ //zsviczian
const strokeTriangleGrid = ( //zsviczian
  context: CanvasRenderingContext2D, //zsviczian
  gridSize: number, //zsviczian
  gridStep: number, //zsviczian
  scrollX: number, //zsviczian
  scrollY: number, //zsviczian
  zoom: Zoom, //zsviczian
  theme: StaticCanvasRenderConfig["theme"], //zsviczian
  width: number, //zsviczian
  height: number, //zsviczian
  gridLineColor: { Bold: string; Regular: string }, //zsviczian
) => { //zsviczian
  const bold = //zsviczian
    theme === THEME.DARK //zsviczian
      ? applyDarkModeFilter(gridLineColor.Bold) //zsviczian
      : gridLineColor.Bold; //zsviczian
  const regular = //zsviczian
    theme === THEME.DARK //zsviczian
      ? applyDarkModeFilter(gridLineColor.Regular) //zsviczian
      : gridLineColor.Regular; //zsviczian
  context.save(); //zsviczian
  // Horizontal lines (angle = 0)
  strokeAngledLines( //zsviczian
    context, 0, gridSize, gridStep, scrollX, scrollY, zoom, width, height, bold, regular, //zsviczian
  ); //zsviczian
  // Diagonal at +60°
  strokeAngledLines( //zsviczian
    context, Math.PI / 3, gridSize, gridStep, scrollX, scrollY, zoom, width, height, bold, regular, //zsviczian
  ); //zsviczian
  // Diagonal at -60°
  strokeAngledLines( //zsviczian
    context, -Math.PI / 3, gridSize, gridStep, scrollX, scrollY, zoom, width, height, bold, regular, //zsviczian
  ); //zsviczian
  context.restore(); //zsviczian
}; //zsviczian

/** //zsviczian
 * One-point perspective grid: radial spokes from viewport center + horizontal parallels. //zsviczian
 * The vanishing point is always at the center of the visible viewport. //zsviczian
 */ //zsviczian
const strokePerspectiveGrid = ( //zsviczian
  context: CanvasRenderingContext2D, //zsviczian
  gridSize: number, //zsviczian
  gridStep: number, //zsviczian
  zoom: Zoom, //zsviczian
  theme: StaticCanvasRenderConfig["theme"], //zsviczian
  width: number, //zsviczian
  height: number, //zsviczian
  gridLineColor: { Bold: string; Regular: string }, //zsviczian
) => { //zsviczian
  const bold = //zsviczian
    theme === THEME.DARK //zsviczian
      ? applyDarkModeFilter(gridLineColor.Bold) //zsviczian
      : gridLineColor.Bold; //zsviczian
  const regular = //zsviczian
    theme === THEME.DARK //zsviczian
      ? applyDarkModeFilter(gridLineColor.Regular) //zsviczian
      : gridLineColor.Regular; //zsviczian

  const vpX = width / 2; //zsviczian
  const vpY = height / 2; //zsviczian
  const pad = gridSize; //zsviczian
  const spaceWidth = 1 / zoom.value; //zsviczian
  const regularLineWidth = Math.min(1 / zoom.value, 1); //zsviczian
  const boldLineWidth = Math.min(1 / zoom.value, 4); //zsviczian
  const lineDash = [regularLineWidth * 3, spaceWidth + regularLineWidth + spaceWidth]; //zsviczian

  context.save(); //zsviczian

  // Radial spokes from the vanishing point
  const numSpokes = Math.max(8, gridStep * 4); //zsviczian
  for (let i = 0; i < numSpokes; i++) { //zsviczian
    const angle = (i * Math.PI * 2) / numSpokes; //zsviczian
    const cos = Math.cos(angle); //zsviczian
    const sin = Math.sin(angle); //zsviczian

    // Find how far we can extend the ray before leaving the padded viewport
    let tMax = Infinity; //zsviczian
    if (cos > 1e-9) { tMax = Math.min(tMax, (width + pad - vpX) / cos); } //zsviczian
    else if (cos < -1e-9) { tMax = Math.min(tMax, (-pad - vpX) / cos); } //zsviczian
    if (sin > 1e-9) { tMax = Math.min(tMax, (height + pad - vpY) / sin); } //zsviczian
    else if (sin < -1e-9) { tMax = Math.min(tMax, (-pad - vpY) / sin); } //zsviczian

    context.lineWidth = regularLineWidth; //zsviczian
    context.beginPath(); //zsviczian
    context.setLineDash(lineDash); //zsviczian
    context.strokeStyle = regular; //zsviczian
    context.moveTo(vpX, vpY); //zsviczian
    context.lineTo(vpX + cos * tMax, vpY + sin * tMax); //zsviczian
    context.stroke(); //zsviczian
  } //zsviczian

  // Horizontal parallels above and below the vanishing point
  // k=0 is the horizon (bold), ±1, ±2, ... are regular
  const actualGridSize = gridSize * zoom.value; //zsviczian
  for (let k = 0; ; k++) { //zsviczian
    const offsets = k === 0 ? [0] : [k * gridSize, -k * gridSize]; //zsviczian
    let anyDrawn = false; //zsviczian
    for (const off of offsets) { //zsviczian
      const y = vpY + off; //zsviczian
      if (y < -pad || y > height + pad) { //zsviczian
        continue; //zsviczian
      } //zsviczian
      anyDrawn = true; //zsviczian
      const isBold = k === 0 || (gridStep > 1 && k % gridStep === 0); //zsviczian
      if (!isBold && actualGridSize < 10) { //zsviczian
        continue; //zsviczian
      } //zsviczian
      context.lineWidth = isBold ? boldLineWidth : regularLineWidth; //zsviczian
      context.beginPath(); //zsviczian
      context.setLineDash(isBold ? [] : lineDash); //zsviczian
      context.strokeStyle = isBold ? bold : regular; //zsviczian
      context.moveTo(-pad, y); //zsviczian
      context.lineTo(width + pad, y); //zsviczian
      context.stroke(); //zsviczian
    } //zsviczian
    if (k > 0 && !anyDrawn) { //zsviczian
      break; //zsviczian
    } //zsviczian
  } //zsviczian

  // Mark the vanishing point with a small cross
  const crossSize = Math.min(gridSize * 0.3, 6 / zoom.value); //zsviczian
  context.lineWidth = boldLineWidth; //zsviczian
  context.setLineDash([]); //zsviczian
  context.strokeStyle = bold; //zsviczian
  context.beginPath(); //zsviczian
  context.moveTo(vpX - crossSize, vpY); //zsviczian
  context.lineTo(vpX + crossSize, vpY); //zsviczian
  context.moveTo(vpX, vpY - crossSize); //zsviczian
  context.lineTo(vpX, vpY + crossSize); //zsviczian
  context.stroke(); //zsviczian

  context.restore(); //zsviczian
}; //zsviczian

const strokeGrid = (
  context: CanvasRenderingContext2D,
  /** grid cell pixel size */
  gridSize: number,
  /** setting to 1 will disble bold lines */
  gridStep: number,
  scrollX: number,
  scrollY: number,
  zoom: Zoom,
  theme: StaticCanvasRenderConfig["theme"],
  width: number,
  height: number,
  gridLineColor: { Bold: string; Regular: string }, //zsviczian
  gridDirection: { horizontal: boolean; vertical: boolean } = { horizontal: true, vertical: true }, //zsviczian
  gridType: "square" | "isometric" | "triangle" | "perspective" = "square", //zsviczian
) => {
  if (gridType === "isometric") { //zsviczian
    strokeIsometricGrid(context, gridSize, gridStep, scrollX, scrollY, zoom, theme, width, height, gridLineColor); //zsviczian
    return; //zsviczian
  } //zsviczian
  if (gridType === "triangle") { //zsviczian
    strokeTriangleGrid(context, gridSize, gridStep, scrollX, scrollY, zoom, theme, width, height, gridLineColor); //zsviczian
    return; //zsviczian
  } //zsviczian
  if (gridType === "perspective") { //zsviczian
    strokePerspectiveGrid(context, gridSize, gridStep, zoom, theme, width, height, gridLineColor); //zsviczian
    return; //zsviczian
  } //zsviczian
  const bold = //zsviczian
    theme === THEME.DARK
      ? applyDarkModeFilter(gridLineColor.Bold)
      : gridLineColor.Bold;
  const regular = //zsviczian
    theme === THEME.DARK
      ? applyDarkModeFilter(gridLineColor.Regular)
      : gridLineColor.Regular;
  const offsetX = (scrollX % gridSize) - gridSize;
  const offsetY = (scrollY % gridSize) - gridSize;

  const actualGridSize = gridSize * zoom.value;

  const spaceWidth = 1 / zoom.value;

  context.save();

  // Offset rendering by 0.5 to ensure that 1px wide lines are crisp.
  // We only do this when zoomed to 100% because otherwise the offset is
  // fractional, and also visibly offsets the elements.
  // We also do this per-axis, as each axis may already be offset by 0.5.
  if (zoom.value === 1) {
    context.translate(offsetX % 1 ? 0 : 0.5, offsetY % 1 ? 0 : 0.5);
  }

  // vertical lines
  if (gridDirection.vertical) { //zsviczian
    for (let x = offsetX; x < offsetX + width + gridSize * 2; x += gridSize) {
      const isBold =
        gridStep > 1 && Math.round(x - scrollX) % (gridStep * gridSize) === 0;
      // don't render regular lines when zoomed out and they're barely visible
      if (!isBold && actualGridSize < 10) {
        continue;
      }

      const lineWidth = Math.min(1 / zoom.value, isBold ? 4 : 1);
      context.lineWidth = lineWidth;
      const lineDash = [lineWidth * 3, spaceWidth + (lineWidth + spaceWidth)];

      context.beginPath();
      context.setLineDash(isBold ? [] : lineDash);
      context.strokeStyle = isBold ? bold : regular; //zsviczian
      context.moveTo(x, offsetY - gridSize);
      context.lineTo(x, Math.ceil(offsetY + height + gridSize * 2));
      context.stroke();
    }
  }

  if(gridDirection.horizontal) { //zsviczian
    for (let y = offsetY; y < offsetY + height + gridSize * 2; y += gridSize) {
      const isBold =
        gridStep > 1 && Math.round(y - scrollY) % (gridStep * gridSize) === 0;
      if (!isBold && actualGridSize < 10) {
        continue;
      }

      const lineWidth = Math.min(1 / zoom.value, isBold ? 4 : 1);
      context.lineWidth = lineWidth;
      const lineDash = [lineWidth * 3, spaceWidth + (lineWidth + spaceWidth)];

      context.beginPath();
      context.setLineDash(isBold ? [] : lineDash);
      context.strokeStyle = isBold ? bold : regular; //zsviczian
      context.moveTo(offsetX - gridSize, y);
      context.lineTo(Math.ceil(offsetX + width + gridSize * 2), y);
      context.stroke();
    }
  }
  context.restore();
};

export const frameClip = (
  frame: ExcalidrawFrameLikeElement,
  context: CanvasRenderingContext2D,
  renderConfig: StaticCanvasRenderConfig,
  appState: StaticCanvasAppState,
) => {
  context.translate(frame.x + appState.scrollX, frame.y + appState.scrollY);
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(
      0,
      0,
      frame.width,
      frame.height,
      FRAME_STYLE.radius / appState.zoom.value,
    );
  } else {
    context.rect(0, 0, frame.width, frame.height);
  }
  context.clip();
  context.translate(
    -(frame.x + appState.scrollX),
    -(frame.y + appState.scrollY),
  );
};

type LinkIconCanvas = HTMLCanvasElement & { zoom: number, linkOpacity: number }; //zsviczian (linkOpacity)

const linkIconCanvasCache: {
  regularLink: LinkIconCanvas | null;
  elementLink: LinkIconCanvas | null;
} = {
  regularLink: null,
  elementLink: null,
};

const renderLinkIcon = (
  element: NonDeletedExcalidrawElement,
  context: CanvasRenderingContext2D,
  appState: StaticCanvasAppState,
  elementsMap: ElementsMap,
) => {
  if ((element.link || element.hasTextLink) && !appState.selectedElementIds[element.id]) { //zsviczian
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
    const [x, y, width, height] = getLinkHandleFromCoords(
      [x1, y1, x2, y2],
      element.angle,
      appState,
    );
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    context.save();
    context.translate(appState.scrollX + centerX, appState.scrollY + centerY);
    context.rotate(element.angle);

    const canvasKey = !! element.link && isElementLink(element.link) //zsviczian
      ? "elementLink"
      : "regularLink";

    let linkCanvas = linkIconCanvasCache[canvasKey];

    if (
      !linkCanvas ||
      linkCanvas.zoom !== appState.zoom.value || 
      linkCanvas.linkOpacity !== appState.linkOpacity //zsviczian
  ) {
      linkCanvas = Object.assign(document.createElement("canvas"), {
        zoom: appState.zoom.value,
        linkOpacity: appState.linkOpacity, //zsviczian
      });
      linkCanvas.width = width * window.devicePixelRatio * appState.zoom.value;
      linkCanvas.height =
        height * window.devicePixelRatio * appState.zoom.value;
      linkIconCanvasCache[canvasKey] = linkCanvas;

      const linkCanvasCacheContext = linkCanvas.getContext("2d")!;
      linkCanvasCacheContext.scale(
        window.devicePixelRatio * appState.zoom.value,
        window.devicePixelRatio * appState.zoom.value,
      );
      /*linkCanvasCacheContext.fillStyle = appState.viewBackgroundColor || "#fff";
      linkCanvasCacheContext.fillRect(0, 0, width, height);*/ //zsviczian

      linkCanvasCacheContext.globalAlpha = appState.linkOpacity; //zsviczian
      if (canvasKey === "elementLink") {
        linkCanvasCacheContext.drawImage(ELEMENT_LINK_IMG, 0, 0, width, height);
      } else {
        linkCanvasCacheContext.drawImage(
          EXTERNAL_LINK_IMG,
          0,
          0,
          width,
          height,
        );
      }

      linkCanvasCacheContext.restore();
    }
    context.globalAlpha = element.opacity / 100;
    context.drawImage(linkCanvas, x - centerX, y - centerY, width, height);
    context.restore();
  }
};
const _renderStaticScene = ({
  canvas,
  rc,
  elementsMap,
  allElementsMap,
  visibleElements,
  scale,
  appState,
  renderConfig,
}: StaticSceneRenderConfig) => {
  if (canvas === null) {
    return;
  }

  const {
    renderGrid = true,
    isExporting,
    isHighlighterPenDrawing = false,
  } = renderConfig; //zsviczian

  const [normalizedWidth, normalizedHeight] = getNormalizedCanvasDimensions(
    canvas,
    scale,
  );

  const context = bootstrapCanvas({
    canvas,
    scale,
    normalizedWidth,
    normalizedHeight,
    theme: appState.theme,
    isExporting,
    viewBackgroundColor: isHighlighterPenDrawing
      ? "transparent"
      : appState.viewBackgroundColor, //zsviczian
  });

  // Apply zoom
  context.scale(appState.zoom.value, appState.zoom.value);

  // Grid
  if (renderGrid) {
    strokeGrid(
      context,
      appState.gridSize,
      appState.gridStep,
      appState.scrollX,
      appState.scrollY,
      appState.zoom,
      renderConfig.theme,
      normalizedWidth / appState.zoom.value,
      normalizedHeight / appState.zoom.value,
      appState.gridColor, //zsviczian
      appState.gridDirection, //zsviczian
      appState.gridType, //zsviczian
    );
  }

  const groupsToBeAddedToFrame = new Set<string>();

  visibleElements.forEach((element) => {
    if (
      element.groupIds.length > 0 &&
      appState.frameToHighlight &&
      appState.selectedElementIds[element.id] &&
      (elementOverlapsWithFrame(
        element,
        appState.frameToHighlight,
        elementsMap,
      ) ||
        element.groupIds.find((groupId) => groupsToBeAddedToFrame.has(groupId)))
    ) {
      element.groupIds.forEach((groupId) =>
        groupsToBeAddedToFrame.add(groupId),
      );
    }
  });

  const inFrameGroupsMap = new Map<string, boolean>();

  // Paint visible elements
  visibleElements
    .filter((el) => !isIframeLikeElement(el))
    .forEach((element) => {
      try {
        const frameId = element.frameId || appState.frameToHighlight?.id;

        if (
          isTextElement(element) &&
          element.containerId &&
          elementsMap.has(element.containerId)
        ) {
          // will be rendered with the container
          return;
        }

        context.save();

        if (
          frameId &&
          appState.frameRendering.enabled &&
          appState.frameRendering.clip
        ) {
          const frame = getTargetFrame(element, elementsMap, appState);
          if (
            frame &&
            shouldApplyFrameClip(
              element,
              frame,
              appState,
              elementsMap,
              inFrameGroupsMap,
            )
          ) {
            frameClip(frame, context, renderConfig, appState);
          }
          renderElement(
            element,
            elementsMap,
            allElementsMap,
            rc,
            context,
            renderConfig,
            appState,
          );
        } else {
          renderElement(
            element,
            elementsMap,
            allElementsMap,
            rc,
            context,
            renderConfig,
            appState,
          );
        }

        const boundTextElement = getBoundTextElement(element, elementsMap);
        if (boundTextElement) {
          renderElement(
            boundTextElement,
            elementsMap,
            allElementsMap,
            rc,
            context,
            renderConfig,
            appState,
          );
        }

        context.restore();

        if (!isExporting) {
          renderLinkIcon(element, context, appState, elementsMap);
        }
      } catch (error: any) {
        console.error(
          error,
          element.id,
          element.x,
          element.y,
          element.width,
          element.height,
        );
      }
    });

  // render embeddables on top
  visibleElements
    .filter((el) => isIframeLikeElement(el))
    .forEach((element) => {
      try {
        const render = () => {
          renderElement(
            element,
            elementsMap,
            allElementsMap,
            rc,
            context,
            renderConfig,
            appState,
          );

          if (
            isIframeLikeElement(element) &&
            (isExporting ||
              (isEmbeddableElement(element) &&
                renderConfig.embedsValidationStatus.get(element.id) !==
                  true)) &&
            element.width &&
            element.height
          ) {
            const label = createPlaceholderEmbeddableLabel(element);
            renderElement(
              label,
              elementsMap,
              allElementsMap,
              rc,
              context,
              renderConfig,
              appState,
            );
          }
          if (!isExporting) {
            renderLinkIcon(element, context, appState, elementsMap);
          }
        };
        // - when exporting the whole canvas, we DO NOT apply clipping
        // - when we are exporting a particular frame, apply clipping
        //   if the containing frame is not selected, apply clipping
        const frameId = element.frameId || appState.frameToHighlight?.id;

        if (
          frameId &&
          appState.frameRendering.enabled &&
          appState.frameRendering.clip
        ) {
          context.save();

          const frame = getTargetFrame(element, elementsMap, appState);

          if (
            frame &&
            shouldApplyFrameClip(
              element,
              frame,
              appState,
              elementsMap,
              inFrameGroupsMap,
            )
          ) {
            frameClip(frame, context, renderConfig, appState);
          }
          render();
          context.restore();
        } else {
          render();
        }
      } catch (error: any) {
        console.error(error);
      }
    });

  // render pending nodes for flowcharts
  renderConfig.pendingFlowchartNodes?.forEach((element) => {
    try {
      renderElement(
        element,
        elementsMap,
        allElementsMap,
        rc,
        context,
        renderConfig,
        appState,
      );
    } catch (error) {
      console.error(error);
    }
  });
};

/** throttled to animation framerate */
export const renderStaticSceneThrottled = throttleRAF(
  (config: StaticSceneRenderConfig) => {
    _renderStaticScene(config);
  },
);

/**
 * Static scene is the non-ui canvas where we render elements.
 */
export const renderStaticScene = (
  renderConfig: StaticSceneRenderConfig,
  throttle?: boolean,
) => {
  if (throttle) {
    renderStaticSceneThrottled(renderConfig);
    return;
  }

  _renderStaticScene(renderConfig);
};
