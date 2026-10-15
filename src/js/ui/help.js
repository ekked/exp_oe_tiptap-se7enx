/**
 * The help of the editor, as ezoe's help dialog (help.tpl): what every button of this toolbar does, the keyboard
 * shortcuts, the tags of a text field and how the editor shows them, tips, and what the editor is. Tabs (WAI-ARIA tab
 * pattern: left/right, Home, End). Only the buttons this editor has are described.
 *
 * @license GPL-2.0-or-later
 */
import { h } from './dom.js';

/** What every button does (the text of ezoe's help, where ezoe has the button) */
export const BUTTON_HELP = {
    formatselect: 'Choose the format of the paragraph at the cursor: paragraph, preformatted text or a heading of level 1 to 6.',
    bold: 'Make the selected text bold. If it is bold already, the formatting is removed.',
    italic: 'Make the selected text italic. If it is italic already, the formatting is removed.',
    underline: 'Underline the selected text, or remove the underline (the custom tag "underline").',
    sub: 'Subscript the selected text, or remove it.',
    sup: 'Superscript the selected text, or remove it.',
    justifyleft: 'Align the paragraph, heading or table cell to the left, or remove the alignment.',
    justifycenter: 'Center the paragraph, heading or table cell, or remove the alignment.',
    justifyright: 'Align the paragraph, heading or table cell to the right, or remove the alignment.',
    justifyfull: 'Justify the paragraph, heading or table cell: every line gets the same width.',
    bullist: 'Make a bulleted list. Enter adds an item, Enter on an empty item ends the list. Inside a list the button removes it.',
    numlist: 'Make a numbered list. Enter adds an item, Enter on an empty item ends the list. Inside a list the button removes it.',
    outdent: 'Move the list item one level up (out of a nested list).',
    indent: 'Move the list item one level down (into a nested list).',
    undo: 'Undo the last change. Press again to undo more.',
    redo: 'Redo what Undo took back.',
    link: 'Make the selected text a link, or edit the link at the cursor: address (also an object or node of the site, chosen with search or browse), target, title, class, view and custom attributes.',
    unlink: 'Remove the link at the cursor; its text stays.',
    anchor: 'Insert or edit a named anchor, which links can point to with #name.',
    image: 'Embed an image: search, browse or upload it, then choose its size, alignment, view and class.',
    object: 'Embed an object of the site: search, browse or upload it, then choose how it is shown. An embedded object starts a line of its own unless it is inline.',
    file: 'Embed a file: search, browse or upload it, then choose how it is shown.',
    custom: 'Insert a custom tag, or edit the one at the cursor: select text first to put it into the tag, choose the tag and fill in its attributes.',
    literal: 'Literal text: shown exactly as it is typed, for code or preformatted text.',
    charmap: 'Insert a special character.',
    nonbreaking: 'Insert a non-breaking space: the words on both sides stay on one line (Ctrl+Shift+Space).',
    pagebreak: 'Insert a page break (the custom tag "pagebreak").',
    table: 'Insert a table, or edit the table at the cursor: width, border, class and custom attributes.',
    delete_table: 'Delete the table at the cursor.',
    delete_col: 'Delete the column at the cursor.',
    col_after: 'Insert a column after the one at the cursor.',
    col_before: 'Insert a column before the one at the cursor.',
    delete_row: 'Delete the row at the cursor.',
    row_after: 'Insert a row below the one at the cursor.',
    row_before: 'Insert a row above the one at the cursor.',
    split_cells: 'Split a merged cell into its cells again.',
    merge_cells: 'Merge the selected cells into one (select cells with Shift+click or by dragging across them).',
    cell_props: 'The cell at the cursor: data or header cell, width, alignment, class and custom attributes, for the cell, its row, its column or the whole table.',
    row_props: 'The row at the cursor: class and custom attributes.',
    tag_props: 'Class and custom attributes of the paragraph, heading, list, list item or bold or italic text at the cursor.',
    removeformat: 'Remove bold, italic, links and other formatting from the selected text.',
    pastetext: 'Paste as text: while it is on, everything is pasted without formatting. Ctrl+Shift+V does it for one paste.',
    search: 'Find a word or text (Ctrl+F).',
    replace: 'Find a word or text and replace it, one by one or all at once.',
    code: 'Show the source of the text, read only: the HTML the editor posts, which the server stores as ezxmltext.',
    fullscreen: 'Edit this text in the whole browser window. Press again to go back.',
    help: 'Open this help (Alt+0).',
    disable: 'Turn the editor off and edit the text as plain HTML in a text field.',
    store: 'Store the draft (Ctrl+S).',
    publish: 'Send the object for publishing.',
    discard: 'Discard the draft.',
    switch: 'Store the draft and continue in the other editor.',
    ai: 'The AI assistant: improve, shorten, extend, correct, translate, summarise or continue the selected text, shown as a suggestion you accept or reject.'
};

/** The tags of ezxmltext and what they look like in the editor */
export const TAG_HELP = [
    [ 'paragraph', 'A paragraph. Enter starts a new one, Shift+Enter a new line in it.' ],
    [ 'header', 'A heading, level 1 to 6 (Ctrl+1 ... Ctrl+6). The level follows the order of the headings.' ],
    [ 'strong, emphasize', 'Bold and italic text.' ],
    [ 'link', 'A link to an address, an object or node of the site, an e-mail address or an anchor.' ],
    [ 'anchor', 'A named place in the text that links can point to; shown as a small anchor.' ],
    [ 'ul, ol, li', 'Bulleted and numbered lists and their items, also nested.' ],
    [ 'table, tr, th, td', 'Tables with rows, header and data cells; cells can be merged.' ],
    [ 'literal', 'Literal text, kept exactly as typed.' ],
    [ 'embed, embed-inline', 'An embedded image, object or file; in a line of its own or inside the text. Shown with its preview.' ],
    [ 'custom', 'A custom tag of the site (fact box, quote, underline ...): a box around paragraphs or a mark on text, with its own attributes.' ],
    [ 'class, custom attributes', 'Most tags take a class and custom attributes from the site\'s settings: tag properties, or a click on the tag in the path below the text.' ]
];

/** Tips, as ezoe's "Tips & Tricks" */
export const TIPS = {
    path: 'The path below the text shows the tag at the cursor and the tags around it. A click on one selects it and opens its dialog.',
    resize: 'Drag the bottom right corner to make the editor taller or shorter.',
    typing: 'While typing: **text** makes bold, *text* italic, "# " at the start of a line a heading, "- " or "1. " a list.',
    imageLink: 'To make an image a link, select the image and press the link button.',
    paste: 'Text pasted from Word or a web page is cleaned to what a text field can store; Ctrl+Shift+V pastes the text only.',
    menu: 'Right click (or Shift+F10) for the commands at the cursor; Ctrl+right click for the browser\'s own menu.',
    switch: 'Below the editor you can switch to the other editor; the text is stored first and nothing is lost.'
};

/** Keyboard shortcuts: [ keys, what ] */
export const SHORTCUTS = [
    [ 'Ctrl+B', 'Bold' ], [ 'Ctrl+I', 'Italic' ], [ 'Ctrl+U', 'Underline' ], [ 'Ctrl+Z', 'Undo' ], [ 'Ctrl+Y / Ctrl+Shift+Z', 'Redo' ],
    [ 'Ctrl+1 ... Ctrl+6', 'Heading 1 to 6' ], [ 'Ctrl+7', 'Paragraph' ], [ 'Ctrl+8, Ctrl+9', 'Literal text' ], [ 'Ctrl+K', 'Insert/edit link' ],
    [ 'Ctrl+S', 'Store draft' ], [ 'Ctrl+Shift+V', 'Paste as text' ], [ 'Ctrl+F', 'Find and replace' ], [ 'F3 / Shift+F3', 'Next / previous match' ],
    [ 'Shift+Enter', 'Line break' ], [ 'Ctrl+Shift+Space', 'Non-breaking space' ], [ 'Tab / Shift+Tab', 'Indent / outdent list item, next / previous table cell' ],
    [ 'Alt+0', 'Help' ], [ 'Alt+F10', 'Move to the toolbar' ], [ 'Shift+F10', 'Context menu' ], [ 'Escape', 'Close a menu, the search bar or a dialog' ]
];

/** The shortcuts of the custom tag controls (ezoe.ini CustomTagControls) */
export const CUSTOM_TAG_SHORTCUTS = [
    [ 'Alt+Shift+Up / Down', 'Move the custom tag up or down' ], [ 'Alt+Shift+E', 'Edit the custom tag' ], [ 'Alt+Shift+Delete', 'Remove the custom tag' ]
];

function table( rows, head, keys ) {
    return h( 'table', { class: 'exp-oe-shortcuts exp-oe-help-table' + ( keys ? ' exp-oe-help-keys' : '' ) }, [
        head ? h( 'thead', {}, h( 'tr', {}, head.map( ( c ) => h( 'th', { scope: 'col', text: c } ) ) ) ) : null,
        h( 'tbody', {}, rows )
    ] );
}

/**
 * The body of the help dialog: tabs and their panels.
 * @param {Object} ctx      { t, options, instance }
 * @param {Array}  buttons  the toolbar's button names
 * @param {Object} commands the command registry (titles and icons)
 */
export function helpContent( ctx, buttons, commands ) {
    const { t, options } = ctx;
    const toolbarRows = ( buttons || [] ).filter( ( n ) => n !== '|' && BUTTON_HELP[n] && commands[n] ).map( ( n ) => {
        const def = commands[n];
        const title = def.label ? def.label( ctx ) : t( def.title );
        return h( 'tr', {}, [
            h( 'th', { scope: 'row' }, [ def.select ? null : h( 'span', { class: 'exp-oe-icon mce_' + def.icon, 'aria-hidden': 'true' } ), h( 'span', { text: title } ) ] ),
            h( 'td', { text: t( BUTTON_HELP[n] ) } )
        ] );
    } );
    const keys = SHORTCUTS.concat( options.customTagControls ? CUSTOM_TAG_SHORTCUTS : [] );
    const panels = [
        [ t( 'Toolbar' ), [ h( 'p', { text: t( 'The buttons of this editor:' ) } ), table( toolbarRows ) ] ],
        [ t( 'Keyboard' ), [ table( keys.map( ( [ k, d ] ) => h( 'tr', {}, [ h( 'th', { scope: 'row', text: k } ), h( 'td', { text: t( d ) } ) ] ) ), [ t( 'Keys' ), t( 'Function' ) ], true ),
                        h( 'p', { class: 'exp-oe-hint', text: t( 'On a Mac, Cmd instead of Ctrl.' ) } ) ] ],
        [ t( 'Tags' ), [ h( 'p', { text: t( 'A text field stores these tags (ezxmltext); the editor shows them as they look on the site:' ) } ),
                    table( TAG_HELP.map( ( [ tag, d ] ) => h( 'tr', {}, [ h( 'th', { scope: 'row', text: tag } ), h( 'td', { text: t( d ) } ) ] ) ) ) ] ],
        [ t( 'Tips' ), [ h( 'ul', { class: 'exp-oe-help-tips' }, Object.keys( TIPS ).map( ( k ) => h( 'li', { text: t( TIPS[k] ) } ) ) ) ] ],
        [ t( 'About' ), [ h( 'p', { text: t( 'The Online Editor of Exponential with Tiptap: it edits the same text as ezoe\'s TinyMCE and stores it the same way, so either editor can be used on the same content.' ) } ),
                     h( 'p', { text: 'Tiptap (https://tiptap.dev) and ProseMirror (https://prosemirror.net): MIT. exp_oe_tiptap: GPL-2.0-or-later.' } ) ] ]
    ];
    const id = 'exp-oe-help-' + Math.random().toString( 36 ).slice( 2 );
    const tabs = h( 'div', { class: 'exp-oe-tabs', role: 'tablist', 'aria-label': t( 'Help' ) } );
    const views = [];
    panels.forEach( ( [ label, content ], i ) => {
        const tab = h( 'button', {
            type: 'button', role: 'tab', class: 'exp-oe-tab', id: id + '-tab-' + i, 'aria-controls': id + '-panel-' + i,
            'aria-selected': i ? 'false' : 'true', tabindex: i ? '-1' : '0', text: label, onclick: () => show( i )
        } );
        tabs.appendChild( tab );
        views.push( h( 'div', { role: 'tabpanel', class: 'exp-oe-help-panel', id: id + '-panel-' + i, 'aria-labelledby': tab.id, tabindex: '0', hidden: !!i }, content ) );
    } );
    const show = ( i, focus ) => {
        Array.prototype.forEach.call( tabs.children, ( b, j ) => {
            b.setAttribute( 'aria-selected', i === j ? 'true' : 'false' );
            b.tabIndex = i === j ? 0 : -1;
        } );
        views.forEach( ( v, j ) => { v.hidden = i !== j; } );
        if ( focus )
            tabs.children[i].focus();
    };
    tabs.addEventListener( 'keydown', ( e ) => {
        const n = panels.length, i = Array.prototype.indexOf.call( tabs.children, document.activeElement );
        if ( i === -1 )
            return;
        const next = e.key === 'ArrowRight' ? ( i + 1 ) % n : e.key === 'ArrowLeft' ? ( i - 1 + n ) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
        if ( next === -1 )
            return;
        e.preventDefault();
        show( next, true );
    } );
    return [ tabs ].concat( views );
}
