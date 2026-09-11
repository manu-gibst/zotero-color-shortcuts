// Tool types that carry a persistent color (from reader/src/common/types.d.ts
// InternalReaderTools) - pointer/hand/eraser have no color to set.
const COLORABLE_TOOLS = [
  "highlight",
  "underline",
  "note",
  "image",
  "text",
  "ink",
];

// Matches Zotero's own default annotation color palette/order (see
// chrome/content/zotero/xpcom/annotations.js: this.DEFAULT_COLORS), so key
// `1` produces the same yellow shown in Zotero's own color swatches, etc.
const HIGHLIGHT_COLORS = [
  "#ffd400", // 1 - yellow
  "#ff6666", // 2 - red
  "#5fb236", // 3 - green
  "#2ea8e5", // 4 - blue
  "#a28ae5", // 5 - purple
  "#e56eee", // 6 - magenta
  "#f19837", // 7 - orange
  "#aaaaaa", // 8 - gray
];

export class ColorShortcutFactory {
  static registerShortcuts() {
    ztoolkit.Keyboard.register((event, { type }) => {
      if (type !== "keyup") return;
      if (!event.shiftKey) return;
      // toolkit's KeyModifier matches on event.key, but Shift+digit
      // produces a shifted symbol (Shift+1 -> "!") on most layouts, not
      // the digit itself - so match on event.code ("Digit1".."Digit8"),
      // which stays stable regardless of Shift state or keyboard layout.
      const accelHeld = Zotero.isMac ? event.metaKey : event.ctrlKey;
      if (!accelHeld) return;
      const match = /^Digit([1-8])$/.exec(event.code);
      if (!match) return;
      const colorIndex = Number(match[1]) - 1;
      event.preventDefault();
      void ColorShortcutFactory.applyHighlightColor(colorIndex);
    });
  }

  private static async applyHighlightColor(colorIndex: number) {
    try {
      const Zotero_Tabs = ztoolkit.getGlobal("Zotero_Tabs");
      if (Zotero_Tabs.selectedType !== "reader") return;

      const reader = await ztoolkit.Reader.getReader();
      if (!reader) return;

      const color = HIGHLIGHT_COLORS[colorIndex];

      // An existing annotation (highlight/underline/etc.) is currently
      // selected in the reader (clicked, not freshly drawn) - recolor it
      // in place. The reader's selectedAnnotationIDs are the annotation
      // items' `key` (see reader.js _getAnnotation: json.id = item.key),
      // so this is a plain Zotero.Item update; Zotero's own notifier
      // system refreshes the reader's display automatically afterward.
      const selectedIDs =
        reader._internalReader?._state?.selectedAnnotationIDs || [];
      if (selectedIDs.length) {
        let recolored = 0;
        for (const key of selectedIDs) {
          const item = Zotero.Items.getByLibraryAndKey(
            reader._item.libraryID,
            key,
          ) as Zotero.Item | false;
          if (item && item.isAnnotation()) {
            item.annotationColor = color;
            await item.saveTx();
            recolored++;
          }
        }
        if (recolored) return;
      }

      // Next, fall back to creating a new highlight from a live text
      // selection.
      const selection = ztoolkit.Reader.getSelectedAnnotationData(reader);
      if (selection) {
        await Zotero.Annotations.saveFromJSON(
          reader._item,
          {
            ...selection,
            key: Zotero.Utilities.generateObjectKey(),
            type: "highlight",
            color,
          } as _ZoteroTypes.Annotations.AnnotationJson,
          {},
        );
        return;
      }

      // Otherwise, nothing is selected at all - set the color of
      // whichever annotation tool is currently active, so the next thing
      // drawn with it (by mouse) uses this color.
      //
      // Not using the public setTool() here: when the requested type
      // matches the already-active tool, reader.js's setTool() (see
      // zotero/reader src/common/reader.js:886-901) mutates
      // this._state.tool IN PLACE, then _updateState() (line 648) only
      // re-renders the view when `this._state.tool !== previousState.tool`
      // - a reference check that a same-object mutation always fails, so
      // the color silently never reaches the visible toolbar/cursor. We
      // work around it by mutating the persistent per-type tool entry
      // (so switching tools later still remembers this color) and handing
      // _updateState a freshly-spread object so the reference actually
      // changes. Both are private/untyped in zotero-types, confirmed
      // directly against the zotero/reader source above.
      const internalReader = reader._internalReader as unknown as {
        toolType?: string;
        _tools?: Record<string, { type: string; color?: string }>;
        _state: { tool: { type: string; color?: string } };
        _updateState: (state: {
          tool: { type: string; color?: string };
        }) => void;
      };
      const toolType = internalReader?.toolType;
      if (toolType && COLORABLE_TOOLS.includes(toolType)) {
        const persistentTool = internalReader._tools?.[toolType];
        if (persistentTool) persistentTool.color = color;
        internalReader._updateState({
          tool: { ...(persistentTool ?? internalReader._state.tool), color },
        });
      }
    } catch (e) {
      ztoolkit.log("[colorShortcuts] error applying color", e);
    }
  }
}
