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
- "Disable editor" works the same: it turns either editor into the plain text field.

## What is different

- Tiptap edits in the page itself, not in a frame; it follows the page's font size and zoom.
- Typing shortcuts: `**bold**`, `*italic*`, `# ` for a heading, `- ` or `1. ` for a list at the start of a line.
- Paste from Word and web pages is cleaned to what a text field can store.

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
