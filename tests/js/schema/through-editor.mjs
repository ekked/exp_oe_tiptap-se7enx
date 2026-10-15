/**
 * The editor HTML of stdin through the whole editor with one edit made by its dialogs or commands, as a user makes
 * it, and the HTML the editor posts written to stdout. Used by tests/php/FeatureRoundtripTest.php, which feeds the
 * result to eZOEInputParser and compares the stored ezxml.
 *
 *   node tests/js/schema/through-editor.mjs <edit> < editor.html
 *
 * Edits: tag-paragraph, tag-header, tag-list-item, tag-strong, row, cell-column, cell-row-header, cell-table,
 * nbsp, none. The definitions are the ones FeatureRoundtripTest puts into content.ini.
 *
 * @license GPL-2.0-or-later
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator';

const edit = process.argv[ 2 ] || 'none';
let html = '';
process.stdin.setEncoding( 'utf8' );
for await ( const chunk of process.stdin )
    html += chunk;

GlobalRegistrator.register( { url: 'https://example.test/admin/content/edit/1/1' } );
const X = ( await import( '../../../src/js/index.js' ) ).default;

const attr = ( id, extra ) => Object.assign( { id, name: id.charAt( 0 ).toUpperCase() + id.slice( 1 ), type: 'text', title: '' }, extra || {} );
const OPTIONS = {
    attributeId: 42, contentObjectId: 1, version: 1, language: 'eng-GB', rows: 10, skin: 'a4',
    buttons: [ 'bold', 'italic', '|', 'bullist', 'numlist', '|', 'table', 'row_props', 'cell_props', '|', 'tag_props', 'nonbreaking' ],
    generalDefinitions: {
        paragraph: { classes: { intro: 'Introduction' }, attributes: [ attr( 'note' ) ] },
        header: { classes: { title: 'Title' }, attributes: [ attr( 'level' ) ] },
        ul: { classes: { checklist: 'Check list' }, attributes: [] },
        ol: { classes: {}, attributes: [] },
        li: { classes: { done: 'Done' }, attributes: [ attr( 'state' ) ] },
        strong: { classes: { highlight: 'Highlight' }, attributes: [ attr( 'tone' ) ] },
        emphasize: { classes: {}, attributes: [] }
    },
    tableDefinitions: {
        table: { classes: {}, attributes: [] },
        tr: { classes: { highlight: 'Highlight' }, attributes: [ attr( 'role' ) ] },
        td: { classes: { num: 'Number' }, attributes: [ attr( 'valign' ) ] },
        th: { classes: { num: 'Number' }, attributes: [ attr( 'scope' ) ] }
    },
    urls: { root: '/', ezoe: '/ezoe/', ezjscore: '/ezjscore/' }, formToken: 'T', ai: { enabled: false }
};

const form = document.createElement( 'form' );
document.body.appendChild( form );
const textarea = document.createElement( 'textarea' );
textarea.id = textarea.name = 'ContentObjectAttribute_data_text_42_eng-GB';
// the textarea value as a browser's HTML parser reads it (see through-tiptap.mjs)
textarea.value = html.replace( /<\/table><\/p>/g, '</table></p><p></p>' );
form.appendChild( textarea );
const inst = X.init( textarea, OPTIONS );

const dialog = () => document.querySelector( '.exp-oe-dialog' );
const fieldOf = ( label ) => {
    const l = Array.prototype.find.call( dialog().querySelectorAll( 'label' ), ( x ) => x.textContent.replace( ' *', '' ) === label );
    if ( !l )
        throw new Error( 'no field ' + label + ' in the dialog' );
    return document.getElementById( l.getAttribute( 'for' ) );
};
const set = ( label, value ) => {
    const el = fieldOf( label );
    el.value = value;
    el.dispatchEvent( new Event( 'change', { bubbles: true } ) );
};
const ok = () => dialog().querySelector( '.exp-oe-primary' ).click();
function at( text ) {
    let pos = null;
    inst.editor.state.doc.descendants( ( node, p ) => {
        if ( pos === null && node.isText && node.text.indexOf( text ) !== -1 )
            pos = p + node.text.indexOf( text ) + 1;
    } );
    if ( pos === null )
        throw new Error( 'no text ' + text );
    inst.editor.commands.setTextSelection( pos );
    inst.updateUI();
    return pos;
}
/** Opens the tag dialog at text and picks the element by its tag name when the dialog lists several */
function tagDialog( text, tag ) {
    at( text );
    inst.runButton( 'tag_props' );
    const list = dialog().querySelectorAll( 'label' );
    if ( Array.prototype.some.call( list, ( l ) => l.textContent === 'Element' ) ) {
        const el = fieldOf( 'Element' );
        const option = Array.prototype.find.call( el.options, ( o ) => o.textContent.indexOf( '<' + tag + '>' ) !== -1 );
        if ( !option )
            throw new Error( 'no element ' + tag );
        set( 'Element', option.value );
    }
}

switch ( edit ) {
    case 'tag-paragraph':
        tagDialog( 'Lead', 'paragraph' );
        set( 'Class', 'intro' );
        fieldOf( 'Note' ).value = 'Lead & "more"';
        ok();
        break;
    case 'tag-header':
        tagDialog( 'Heading', 'header' );
        set( 'Class', 'title' );
        fieldOf( 'Level' ).value = 'major';
        ok();
        break;
    case 'tag-list-item':
        tagDialog( 'First', 'li' );
        set( 'Class', 'done' );
        fieldOf( 'State' ).value = 'ok';
        ok();
        break;
    case 'tag-strong':
        tagDialog( 'bold', 'strong' );
        set( 'Class', 'highlight' );
        fieldOf( 'Tone' ).value = 'loud';
        ok();
        break;
    case 'row':
        at( 'a1' );
        inst.runButton( 'row_props' );
        set( 'Class', 'highlight' );
        fieldOf( 'Role' ).value = 'data';
        ok();
        break;
    case 'cell-column':
        at( 'b1' );
        inst.runButton( 'cell_props' );
        set( 'Apply to', 'column' );
        fieldOf( 'Width' ).value = '30%';
        set( 'Alignment', 'right' );
        set( 'Class', 'num' );
        fieldOf( 'Valign' ).value = 'top';
        ok();
        break;
    case 'cell-row-header':
        at( 'a1' );
        inst.runButton( 'cell_props' );
        set( 'Apply to', 'row' );
        set( 'Cell type', 'th' );
        fieldOf( 'Valign' ).value = 'middle';
        ok();
        break;
    case 'cell-table':
        at( 'a2' );
        inst.runButton( 'cell_props' );
        set( 'Apply to', 'table' );
        set( 'Alignment', 'center' );
        ok();
        break;
    case 'nbsp': {
        // the space of "10 km" becomes a non-breaking one, and one more is typed after the space behind "km"
        const pos = at( '10 km' );
        inst.editor.commands.setTextSelection( { from: pos + 1, to: pos + 2 } );
        inst.runButton( 'nonbreaking' );
        at( 'km' );
        inst.editor.commands.setTextSelection( inst.editor.state.selection.from + 2 );
        inst.runButton( 'nonbreaking' );
        break;
    }
    case 'none':
        break;
    default:
        throw new Error( 'unknown edit ' + edit );
}
if ( dialog() )
    throw new Error( 'the dialog is still open: ' + dialog().textContent );
process.stdout.write( inst.getHTML() );
X.destroy( textarea );
await GlobalRegistrator.unregister();
