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
    ztoolkit.Keyboard.register((event, { keyboard, type }) => {
      if (type !== "keyup" || !keyboard) return;
      const colorIndex = HIGHLIGHT_COLORS.findIndex((_, i) =>
        keyboard.equals(`accel,shift,${i + 1}`),
      );
      if (colorIndex === -1) return;
      event.preventDefault();
      void ColorShortcutFactory.applyHighlightColor(colorIndex);
    });
  }

  private static async applyHighlightColor(colorIndex: number) {
    const Zotero_Tabs = ztoolkit.getGlobal("Zotero_Tabs");
    if (Zotero_Tabs.selectedType !== "reader") return;

    const reader = await ztoolkit.Reader.getReader();
    if (!reader) return;

    const selection = ztoolkit.Reader.getSelectedAnnotationData(reader);
    if (!selection) return;

    await Zotero.Annotations.saveFromJSON(
      reader._item,
      {
        ...selection,
        key: Zotero.Utilities.generateObjectKey(),
        type: "highlight",
        color: HIGHLIGHT_COLORS[colorIndex],
      } as _ZoteroTypes.Annotations.AnnotationJson,
      {},
    );
  }
}
