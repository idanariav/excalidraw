import { getStroke, type StrokeOptions } from "perfect-freehand";

import easingsFunctions from "./easingFunctions";

import type { ExcalidrawFreeDrawElement } from "./types";

const med = (a: number[], b: number[]) => [
  (a[0] + b[0]) / 2,
  (a[1] + b[1]) / 2,
];

// Multi-pass moving average to remove hand jitter from freedraw points. //zsviczian
// Pins first/last points so the stroke start/end are preserved. //zsviczian
// roughness 0 = no smoothing; 1 = light (3 passes, r=2); 2 = heavy (10 passes, r=4). //zsviczian
const smoothFreeDrawPoints = ( //zsviczian
  points: readonly [number, number][], //zsviczian
  roughness: number, //zsviczian
): [number, number][] => { //zsviczian
  if (roughness === 0 || points.length < 3) return [...points] as [number, number][]; //zsviczian
  const passes = roughness === 1 ? 3 : 10; //zsviczian
  const radius = roughness === 1 ? 2 : 4; //zsviczian
  let result = [...points] as [number, number][]; //zsviczian
  for (let pass = 0; pass < passes; pass++) { //zsviczian
    const smoothed = [...result] as [number, number][]; //zsviczian
    for (let i = 1; i < result.length - 1; i++) { //zsviczian
      const start = Math.max(1, i - radius); //zsviczian
      const end = Math.min(result.length - 2, i + radius); //zsviczian
      let x = 0, y = 0, count = 0; //zsviczian
      for (let j = start; j <= end; j++) { //zsviczian
        x += result[j][0]; y += result[j][1]; count++; //zsviczian
      } //zsviczian
      smoothed[i] = [x / count, y / count]; //zsviczian
    } //zsviczian
    result = smoothed; //zsviczian
  } //zsviczian
  return result; //zsviczian
}; //zsviczian
const TO_FIXED_PRECISION = /(\s?[A-Z]?,?-?[0-9]*\.[0-9]{0,2})(([0-9]|e|-)*)/g;

export const getFreedrawOutlinePoints = (
  element: ExcalidrawFreeDrawElement,
): [number, number][] => {
  const smoothedPoints = smoothFreeDrawPoints(element.points, element.roughness); //zsviczian
  const inputPoints = element.simulatePressure //zsviczian
    ? smoothedPoints //zsviczian
    : smoothedPoints.length //zsviczian
    ? smoothedPoints.map(([x, y], i) => [x, y, element.pressures[i]]) //zsviczian
    : [[0, 0, 0.5]];

  const customOptions = element.customData?.strokeOptions?.options;
  const options: StrokeOptions = customOptions
    ? {
        ...customOptions,
        simulatePressure:
          customOptions.simulatePressure ?? element.simulatePressure,
        size: element.strokeWidth * 4.25,
        last: true,
        easing: easingsFunctions[customOptions.easing] ?? ((t) => t),
        ...(customOptions.start?.easing
          ? {
              start: {
                ...customOptions.start,
                easing:
                  easingsFunctions[customOptions.start.easing] ?? ((t) => t),
              },
            }
          : { start: customOptions.start }),
        ...(customOptions.end?.easing
          ? {
              end: {
                ...customOptions.end,
                easing:
                  easingsFunctions[customOptions.end.easing] ?? ((t) => t),
              },
            }
          : { end: customOptions.end }),
      }
    : {
        simulatePressure: element.simulatePressure,
        size: element.strokeWidth * 4.25,
        thinning: 0.6,
        smoothing: 0.5,
        streamline: 0.5, //zsviczian
        easing: easingsFunctions.easeOutSine,
        last: true,
      };

  return getStroke(inputPoints as number[][], options) as [number, number][];
};

export const getSvgPathFromStroke = (points: number[][]): string => {
  if (!points.length) {
    return "";
  }
  const max = points.length - 1;
  return points
    .reduce(
      (acc, point, i, arr) => {
        if (i === max) {
          acc.push(point, med(point, arr[0]), "L", arr[0], "Z");
        } else {
          acc.push(point, med(point, arr[i + 1]));
        }
        return acc;
      },
      ["M", points[0], "Q"],
    )
    .join(" ")
    .replace(TO_FIXED_PRECISION, "$1");
};

export const getFreeDrawSvgPath = (
  element: ExcalidrawFreeDrawElement,
): string => getSvgPathFromStroke(getFreedrawOutlinePoints(element));
