import { KEYS, CODES, isDarwin } from "@excalidraw/common";

import {
  moveOneLeft,
  moveOneRight,
  moveAllLeft,
  moveAllRight,
  moveToIndex, //zsviczian
  getSelectedElements, //zsviczian
} from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/element";

import {
  BringForwardIcon,
  BringToFrontIcon,
  SendBackwardIcon,
  SendToBackIcon,
} from "../components/icons";
import { t } from "../i18n";
import { getShortcutKey } from "../shortcut";

import { register } from "./register";

export const actionSendBackward = register({
  name: "sendBackward",
  label: "labels.sendBackward",
  keywords: ["move down", "zindex", "layer"],
  icon: SendBackwardIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState, value, app) => {
    return {
      elements: moveOneLeft(elements, appState, app.scene),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyPriority: 40,
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    !event.shiftKey &&
    event.code === CODES.BRACKET_LEFT,
  PanelComponent: ({ updateData, appState }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={() => updateData(null)}
      title={`${t("labels.sendBackward")} — ${getShortcutKey("CtrlOrCmd+[")}`}
    >
      {SendBackwardIcon}
    </button>
  ),
});

export const actionBringForward = register({
  name: "bringForward",
  label: "labels.bringForward",
  keywords: ["move up", "zindex", "layer"],
  icon: BringForwardIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState, value, app) => {
    return {
      elements: moveOneRight(elements, appState, app.scene),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyPriority: 40,
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    !event.shiftKey &&
    event.code === CODES.BRACKET_RIGHT,
  PanelComponent: ({ updateData, appState }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={() => updateData(null)}
      title={`${t("labels.bringForward")} — ${getShortcutKey("CtrlOrCmd+]")}`}
    >
      {BringForwardIcon}
    </button>
  ),
});

export const actionSendToBack = register({
  name: "sendToBack",
  label: "labels.sendToBack",
  keywords: ["move down", "zindex", "layer"],
  icon: SendToBackIcon,
  trackEvent: { category: "element" },
  perform: (elements, appState) => {
    return {
      elements: moveAllLeft(elements, appState),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    isDarwin
      ? event[KEYS.CTRL_OR_CMD] &&
        event.altKey &&
        event.code === CODES.BRACKET_LEFT
      : event[KEYS.CTRL_OR_CMD] &&
        event.shiftKey &&
        event.code === CODES.BRACKET_LEFT,
  PanelComponent: ({ updateData, appState }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={() => updateData(null)}
      title={`${t("labels.sendToBack")} — ${
        isDarwin
          ? getShortcutKey("CtrlOrCmd+Alt+[")
          : getShortcutKey("CtrlOrCmd+Shift+[")
      }`}
    >
      {SendToBackIcon}
    </button>
  ),
});

export const actionBringToFront = register({
  name: "bringToFront",
  label: "labels.bringToFront",
  keywords: ["move up", "zindex", "layer"],
  icon: BringToFrontIcon,
  trackEvent: { category: "element" },

  perform: (elements, appState) => {
    return {
      elements: moveAllRight(elements, appState),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event) =>
    isDarwin
      ? event[KEYS.CTRL_OR_CMD] &&
        event.altKey &&
        event.code === CODES.BRACKET_RIGHT
      : event[KEYS.CTRL_OR_CMD] &&
        event.shiftKey &&
        event.code === CODES.BRACKET_RIGHT,
  PanelComponent: ({ updateData, appState }) => (
    <button
      type="button"
      className="zIndexButton"
      onClick={(event) => updateData(null)}
      title={`${t("labels.bringToFront")} — ${
        isDarwin
          ? getShortcutKey("CtrlOrCmd+Alt+]")
          : getShortcutKey("CtrlOrCmd+Shift+]")
      }`}
    >
      {BringToFrontIcon}
    </button>
  ),
});

export const actionSetLayer = register({ //zsviczian
  name: "setLayer", //zsviczian
  label: "labels.setLayer", //zsviczian
  keywords: ["zindex", "layer", "position"], //zsviczian
  trackEvent: { category: "element" }, //zsviczian
  perform: (elements, appState, value) => { //zsviczian
    if (value == null) return false; //zsviczian
    return { //zsviczian
      elements: moveToIndex(elements, appState, (value as number) - 1), //zsviczian
      appState, //zsviczian
      captureUpdate: CaptureUpdateAction.IMMEDIATELY, //zsviczian
    }; //zsviczian
  }, //zsviczian
  PanelComponent: ({ updateData, appState, elements }) => { //zsviczian
    const selectedElements = getSelectedElements(elements, appState); //zsviczian
    if (!selectedElements.length) return null; //zsviczian
    const minIndex = Math.min( //zsviczian
      ...selectedElements.map((el) => elements.indexOf(el)), //zsviczian
    ); //zsviczian
    const currentLayer = minIndex + 1; //zsviczian
    const totalLayers = elements.length; //zsviczian
    return ( //zsviczian
      <label //zsviczian
        className="zIndexLayerInput" //zsviczian
        title={t("labels.setLayer")} //zsviczian
      >
        {/* //zsviczian */}
        <input //zsviczian
          type="number" //zsviczian
          min={1} //zsviczian
          max={totalLayers} //zsviczian
          value={currentLayer} //zsviczian
          onChange={(e) => { //zsviczian
            const v = parseInt(e.target.value, 10); //zsviczian
            if (!isNaN(v)) updateData(v); //zsviczian
          }} //zsviczian
        />
        {/* //zsviczian */}
        <span>/{totalLayers}</span> {/* //zsviczian */}
      </label> //zsviczian
    ); //zsviczian
  }, //zsviczian
}); //zsviczian
