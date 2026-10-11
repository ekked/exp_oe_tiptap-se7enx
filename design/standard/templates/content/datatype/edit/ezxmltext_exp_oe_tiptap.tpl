{* exp_oe_tiptap 0.1.0 rendered ezxmltext through this template. Since 0.1.1 Tiptap is an engine of ezoe's registry
   and ezoe's ezxmltext_ezoe.tpl renders every editor, Tiptap included (ezxmltext_exp_oe_tiptap_editor.tpl). This file
   stays for templates and overrides that include it by name, and only passes on to ezoe's template. *}
{default input_handler=$attribute.content.input
         attribute_base='ContentObjectAttribute'
         editorRow=10}
{include uri='design:content/datatype/edit/ezxmltext_ezoe.tpl'
         attribute=$attribute
         input_handler=$input_handler
         attribute_base=$attribute_base
         editorRow=$editorRow}
{/default}
