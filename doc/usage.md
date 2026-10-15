# Using the Tiptap editor

For editors. What is different from the Online Editor's TinyMCE, and how to choose and switch.

## Which editor you get

Every text field (ezxmltext) is edited with the Online Editor (ezoe), which offers several editors, its "engines":

- **TinyMCE 3**, the editor Exponential has always had;
- **TinyMCE 8**, where the site offers it;
- **Tiptap**, the new one.

The site decides which one you start with. You can choose your own, and your choice is remembered for your user
on every text field and every visit, until you choose again. There is one choice for all of them: it does not
matter whether you make it on the page or with a button below a text field.

## Choosing on the page

`/ezoe/engine` (in the admin: add it to the URL, e.g. `/admin/ezoe/engine`) lists every editor with its version,
a short description and its status ("Available", "Available, in use now", or why it cannot be used). Below the
table, choose "Default of this site (...)" or one of the editors and press **Save**.

## Switching in the edit form

Below the text field there is a button for each other editor, e.g.:

- with TinyMCE: **Switch to the editor Tiptap**;
- with Tiptap: **Switch to the editor TinyMCE 3** (and TinyMCE 8 where the site has it); Tiptap's toolbar has the
  same action, and the text next to the buttons says "Editing with Tiptap".

Since Exponential 6.0.15 ezoe shows the switch as one control named **Editor** with every editor of the site, e.g.
"Tiptap | TinyMCE 3 | TinyMCE 8": the editor in use is marked, a click on another one switches. That control names
the editor in use itself, so "Editing with Tiptap" is not shown next to it (with an older ezoe it still is).

When you press one, the whole form is stored as a draft first, exactly as when you press "Disable editor", and the
form comes back with the other editor. Nothing you typed is lost, in any field. Nothing is published.

The buttons are not there when the site has switched them off (`ezoe.ini [EditorSettings] EngineSwitch=disabled`);
the page `/ezoe/engine` still works then. Tiptap is not offered at all while it is not installed completely on the
site; the page says so in its status column.

## What is the same

- The text is stored the same way. A page saved from Tiptap looks the same on the site as one saved from the
  Online Editor.
- Everything the Online Editor can do, Tiptap can do: headings, bold, italic, underline, sub- and superscript,
  links (with their class, view and target), anchors, lists, tables (with their classes and sizes), literal
  blocks, embedded images, objects and files (block and inline), custom tags such as factboxes, and the classes
  and custom attributes of each.
- The dialogs for links, embedding (with the object browser and upload), custom tags, tables, table cells (with
  the cell type, data or header cell) and literal text (when content.ini gives literal classes or attributes) are
  the same dialogs as in the Online Editor.
- Classes and custom attributes of paragraphs, headings, lists, list items, bold and italic text: click the tag in
  the path below the text (e.g. `paragraph` or `li`), or use the toolbar's **Tag properties** where the site has
  it. Where the cursor is inside several of them, choose the element in the dialog.
- Classes and custom attributes of a table row: click `tr` in the path, or the toolbar's **Table row properties**.
- The table cell dialog applies to the cell, its row, its column or all cells of the table (**Apply to**), and to the
  selected cells when several are selected (Shift+click or drag across cells). A merged cell belongs to every row
  and column it covers; the cell type changes only where you change it in the dialog.
- "Disable editor" works the same: it turns either editor into the plain text field.

## What is different

- Tiptap edits in the page itself, not in a frame; it follows the page's font size and zoom.
- Typing shortcuts: `**bold**`, `*italic*`, `# ` for a heading, `- ` or `1. ` for a list at the start of a line.
- Paste from Word, Google Docs and web pages is cleaned to what a text field can store: paragraphs, headings, lists
  (Word's bulleted and numbered paragraphs become real lists), tables, links, bold, italic, underline, sub- and
  superscript. Fonts, colors, Word's comments, header and footer, bookmarks and images of the clipboard are left out;
  the text of everything else stays. Text copied inside the editor keeps everything (embeds, custom tags, classes).
- **Non-breaking space**: Ctrl+Shift+Space (or the toolbar button where the site has it) keeps two words on one
  line, e.g. a number and its unit.
- **Context menu**: a right click into the text, the context menu key or Shift+F10 shows the commands for what is
  at the cursor: edit or remove a link, edit an anchor, an embedded object or a custom tag, the table, row and cell
  properties, insert and delete rows and columns, merge and split cells, and the tag properties. The arrow keys move
  through it, Enter runs a command, Escape closes it. For the browser's own menu (spelling suggestions, copy as ...)
  hold Ctrl while right-clicking, or right-click a second time.
- **Find and replace**: Ctrl+F in the text (or the toolbar's search buttons, where the site has them) opens a bar
  under the toolbar with the selected word. The matches are marked, the number is shown; Enter and Shift+Enter (or
  F3 and Shift+F3) go to the next and previous one, **Match case** distinguishes upper and lower case. **Replace**
  replaces the marked match, **Replace all** every one at once (one Undo takes it back). Escape closes the bar. Ctrl+F
  outside the text is the browser's search as always.
- **Paste as text**: Ctrl+Shift+V pastes only the text, once; the toolbar's **Paste as text** (where the site has it)
  switches it on until you switch it off. A blank line starts a new paragraph, a single line break stays a line
  break.

## Source

Where the site has the toolbar's **Source** button, it shows the text as the HTML of the editor, the HTML it sends
with the form (the server turns it into the stored ezxmltext XML when the form is stored), one block per line, with a
**Copy** button.

Unless the site has made it read only (`SourceEditable=disabled`), you can change the HTML there:

- **Tab** indents the line (or the selected lines), **Shift+Tab** outdents. **Ctrl+M** makes Tab move the focus out
  of the field instead (and back); **Escape** cancels (with changes not yet applied, the first Escape or
  **Cancel** asks, the second discards them). **Wrap lines** switches line wrapping on and off.
- **Apply** puts the HTML into the editor. It is cleaned as pasted HTML: scripts, styles, frames, event handlers and
  unsafe links go. If the editor cannot keep all of it (a `<span style>`, a `<div>` that becomes a paragraph, an
  unknown attribute), the dialog lists what changes and **Apply anyway** takes it as listed; change the HTML and
  Apply asks again. White space and the order of attributes are no change.
- One **Undo** (Ctrl+Z) takes the whole change back. **Cancel** leaves the text as it was.

## Help

The toolbar's **Help** (Alt+0) describes every button of this toolbar, the keyboard shortcuts, the tags a text field
stores and how the editor shows them, and a few tips.

## AI commands

If the site has them switched on and your role has the policy `exp_oe_tiptap/ai`, Tiptap's toolbar has an **AI**
menu: improve writing, make shorter, make longer, fix spelling and grammar, translate, summarize, continue
writing. Select text (or place the cursor, for "continue"), choose a command, and the result is shown as a
suggestion: **Accept** puts it into the text, **Reject** leaves the text as it was. The assistant only changes the
wording: images, embedded objects, tables, custom tags, anchors, links and formatting stay where they are (they show
as small chips in the suggestion). If an answer loses one, the panel warns and **Insert below** or **Keep original**
keep your text safe. Text inside a table or a custom tag box is changed only when you select it. The text you select is sent
to the AI provider the site has chosen; do not use it on confidential content unless your organisation allows
it. More: [ai-hooks.md](ai-hooks.md).

## When something looks wrong

Switch back to TinyMCE: the text is the same, so you lose nothing. Tell the site administrator which
content and what you saw; [maintenance.md](maintenance.md#troubleshooting) is their checklist.
