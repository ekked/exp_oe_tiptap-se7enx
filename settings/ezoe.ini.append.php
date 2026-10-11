<?php /* #?ini charset="utf-8"?

# exp_oe_tiptap registers Tiptap as an engine of the Online Editor (ezoe). It is then listed on the page
# ezoe/engine with its version and status, and chosen like TinyMCE 3 and 8: the user preference ezoe_engine,
# the button "Switch to the editor Tiptap" below the editor, or EditorEngine for a whole siteaccess.
# Never start this list with an empty Engines[]: that would remove ezoe's own engines.
[EditorSettings]
Engines[tiptap]=expOETiptapEngine

# The switch buttons below the editor (one per other available engine). On with this extension, as the
# Tiptap switch of 0.1.0 was; set EngineSwitch=disabled in a siteaccess or override to hide them.
EngineSwitch=enabled

# The editor of users without a choice of their own stays ezoe's EditorEngine (tinymce3 unless the site says
# otherwise). To make Tiptap the default of a siteaccess, set there:
#   [EditorSettings]
#   EditorEngine=tiptap

*/ ?>
