# Architecture

## The idea

ezoe has two halves around its editor: `eZOEXMLInput::inputXML()` turns stored ezxml into an HTML dialect, and
`eZOEInputParser` turns that dialect back into ezxml when the form is posted. Both are mature and handle every tag,
attribute and quirk the content has. exp_oe_tiptap keeps both halves and replaces only the editor between them.
Tiptap is configured with a schema that is the ezoe dialect, so it reads exactly what TinyMCE reads and writes
exactly what TinyMCE writes.

```
 stored ezxml
     |
     |  eZOEXMLInput::inputXML()                                   ezoe, unchanged
     v
 ezoe editor HTML  (escaped into <textarea name="ContentObjectAttribute_data_text_<id>">)
     |
     +--> ezxmltext_ezoe.tpl: the engine of ezoe's registry         ezoe
     |      tinymce3 / tinymce8 --> TinyMCE 3 or 8                   ezoe, unchanged
     |      tiptap (expOETiptapEngine)                               exp_oe_tiptap
     |        --> ezxmltext_exp_oe_tiptap_editor.tpl
     |        --> window.ExpOETiptap.init( textarea, options )
     |        --> Tiptap with the ezoe schema (src/js/schema)
     |        --> writes ezoe HTML back into the textarea on submit
     |
     v
 POST ContentObjectAttribute_data_text_<id>
     |
     |  eZOEXMLInput::validateInput() -> eZOEInputParser           ezoe, unchanged
     v
 stored ezxml
```

## Parts

| Part | Files | Owner |
| --- | --- | --- |
| Input handler | `classes/expoetiptapxmlinput.php` (`expOETiptapXMLInput extends eZOEXMLInput`) | PHP |
| ezoe engine | `classes/expoetiptapengine.php` (`expOETiptapEngine`), `settings/ezoe.ini.append.php` | PHP |
| Editor choice, migration, 0.1.0 switch | `classes/expoetiptapeditor.php` (`expOETiptapEditor`), `modules/exp_oe_tiptap/`, `bin/php/migrate_editor_preference.php` | PHP |
| Edit templates | `design/standard/templates/content/datatype/edit/ezxmltext_exp_oe_tiptap*.tpl` | templates |
| Schema (ezoe dialect) | `src/js/schema/`, `src/js/convert/` | JS, [content-mapping.md](content-mapping.md) |
| Editor UI, toolbar, dialogs, AI UI | `src/js/editor/`, `src/js/ui/`, `src/js/ai/`, `src/css/` | JS |
| Built bundle | `design/standard/javascript/exp_oe_tiptap/`, `design/standard/stylesheets/exp_oe_tiptap/` | build output, committed |
| AI server function | `classes/expoetiptapserverfunctions.php`, `classes/ai/` | PHP, [ai-hooks.md](ai-hooks.md) |

## The engine

ezoe has an editor engine registry (`expOEEditor`, ezoe's `classes/expoeeditor.php`): `ezoe.ini [EditorSettings]
Engines[<identifier>]=<class>`, each class implementing `expOEEditorEngine`. The extension's
`settings/ezoe.ini.append.php` adds one line, `Engines[tiptap]=expOETiptapEngine`; no ezoe code knows Tiptap.

`expOETiptapEngine` (`classes/expoetiptapengine.php`, extends ezoe's `expOEEditorEngineBase`):

- `identifier()` `tiptap`, `label()` `Tiptap`;
- `isAvailable()`: the built bundle exists (`exp_oe_tiptap.ini [EditorSettings] Scripts[]`, first entry); otherwise
  ezoe hides the engine from every choice, reports it as "not available" on `/ezoe/engine` and falls back;
- `version()`: the extension's version from `ezinfo.php`; `description()`: one sentence, translated by ezoe in the
  context `design/standard/ezoe` (this extension's translations carry that context too); both are shown on
  `/ezoe/engine`;
- `template()`: `design:content/datatype/edit/ezxmltext_exp_oe_tiptap_editor.tpl`, which ezoe's `ezxmltext_ezoe.tpl`
  includes when the user's engine is `tiptap`;
- `assets()`: none (the template loads the bundle itself, `AssetLoading`);
- `config()`: `expOETiptapEditor::editorInfo()`, the settings the template reads as `$input_handler.engine.config`.

## The input handler

ezxmltext asks `ezxml.ini [InputSettings]` for its input handler: `HandlerClass=eZSimplifiedXMLInput`, replaced by
`AliasClasses[eZSimplifiedXMLInput]`. ezoe sets that alias to `eZOEXMLInput`; exp_oe_tiptap, read after ezoe (its
extension.xml declares `<extends>ezoe`), sets it to `expOETiptapXMLInput`. If that class refuses (`isValid()`,
inherited from ezoe: no `ezoe/editor` policy, unsupported browser) the kernel falls back to the plain
`eZSimplifiedXMLInput`, exactly as with ezoe.

Since 0.1.1 the edit template is ezoe's own (`editTemplateSuffix()` is inherited: `ezoe`), and Tiptap works as an
ezoe engine with or without this alias. `expOETiptapXMLInput` overrides only, for what 0.1.0 put in place:

- `attribute()`: moves the 0.1.0 preference `exp_oe_editor` to `ezoe_engine` before ezoe reads the engine
  (`expOETiptapEditor::migratePreference()`); adds `exp_oe_editor` (`attributes()`), the Tiptap settings, for
  templates written against 0.1.0;
- `customObjectAttributeHTTPAction()`: the 0.1.0 switch action `exp_oe_switch_<editor>`, stored as ezoe's choice;
  every other action, ezoe's `switch_engine_<engine>` included, goes to ezoe.

A test (`tests/php/InputHandlerTest.php`) fails if any other method is overridden.

## The edit template

ezoe's `ezxmltext_ezoe.tpl` asks the input handler for `engine` (`expOEEditor::info( expOEEditor::resolve() )`) and
includes the engine's template; for `tiptap` that is `ezxmltext_exp_oe_tiptap_editor.tpl`. It loads the bundle once
per page, prints the textarea ezoe would print, the "Disable editor" button ezoe would print, ezoe's switch buttons
(`ezxmltext_ezoe_engine_switch.tpl`) with the label "Editing with Tiptap" (hidden by `exp_oe_tiptap.css` next to
ezoe's one-group switch of Exponential 6.0.15, `div.ezoe-engine-switch`, which names the engine in use), and calls
`window.ExpOETiptap.init( textarea, options )`. The options (from INI and the engine config, the same data ezoe's
TinyMCE 8 template uses) are listed in [plan.md](plan.md#5-contract-between-the-agents); the toolbar's switch item
clicks the switch button to the site's TinyMCE (`switchButtonName`).

`ezxmltext_exp_oe_tiptap.tpl`, the edit template of 0.1.0, only passes on to `ezxmltext_ezoe.tpl`.

## The editor choice

There is one choice, ezoe's `expOEEditor::resolve()`:

1. the user preference `ezoe_engine`, when it names an available engine;
2. `ezoe.ini [EditorSettings] EditorEngine` of the siteaccess, then the global one;
3. `tinymce3`.

`expOETiptapEditor::resolve()` only translates it: `tiptap` for the engine `tiptap`, `ezoe` for every other.
`engineOfEditor()`, `migratedEngine()` and `switchTargetOf()` are the pure translations the tests cover case by case.

## The switch

ezoe's: with `EngineSwitch=enabled`, every editor gets a button `CustomActionButton[<attribute id>_switch_engine_<engine>]`
for each other available engine. content/edit treats every custom action as a store action: it validates and stores
all attributes of the draft (with `skip-isRequired`), then calls the attribute's
`customObjectAttributeHTTPAction()`, which stores `ezoe_engine` (`expOEEditor::setUserEngine()`, with ezoe's audit
event), and content/edit renders the form again, now with the other editor and the stored draft. The form token is
the one ezformtoken checks on every content/edit POST. The page `/ezoe/engine` stores the same preference.

What 0.1.0 had keeps working and ends in the same call: the button `CustomActionButton[<attribute id>_exp_oe_switch_<editor>]`
and the view `exp_oe_tiptap/switch` (POST only, form token checked by the view itself as well, policy
`exp_oe_tiptap/switch`, local redirects only; without a POST it redirects to `/ezoe/engine`) call
`expOETiptapEditor::setUserEditor()`, which maps `tiptap` to `ezoe_engine=tiptap`, `ezoe` to the site's TinyMCE and
empty to the site default.

## AI

The bundle calls `ezjscore/call/expoetiptap::ai` with the command and the selected text, as a small markup with
placeholders for every item that is not text (`src/js/ai/structure.js`), checks the answer and rebuilds the content
with the original items; the server function checks
`[AISettings] Enabled`, the policy `exp_oe_tiptap/ai` and the form token, calls the configured provider and returns
the suggestion. The key stays on the server. Details: [ai-hooks.md](ai-hooks.md).

## What stays ezoe's

Policies `ezoe/editor`, `ezoe/disable_editor`, `ezoe/browse`, `ezoe/search`, `ezoe/relations`; the dialogs under
`/ezoe/dialog/...`, upload, relations and the object browser; validation messages; the engine registry and the one
choice of editor (`ezoe.ini [EditorSettings] Engines[]`, `EditorEngine`, `EngineSwitch`, preference `ezoe_engine`,
the page `/ezoe/engine`), of which Tiptap is one engine.
