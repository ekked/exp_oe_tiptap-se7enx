# Installing exp_oe_tiptap

## Requirements

- Exponential 6.0.15 or later (the kernel ships ezoe and ezjscore; Tiptap is an engine of ezoe's editor registry,
  whose page `/ezoe/engine` lists each engine's version and status from that version on).
- PHP 8.0 or later.
- ezoe and ezjscore active. exp_oe_tiptap uses ezoe's input handler, parser, dialogs and policies; it does not
  replace ezoe.
- ezformtoken active (recommended everywhere; the 0.1.0 switch view refuses to work without a form token).
- For the AI commands only: PHP curl, and an account with a provider (see below).
- For building the JavaScript from source only: Node.js 20 or later and npm. The built files are committed, so a
  site does not need Node.

## 1. Get the extension

With Composer, in a project that manages its extensions with Composer:

```bash
composer require se7enxweb/exp_oe_tiptap
```

Or copy (or clone) the extension to `extension/exp_oe_tiptap`.

## 2. Activate it

exp_oe_tiptap's `ezxml.ini` replaces ezoe's input handler alias, so it must be read after
ezoe's. `extension.xml` declares `<extends>ezoe` for this: the kernel orders the extensions by it, so the place in
`ActiveExtensions` does not matter (with `<requires>` ezoe would be read last and win). In
`settings/override/site.ini.append.php`:

```ini
[ExtensionSettings]
ActiveExtensions[]=ezjscore
ActiveExtensions[]=ezformtoken
ActiveExtensions[]=ezoe
ActiveExtensions[]=exp_oe_tiptap
```

Check that the alias won: `php bin/php/ezexec.php` with a small script, or the admin's "Setup > Ini settings"
for `ezxml.ini [InputSettings] AliasClasses`: `eZSimplifiedXMLInput` must map to `expOETiptapXMLInput`.

## 3. Autoloads and caches

```bash
php bin/php/ezpgenerateautoloads.php -e
php bin/php/ezcache.php --clear-tag=ini --clear-tag=template --clear-id=template-override --allow-root-user
```

`template-override` matters: the extension adds new template files, and without that cache cleared the edit form
comes back with an empty field.

Then make the web runtime see the new classes:

- PHP-FPM: reload it (`systemctl reload <your php-fpm unit>`).
- Exponential Velocity: `exp:velocity restart`, or `./console exp:velocity deploy` which does every step above.

## 4. Settings

Tiptap is an engine of ezoe's editor registry: the extension's `settings/ezoe.ini.append.php` adds
`Engines[tiptap]=expOETiptapEngine` and turns ezoe's switch buttons on (`EngineSwitch=enabled`). Which editor a
user gets is then decided by ezoe alone, in this order:

1. the user's own choice, ezoe's preference `ezoe_engine` (the page `/ezoe/engine`, or a "Switch to the editor ..."
   button below a text field);
2. `ezoe.ini [EditorSettings] EditorEngine` of the siteaccess, then the global one (`tinymce3` when nothing is set);
3. TinyMCE 3 whenever the choice names an engine that is not available (Tiptap without its built bundle).

The shipped defaults keep ezoe's TinyMCE as everybody's editor. To make Tiptap the default of a siteaccess, in
`settings/siteaccess/<siteaccess>/ezoe.ini.append.php`:

```ini
[EditorSettings]
EditorEngine=tiptap
```

To hide the switch buttons (users keep the choice on `/ezoe/engine`), set `EngineSwitch=disabled` in a siteaccess or
in `settings/override/ezoe.ini.append.php`.

Every setting: [doc/configuration.md](doc/configuration.md).

## 5. Policies

| Policy | Who needs it |
| --- | --- |
| `ezoe/editor` | everybody who edits with any engine, and the page `/ezoe/engine` (unchanged from ezoe) |
| `exp_oe_tiptap/ai` | editors who may use the AI commands (also needs `[AISettings] Enabled=true`) |
| `exp_oe_tiptap/switch` | only the view `exp_oe_tiptap/switch` of 0.1.0, kept for links and forms that post to it |

Administrators with `*` have all of them. The switch buttons in the edit form follow ezoe's `EngineSwitch`, not a
policy of this extension.

## 6. Building the JavaScript from source

Only needed when you change `src/` or upgrade Tiptap. From `extension/exp_oe_tiptap`:

```bash
npm ci                 # exact versions from package-lock.json, into node_modules/ (git-ignored)
npm run build          # writes design/standard/javascript/exp_oe_tiptap/ and design/standard/stylesheets/exp_oe_tiptap/
npm test               # the schema and round-trip tests
```

Commit the built files. Browsers reload them by themselves (the URL carries their file time).

## 7. Enabling the AI commands (optional)

1. Choose a provider ([doc/ai-hooks.md](doc/ai-hooks.md)). Content you send leaves your server unless the
   provider is self-hosted.
2. Put the key **only** in `settings/override/exp_oe_tiptap.ini.append.php`, which is never committed:
   ```ini
   [AISettings]
   Enabled=true
   Provider=openai-compatible
   Endpoint=https://api.example.com/v1/chat/completions
   Model=<model name>
   ApiKey=<your key>
   ```
3. Grant `exp_oe_tiptap/ai` to the roles that may use it.
4. Clear the INI cache (`--clear-tag=ini`) and reload PHP.

The key is used on the server only; the browser never sees it.

## 8. Verifying

1. Run the PHP tests from the Exponential root:
   ```bash
   nice -n 15 php vendor/bin/phpunit -c extension/exp_oe_tiptap/phpunit.xml.dist
   ```
2. Open `/ezoe/engine` in the admin. The table lists TinyMCE 3, TinyMCE 8 and Tiptap with their versions; Tiptap's
   status is "Available" and the select offers it.
3. Edit an article as an administrator. With the shipped settings you see TinyMCE as before plus the buttons
   "Switch to the editor ..." below the field, "Switch to the editor Tiptap" among them.
4. Type something, press it: the form comes back with Tiptap ("Editing with Tiptap") and your text. Press
   "Switch to the editor TinyMCE ...": back to TinyMCE, text still there.
5. Publish from Tiptap and compare the stored XML with the same text published from ezoe (they must be equal).
6. If Tiptap is not offered: `/ezoe/engine` says why in its status column (the bundle
   `design/standard/javascript/exp_oe_tiptap/exp_oe_tiptap.js` is missing, or the class is not autoloaded). If no
   switch button shows: `EngineSwitch=disabled`. See [doc/maintenance.md](doc/maintenance.md#troubleshooting).

## Upgrading from 0.1.0

0.1.0 had its own switch: the preference `exp_oe_editor`, the button "Switch to Tiptap" and the page
`exp_oe_tiptap/switch`. 0.1.1 has one choice, ezoe's. After updating the files, regenerating autoloads and clearing
the caches (step 3):

- `exp_oe_editor=tiptap` becomes `ezoe_engine=tiptap`, so those users keep Tiptap; `exp_oe_editor=ezoe` keeps
  whatever ezoe engine the user had. The old preference is emptied. The edit form does this for each user the
  first time it opens; to do it for every user at once (and have `/ezoe/engine` show the right choice right away):
  ```bash
  php extension/exp_oe_tiptap/bin/php/migrate_editor_preference.php -s <admin siteaccess> --dry-run
  php extension/exp_oe_tiptap/bin/php/migrate_editor_preference.php -s <admin siteaccess>
  ```
- `exp_oe_tiptap.ini [EditorSettings] DefaultEditor` and `AllowSwitch` are no longer read. Use
  `ezoe.ini [EditorSettings] EditorEngine=tiptap` and `EngineSwitch` instead (step 4).
- The old switch button (`CustomActionButton[<id>_exp_oe_switch_<editor>]`) and a POST to `exp_oe_tiptap/switch`
  still work and store ezoe's preference; `exp_oe_tiptap/switch` without a POST goes to `/ezoe/engine`.
- Overrides of `ezxmltext_exp_oe_tiptap_switch.tpl` or `exp_oe_tiptap/switch.tpl` are no longer used (both
  templates are gone); `ezxmltext_exp_oe_tiptap.tpl` now only passes on to ezoe's `ezxmltext_ezoe.tpl`.

## Removing it

Remove `exp_oe_tiptap` from `ActiveExtensions`, regenerate autoloads, clear the INI and template caches. ezoe takes
over again with nothing to migrate: the content was ezxmltext all along. Users whose `ezoe_engine` is `tiptap` get
the site's engine again, because ezoe falls back from an engine that is not registered.
