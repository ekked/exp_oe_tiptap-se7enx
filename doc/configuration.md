# Configuration

All settings of exp_oe_tiptap, and the settings of other files it relies on.

Where to put them:

- the defaults: `extension/exp_oe_tiptap/settings/` (do not edit them on a site);
- per siteaccess: `settings/siteaccess/<siteaccess>/exp_oe_tiptap.ini.append.php`;
- site wide and secrets: `settings/override/exp_oe_tiptap.ini.append.php` (never committed).

After a change: `php bin/php/ezcache.php --clear-tag=ini --allow-root-user`, then reload PHP-FPM or restart
Velocity.

## exp_oe_tiptap.ini

### [EditorSettings]

Which editor a user gets is not set here since 0.1.1: Tiptap is an engine of ezoe's registry and follows ezoe's
settings (see [ezoe.ini](#ezoeini) below). `DefaultEditor` and `AllowSwitch` of 0.1.0 are no longer read.

| Setting | Default | Meaning |
| --- | --- | --- |
| `AssetLoading` | `ezdesign` | `ezdesign`: `<script>`/`<link>` tags pointing at the built files, with no version query; the files are never repacked (a browser that still shows an older build needs a hard reload). `ezjscore`: `ezscript_require()`/`ezcss_require()`, packed with the page by ezjscore (only if ezjscore's packer leaves the modern bundle intact). |
| `Scripts[]` | `exp_oe_tiptap/exp_oe_tiptap.js` | The built scripts, design paths below `javascript/`. The first is the bundle defining `window.ExpOETiptap`; Tiptap counts as available only while that file exists. |
| `Styles[]` | `exp_oe_tiptap/exp_oe_tiptap.css` | The built styles, design paths below `stylesheets/`. |
| `Skin` | (not set) | The look of the editor. Not set or empty: ezoe's `Skin` (o2k7: the look of TinyMCE 3 with ezoe's icon sprite). `a4`: a Tiptap editor in admin4's look: a flat toolbar with Tiptap's own icons (Lucide where Tiptap has none; sources and licenses in `src/icons/`), a bubble menu over selected text, a "+" on empty lines for the insert commands, roomy content typography, colors from admin4's `--a4-*` tokens (light and dark), and every dialog as an admin4 card (label above field, hint below, primary button on the right, the whole width on a phone; Escape closes it and the focus returns to the text). Set it per siteaccess (`settings/siteaccess/<siteaccess>/exp_oe_tiptap.ini.append.php`); the extension leaves it undefined, because its own settings are read after a siteaccess's and would hide that choice. |
| `MinHeight` | `300` | Minimum height of the editing area in pixels. The class attribute's "number of text rows" can make it taller. |
| `ContextMenu` | `enabled` | The editor's context menu: a right click, the context menu key or Shift+F10 opens a menu with the commands for what is at the cursor (link, anchor, embed, custom tag, literal, table, row, cell, tag properties). Ctrl+right click or a second right click open the browser's own menu. `disabled`: always the browser's menu. |
| `SourceEditable` | (not set: `enabled`) | The source view (button `code`): `enabled` lets the HTML be changed and applied (see the button `code` below), `disabled` shows it read only. Left undefined by the extension, like `Skin`, so that a siteaccess's value counts; set it in `settings/siteaccess/<siteaccess>/exp_oe_tiptap.ini.append.php` or `settings/override/`. |

### [AISettings]

Read by the server function `expoetiptap::ai`; see [ai-hooks.md](ai-hooks.md) for the provider details.

| Setting | Default | Meaning |
| --- | --- | --- |
| `Enabled` | `false` | `true` offers the AI commands to users with the policy `exp_oe_tiptap/ai`. |
| `Provider` | `openai-compatible` | `openai-compatible` (OpenAI chat completions API: OpenAI, Azure OpenAI, Mistral, Ollama, vLLM ...), `anthropic` (Anthropic Messages API), `expai` (the models and rules of the extension expai, see [ai-hooks.md](ai-hooks.md#through-expai)), `custom` (`ProviderClass`), `tiptap-cloud` (Tiptap's hosted service). |
| `Endpoint` | empty | The provider's API URL: https; plain http only to a loopback host (`127.0.0.0/8`, `::1`, `localhost`). |
| `Model` | empty | The model name the provider expects. |
| `ExpaiModel` | empty | `Provider=expai` only: the expai model; empty: the model expai uses for the user. |
| `ApiKey` | empty | The API key. **Only in settings/override.** Never sent to the browser. |
| `Timeout` | `30` | Seconds to wait for the provider. |
| `MaxInputLength` | `20000` | Longest text in characters a command may send. |
| `MaxOutputTokens` | `2000` | Longest answer a command may ask for. |
| `Commands[]` | improve, shorten, extend, fix_spelling, translate, summarise, continue | The commands offered, in this order. |

## ezoe.ini

The choice of editor is ezoe's. The extension's `settings/ezoe.ini.append.php` sets:

| Setting | Value | Meaning |
| --- | --- | --- |
| `[EditorSettings] Engines[tiptap]` | `expOETiptapEngine` | Registers Tiptap as an engine. ezoe lists it on `/ezoe/engine` with name, version (the extension's), description and status, offers it in the select and in the switch buttons, and falls back to TinyMCE 3 whenever it is not available (the bundle `Scripts[]` is missing). An override must never start `Engines[]` empty without listing `tiptap` again. |
| `[EditorSettings] EngineSwitch` | `enabled` | The "Switch to the editor ..." buttons below every text field, one per other available engine. `disabled` hides them; `/ezoe/engine` still works. |

ezoe's own settings decide the rest:

| Setting | Default | Meaning |
| --- | --- | --- |
| `[EditorSettings] EditorEngine` | `tinymce3` | The engine of users without a choice of their own. `tiptap` makes Tiptap the default, per siteaccess. An engine that is not available means `tinymce3`. |
| `[Engine_tiptap]` | none | Read by ezoe's engine base class for `ToolbarMap[]`, `ExternalPlugins[]`, `Scripts[]`, `Styles[]`; Tiptap uses none of them (its own assets are `exp_oe_tiptap.ini [EditorSettings] Scripts[]`, `Styles[]`, and its toolbar follows `[EditorLayout] Buttons[]`). |

## Other files exp_oe_tiptap ships

| File | Setting | Why |
| --- | --- | --- |
| `ezxml.ini` | `[InputSettings] AliasClasses[eZSimplifiedXMLInput]=expOETiptapXMLInput` | Makes the extension's input handler (ezoe's, plus the migration of the 0.1.0 preference and the 0.1.0 switch action) the one ezxmltext uses; Tiptap works as an ezoe engine without it too. Wins over ezoe's alias because extension.xml declares `<extends>ezoe`, which makes the settings load after ezoe's in any `ActiveExtensions` order. |
| `design.ini` | `[ExtensionSettings] DesignExtensions[]=exp_oe_tiptap` | The templates, scripts and styles. |
| `module.ini` | `ModuleList[]=exp_oe_tiptap` | The view `exp_oe_tiptap/switch` of 0.1.0 (stores ezoe's choice) and the policy functions `switch`, `ai`. |
| `site.ini` | `TranslationExtensions[]=exp_oe_tiptap`, `ModuleViewAccessMode[exp_oe_tiptap/*]=keep` | Translations (context `extension/exp_oe_tiptap`); no SSL zone change. |
| `ezjscore.ini` | `[ezjscServer_expoetiptap] Class=expOETiptapServerFunctions` | The AI server function `ezjscore/call/expoetiptap::ai`. |

## Settings of ezoe that Tiptap follows

Tiptap reads the same settings as ezoe, so one configuration serves both editors:

| File | Setting | Used for |
| --- | --- | --- |
| `ezoe.ini` | `[EditorLayout] Buttons[]` (and its siteaccess/class variants, through `editor_layout_settings`) | which toolbar buttons exist, in which order; besides ezoe's names Tiptap knows the buttons [below](#toolbar-buttons-beyond-ezoes-defaults) |
| `ezoe.ini` | `[EditorLayout] PathLocation`, `ToolbarLocation` | status bar and toolbar position |
| `ezoe.ini` | `[EditorSettings] Skin`, `CustomAttributeStyleMap`, `UploadFileExtensions[]`, `UploadFromUrl` | skin class, custom attribute styles, upload rules |
| `ezoe.ini` | `[EditorSettings] TagPathOpenDialog` | `enabled` (ezoe's default): a click on a tag of the status bar path also opens its dialog (link, anchor, table, cell, custom tag, embed, literal) |
| `ezoe.ini` | `[EditorSettings] CustomTagControls` (Exponential 6.0.15 and later) | `enabled`: the bar on the focused custom tag (move up, move down, edit, remove; Alt+Shift+Up / Down / E / Delete), Backspace removing an empty block custom tag, and a label with the name of every block custom tag |
| `content.ini` | `[CustomTagSettings]`, `[paragraph]`, `[link]`, `[table]`, `[embed]`, `[embed-inline]`, ... `AvailableClasses`, `CustomAttributes`, `AvailableViewModes` | classes, custom attributes, custom tags, view modes |
| `content.ini` | `[CustomTagSettings] IsHidden[]` (Exponential 6.0.15 and later) | custom tags the custom tag dialog does not offer for a new tag; a hidden tag already in the text can still be edited |
| `ezoe_attributes.ini` | everything | types and titles of custom attributes in the dialogs (the title is shown as a hint below the field; names Tiptap knows, such as ezoe's example `Summary (WAI)`, are translated) |
| `design.ini` | `[StylesheetSettings] EditorCSSFileList[]` | the content CSS of the editing area |
| `image.ini` | `[AliasSettings] AliasList[]` | image sizes of embeds |

## Toolbar buttons beyond ezoe's defaults

ezoe's default `[EditorLayout] Buttons[]` does not list these; a site adds them where it wants them (in a
siteaccess's `ezoe.ini.append.php`, e.g. `Buttons[]=tag_props`). Without the button the function stays reachable as
noted.

| Button | Function | Also reachable |
| --- | --- | --- |
| `tag_props` | Tag properties: class and custom attributes of the paragraph, header, list, list item, strong or emphasize at the cursor (ezoe's `tag_general.tpl`, `tag_header.tpl`), from content.ini `[<tag>] AvailableClasses[]`, `ClassDescription[]`, `CustomAttributes[]` and ezoe_attributes.ini. Inside several of them the dialog lists them, innermost first. | a click on the tag in the status bar path (`TagPathOpenDialog=enabled`) |
| `row_props` | Table row properties: class and custom attributes of the row at the cursor (content.ini `[tr]`), like ezoe's row dialog. TinyMCE 3's name and icon. | a click on `tr` in the status bar path |
| `pastetext` | Paste as text, a switch as in TinyMCE 3: while it is on, every paste is plain text. Pasted HTML is always cleaned (Word, Google Docs, web pages); ezoe's `pasteword` dialog is not needed and not offered. | Ctrl+Shift+V (the next paste only) |
| `search`, `replace` | Find and replace (TinyMCE 3's names and icons): a bar under the toolbar; `replace` puts the focus into the replace field. | Ctrl+F in the text |
| `code` | Source (TinyMCE 3's name and icon): the HTML of the editor (ezoe's dialect, what the form posts), one block per line, with a copy button. The ezxmltext XML is made by the server when the form is stored and is not shown (making it in the browser would need the parser, which registers link URLs in the database). Editable unless `[EditorSettings] SourceEditable=disabled`: **Apply** parses the HTML in an inert document, cleans it as pasted HTML (no scripts, styles, frames, SVG, event handlers; links only relative, http(s), mailto, tel, ftp, eznode, ezobject), lets the schema read it, lists what the schema drops (elements, attributes, style declarations, text; not white space or the order of attributes) and asks **Apply anyway** first; one Undo takes it back. Tab indents, Ctrl+M makes Tab move the focus, Escape cancels (unapplied changes: the first Escape or Cancel asks). | |
| `nonbreaking` | Insert a non-breaking space (TinyMCE 3's name and icon); ezxmltext keeps it as the character U+00A0. | Ctrl+Shift+Space |

ezoe's `ltr` and `rtl` (text direction) are not offered: ezxmltext has no attribute for the direction of a paragraph,
so `eZOEInputParser` would drop it on saving. ezoe's `pasteword` is not needed: every paste is cleaned. The buttons
of the spell checkers (`spellchecker`, `AtD`) and `visualchars`, `emotions`, `tablemenu` have no counterpart.

## Preferences

| Preference | Values | Set by |
| --- | --- | --- |
| `ezoe_engine` (ezoe's) | `tinymce3`, `tinymce8`, `tiptap`, empty (= site default) | `/ezoe/engine`, the "Switch to the editor ..." buttons, the 0.1.0 switch button and `exp_oe_tiptap/switch` |
| `exp_oe_editor` (0.1.0) | `ezoe`, `tiptap` | no longer set. Read once per user and moved to `ezoe_engine` (`tiptap` stays Tiptap), then emptied: by the edit form, or for all users by `bin/php/migrate_editor_preference.php`. |
