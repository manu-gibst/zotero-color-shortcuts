import { assert } from "chai";

// Validates the one inferred-not-verbatim-confirmed call in the design:
// Zotero.Annotations.saveFromJSON, called from a plugin (not from Zotero's
// own reader.js), with ReaderTool.getSelectedAnnotationData()-shaped input
// and an overridden color. Does not simulate an actual pdf.js text
// selection - that machinery belongs to Zotero itself and is out of this
// plugin's control - so a lightweight linked-URL attachment stands in for
// a real PDF attachment; saveFromJSON never touches the underlying file.
describe("colorShortcuts: Zotero.Annotations.saveFromJSON", function () {
  let attachment: Zotero.Item;

  before(async function () {
    try {
      const parent = new Zotero.Item("journalArticle");
      parent.libraryID = Zotero.Libraries.userLibraryID;
      parent.setField("title", "Color Shortcuts Test Item");
      await parent.saveTx();

      // saveFromJSON requires a real file attachment (isFileAttachment()
      // is false for LINK_MODE_LINKED_URL) with a PDF/EPUB/HTML content
      // type, matching what the reader actually opens - so import a
      // throwaway local file as a stand-in "PDF" rather than link a URL.
      const tmpPath = PathUtils.join(
        PathUtils.tempDir,
        `color-shortcuts-test-${Zotero.Utilities.generateObjectKey()}.pdf`,
      );
      await IOUtils.writeUTF8(tmpPath, "%PDF-1.4 dummy test file");

      attachment = await Zotero.Attachments.importFromFile({
        file: tmpPath,
        parentItemID: parent.id,
        title: "Test PDF",
        contentType: "application/pdf",
      });
    } catch (e: any) {
      assert.fail(
        `before() failed: ${e?.message} | ${e?.stack} | ${String(e)}`,
      );
    }
  });

  it("creates a highlight annotation with the requested color", async function () {
    try {
      const selectionData = {
        pageLabel: "1",
        position: { pageIndex: 0, rects: [[0, 0, 10, 10]] },
        sortIndex: "00000|000000|00000",
        text: "hello world",
        type: "highlight" as const,
      };

      const item = await Zotero.Annotations.saveFromJSON(
        attachment,
        {
          ...selectionData,
          key: Zotero.Utilities.generateObjectKey(),
          type: "highlight",
          color: "#5fb236",
        } as _ZoteroTypes.Annotations.AnnotationJson,
        {},
      );

      assert.equal(item.annotationType, "highlight");
      assert.equal(item.annotationColor, "#5fb236");
      assert.equal(item.annotationText, "hello world");
      assert.equal(item.parentID, attachment.id);
    } catch (e: any) {
      assert.fail(`it() failed: ${e?.message} | ${e?.stack} | ${String(e)}`);
    }
  });
});
