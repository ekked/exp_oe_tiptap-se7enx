<?php /* #?ini charset="utf-8"?

# exp_oe_tiptap: the Tiptap online editor for ezxmltext fields, next to the Online Editor (ezoe).
# Every setting is described in doc/configuration.md. Override per siteaccess in
# settings/siteaccess/<siteaccess>/exp_oe_tiptap.ini.append.php, secrets only in
# settings/override/exp_oe_tiptap.ini.append.php (never committed).

[EditorSettings]
# The look of the editor. Empty: ezoe's Skin (ezoe.ini [EditorSettings] Skin, o2k7 - TinyMCE 3's look with ezoe's
# icons). a4: a Tiptap editor in admin4's look - flat toolbar with Tiptap's icons, bubble menu over selected
# text, "+" on empty lines, colors from admin4's tokens (light and dark). Set it per siteaccess
# (settings/siteaccess/<siteaccess>/exp_oe_tiptap.ini.append.php). It is left undefined here on purpose: an
# extension's own settings are read after a siteaccess's, so a value here would hide every siteaccess's choice.
#Skin=
# Which editor a user gets is ezoe's choice since 0.1.1: Tiptap is the engine "tiptap" of ezoe's registry
# (settings/ezoe.ini.append.php). The site default is ezoe.ini [EditorSettings] EditorEngine (EditorEngine=tiptap
# makes Tiptap the default), the switch buttons are ezoe.ini EngineSwitch, a user's own choice is the preference
# ezoe_engine (page ezoe/engine). DefaultEditor and AllowSwitch of 0.1.0 are no longer read.
# Tiptap is only offered while the built bundle (Scripts[], first entry) is present.

# How the bundle is put on the page.
# ezdesign: script and link tags pointing at the built files, without a version query
#           (like ezoe's TinyMCE 8 engine; the files are never repacked or minified again).
# ezjscore: ezscript_require() / ezcss_require(), packed with the rest of the page by ezjscore.
AssetLoading=ezdesign

# The built files, as design paths below javascript/ and stylesheets/ (built by npm run build, committed).
# The first script is the bundle that defines window.ExpOETiptap.
Scripts[]
Scripts[]=exp_oe_tiptap/exp_oe_tiptap.js
Styles[]
Styles[]=exp_oe_tiptap/exp_oe_tiptap.css

# Minimum height of the editing area in pixels; the class attribute's text rows can make it taller.
MinHeight=300

# The editor's context menu (right click, the context menu key, Shift+F10) with the commands at the cursor.
# enabled (default) or disabled. The browser's own menu stays at hand with Ctrl+right click or a second right click.
ContextMenu=enabled

# The source view (toolbar button code) shows the HTML of the editor; the server makes the stored ezxmltext of it
# when the form is stored. enabled (default): the HTML can be changed there; Apply cleans it as pasted HTML, lists
# what the editor cannot keep and asks first, and Undo takes it back. disabled: the source view is read only.
# Left undefined here on purpose, like Skin: an extension's own settings are read after a siteaccess's, so a value
# here would hide every siteaccess's choice. Set it per siteaccess or in settings/override/.
#SourceEditable=enabled


[AISettings]
# The AI commands of the editor (improve, shorten, ...). Off by default. When enabled, only users with the
# policy exp_oe_tiptap/ai see them. The browser never talks to the provider: it calls the ezjscore server
# function expoetiptap::ai, which checks policy and form token and calls the provider server side.
Enabled=false

# openai-compatible: any endpoint speaking the OpenAI chat completions API (OpenAI, Azure OpenAI, Mistral,
#                    self-hosted servers such as Ollama or vLLM)
# anthropic:         the Anthropic Messages API
# tiptap-cloud:      Tiptap's hosted AI service (needs a Tiptap account; check its terms first)
Provider=openai-compatible

# The provider's API URL, e.g. https://api.openai.com/v1/chat/completions,
# https://api.anthropic.com/v1/messages or http://127.0.0.1:11434/v1/chat/completions
Endpoint=

# The model name the provider expects.
Model=

# The API key. Put it ONLY in settings/override/exp_oe_tiptap.ini.append.php, never in a committed file.
# It is never sent to the browser.
ApiKey=

# Seconds to wait for the provider.
Timeout=30

# The longest text (characters) a command may send, and the longest answer (tokens) it may ask for.
MaxInputLength=20000
MaxOutputTokens=2000

# The commands offered in the editor, in this order.
Commands[]
Commands[]=improve
Commands[]=shorten
Commands[]=extend
Commands[]=fix_spelling
Commands[]=translate
Commands[]=summarise
Commands[]=continue

*/ ?>
