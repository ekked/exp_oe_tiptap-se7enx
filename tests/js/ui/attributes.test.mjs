/**
 * The attribute dialogs (node --test, happy-dom): class and custom attributes of paragraphs, headings, lists, list
 * items, strong and emphasize (tag_props, like ezoe's tag_general.tpl / tag_header.tpl), from
 * options.generalDefinitions; the result is ezoe's dialect, which eZOEInputParser stores as class= and custom:...
 *
 * @license GPL-2.0-or-later
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

let X, form;

before( async () => {
    GlobalRegistrator.register( { url: 'https://example.test/admin/content/edit/1/1' } );
    X = ( await import( '../../../src/js/index.js' ) ).default;
} );
after( async () => {
    for ( const i of X.instances.slice() )
        X.destroy( i.textarea );
    await GlobalRegistrator.unregister();
} );
beforeEach( () => {
    for ( const i of X.instances.slice() )
        X.destroy( i.textarea );
    document.body.innerHTML = '';
    form = document.createElement( 'form' );
    document.body.appendChild( form );
} );

function textarea( html ) {
    const t = document.createElement( 'textarea' );
    t.id = t.name = 'ContentObjectAttribute_data_text_' + Math.floor( Math.random() * 1e6 );
    t.value = html;
    form.appendChild( t );
    return t;
}

const attr = ( id, extra ) => Object.assign( { id, name: id.charAt( 0 ).toUpperCase() + id.slice( 1 ), type: 'text', title: '' }, extra || {} );

export const DEFINITIONS = {
    paragraph: { classes: { intro: 'Introduction', lead: 'lead' }, attributes: [ attr( 'note' ), attr( 'width' ) ] },
    header: { classes: { title: 'Title' }, attributes: [ attr( 'level', { type: 'select', selection: { '-0-': 'None', major: 'Major' } } ) ] },
    ul: { classes: { checklist: 'Check list' }, attributes: [] },
    ol: { classes: {}, attributes: [] },
    li: { classes: { done: 'Done' }, attributes: [ attr( 'state' ) ] },
    strong: { classes: { highlight: 'Highlight' }, attributes: [ attr( 'tone', { required: true } ) ] },
    emphasize: { classes: [], attributes: [] }
};

const OPTIONS = {
    attributeId: 42, contentObjectId: 1, version: 1, language: 'eng-GB', rows: 10, skin: 'a4',
    buttons: [ 'formatselect', 'bold', '|', 'bullist', '|', 'tag_props', '|', 'help' ],
    generalDefinitions: DEFINITIONS,
    customAttributeStyleMap: { width: 'width', color: 'color' },
    pathOpenDialog: true,
    urls: { root: '/', ezoe: '/ezoe/', ezjscore: '/ezjscore/' }, formToken: 'TOKEN', locale: 'de-DE', ai: { enabled: false },
    i18n: { 'Tag properties': 'Tag-Eigenschaften' }
};

const dialog = () => document.querySelector( '.exp-oe-dialog' );
const fieldOf = ( label ) => {
    const l = Array.prototype.find.call( dialog().querySelectorAll( 'label' ), ( x ) => x.textContent.replace( ' *', '' ) === label );
    return l ? document.getElementById( l.getAttribute( 'for' ) ) : null;
};
const ok = () => dialog().querySelector( '.exp-oe-primary' ).click();
const change = ( el, value ) => {
    el.value = value;
    el.dispatchEvent( new Event( 'change', { bubbles: true } ) );
};
function textPos( inst, text ) {
    let pos = null;
    inst.editor.state.doc.descendants( ( node, p ) => {
        if ( pos === null && node.isText && node.text.indexOf( text ) !== -1 )
            pos = p + node.text.indexOf( text ) + 1;
    } );
    return pos;
}

test( 'the tag_props button is offered only when the button list has it, with Tiptap\'s look in a4', () => {
    const with_ = X.init( textarea( '<p>x</p>' ), OPTIONS );
    assert.ok( with_.toolbar.controls.tag_props );
    assert.equal( with_.toolbar.controls.tag_props.title, 'Tag-Eigenschaften' );
    assert.ok( with_.toolbar.controls.tag_props.querySelector( '.mce_tag_props' ) );
    const without = X.init( textarea( '<p>x</p>' ), Object.assign( {}, OPTIONS, { buttons: [ 'bold' ] } ) );
    assert.equal( without.toolbar.controls.tag_props, undefined );
} );

test( 'a paragraph gets a class and custom attributes, a mapped custom attribute also its style', () => {
    const inst = X.init( textarea( '<p>Lead text</p>' ), OPTIONS );
    inst.editor.commands.setTextSelection( textPos( inst, 'Lead' ) );
    inst.runButton( 'tag_props' );
    assert.equal( dialog().querySelector( '.exp-oe-dialog-heading' ).textContent, 'Tag-Eigenschaften' );
    // one element only: no element list
    assert.equal( fieldOf( 'Element' ), null );
    const cls = fieldOf( 'Class' );
    assert.deepEqual( Array.prototype.map.call( cls.options, ( o ) => o.value ), [ '', 'intro', 'lead' ] );
    change( cls, 'intro' );
    fieldOf( 'Note' ).value = 'Lead';
    fieldOf( 'Width' ).value = '50%';
    ok();
    assert.equal( inst.getHTML(), '<p customattributes="note|Leadattribute_separationwidth|50%" class="intro" style="width: 50%;">Lead text</p>' );
    // and back: the dialog shows what is stored; clearing removes class, custom attributes and the mapped style
    inst.runButton( 'tag_props' );
    assert.equal( fieldOf( 'Class' ).value, 'intro' );
    assert.equal( fieldOf( 'Width' ).value, '50%' );
    change( fieldOf( 'Class' ), '' );
    fieldOf( 'Note' ).value = '';
    fieldOf( 'Width' ).value = '';
    ok();
    assert.equal( inst.getHTML(), '<p>Lead text</p>' );
} );

test( 'bold text in a list item: the elements are listed innermost first, each with its own definition', () => {
    const inst = X.init( textarea( '<ul><li>Item <strong>bold</strong></li></ul>' ), OPTIONS );
    inst.editor.commands.setTextSelection( textPos( inst, 'old' ) );
    inst.runButton( 'tag_props' );
    const which = fieldOf( 'Element' );
    assert.deepEqual( Array.prototype.map.call( which.options, ( o ) => o.textContent ),
                      [ 'Bold <strong>', 'Paragraph <paragraph>', 'List item <li>', 'Bullet list <ul>' ] );
    assert.equal( which.value, '0' );
    // strong: its required custom attribute is checked
    change( fieldOf( 'Class' ), 'highlight' );
    ok();
    assert.match( dialog().querySelector( '.exp-oe-dialog-error' ).textContent, /Tone/ );
    fieldOf( 'Tone' ).value = 'loud';
    ok();
    assert.equal( inst.getHTML(), '<ul><li>Item <strong customattributes="tone|loud" class="highlight">bold</strong></li></ul>' );
    // the list item and the list
    inst.runButton( 'tag_props' );
    change( fieldOf( 'Element' ), '2' );
    assert.deepEqual( Array.prototype.map.call( fieldOf( 'Class' ).options, ( o ) => o.value ), [ '', 'done' ] );
    change( fieldOf( 'Class' ), 'done' );
    fieldOf( 'State' ).value = 'ok';
    ok();
    inst.runButton( 'tag_props' );
    change( fieldOf( 'Element' ), '3' );
    change( fieldOf( 'Class' ), 'checklist' );
    ok();
    assert.equal( inst.getHTML(), '<ul class="checklist"><li customattributes="state|ok" class="done">Item <strong customattributes="tone|loud" class="highlight">bold</strong></li></ul>' );
} );

test( 'in plain text of a list item the dialog opens on the list item, as ezoe writes <li>text</li>', () => {
    const inst = X.init( textarea( '<ul><li>Item</li></ul>' ), OPTIONS );
    inst.editor.commands.setTextSelection( textPos( inst, 'tem' ) );
    inst.runButton( 'tag_props' );
    assert.equal( fieldOf( 'Element' ).value, '1' );
    assert.equal( fieldOf( 'Element' ).selectedOptions[0].textContent, 'List item <li>' );
} );

test( 'a heading: select custom attribute, unknown classes stay selectable, a tag without definitions says so', () => {
    const inst = X.init( textarea( '<h2 class="legacy">Title</h2><p>x <em>emph</em></p>' ), OPTIONS );
    inst.editor.commands.setTextSelection( textPos( inst, 'itle' ) );
    inst.runButton( 'tag_props' );
    assert.deepEqual( Array.prototype.map.call( fieldOf( 'Class' ).options, ( o ) => o.value ), [ '', 'title', 'legacy' ] );
    assert.equal( fieldOf( 'Class' ).value, 'legacy' );
    change( fieldOf( 'Level' ), 'major' );
    ok();
    assert.match( inst.getHTML(), /^<h2 customattributes="level\|major" class="legacy">Title<\/h2>/ );
    inst.editor.commands.setTextSelection( textPos( inst, 'mph' ) );
    inst.runButton( 'tag_props' );
    assert.equal( fieldOf( 'Element' ).selectedOptions[0].textContent, 'Italic <emphasize>' );
    assert.match( dialog().textContent, /no classes or custom attributes/ );
    dialog().querySelector( '.exp-oe-dialog-close' ).click();
} );

test( 'a click on a path item opens the dialog on that element (TagPathOpenDialog)', () => {
    const inst = X.init( textarea( '<ul><li>Item <strong>bold</strong></li></ul>' ), OPTIONS );
    inst.editor.commands.setTextSelection( textPos( inst, 'old' ) );
    inst.updateUI();
    const items = Array.prototype.slice.call( inst.statusbar.element.querySelectorAll( '.exp-oe-path-item' ) );
    assert.deepEqual( items.map( ( a ) => a.textContent ), [ 'ul', 'li', 'paragraph', 'strong' ] );
    items[0].click();
    // the list is selected as a whole: the dialog is the list's
    assert.equal( fieldOf( 'Element' ), null );
    assert.deepEqual( Array.prototype.map.call( fieldOf( 'Class' ).options, ( o ) => o.value ), [ '', 'checklist' ] );
    change( fieldOf( 'Class' ), 'checklist' );
    ok();
    assert.equal( inst.getHTML(), '<ul class="checklist"><li>Item <strong>bold</strong></li></ul>' );
    // a mark of the path: the dialog opens on it, the elements around it stay in the list
    inst.editor.commands.setTextSelection( textPos( inst, 'old' ) );
    inst.updateUI();
    const strong = Array.prototype.find.call( inst.statusbar.element.querySelectorAll( '.exp-oe-path-item' ), ( a ) => a.textContent === 'strong' );
    strong.click();
    assert.equal( fieldOf( 'Element' ).selectedOptions[0].textContent, 'Bold <strong>' );
    dialog().querySelector( '.exp-oe-dialog-close' ).click();
} );

test( 'the style of mapped custom attributes is made like eZOEXMLInput does, other styles stay', async () => {
    const { styleWithCustomAttributes } = await import( '../../../src/js/ui/dialogs.js' );
    const map = { width: 'width', border_color: 'border-color', color: 'color' };
    assert.equal( styleWithCustomAttributes( 'text-align: center; width: 10%;', { width: '50%', color: 'red' }, map ), 'text-align: center; width: 50%;' );
    assert.equal( styleWithCustomAttributes( '', { border_color: '#f00' }, map ), 'border-color: #f00;' );
    assert.equal( styleWithCustomAttributes( 'width: 3px', {}, map ), '' );
} );

// ---------------------------------------------------------------- table rows and cells

const TABLE_OPTIONS = Object.assign( {}, OPTIONS, {
    buttons: [ 'bold', '|', 'table', 'row_props', 'cell_props', '|', 'tag_props' ],
    tableDefinitions: {
        table: { classes: {}, attributes: [] },
        tr: { classes: { highlight: 'Highlight', muted: 'Muted' }, attributes: [ attr( 'role' ) ] },
        td: { classes: { num: 'Number' }, attributes: [ attr( 'valign' ) ] },
        th: { classes: { num: 'Number' }, attributes: [ attr( 'scope' ) ] }
    }
} );
const TABLE = '<table border="1"><tbody><tr><th><p>A</p></th><th><p>B</p></th></tr><tr><td><p>a1</p></td><td><p>b1</p></td></tr><tr><td><p>a2</p></td><td><p>b2</p></td></tr></tbody></table>';

test( 'row_props: class and custom attributes of the row at the cursor (content.ini [tr]), disabled outside a table', () => {
    const inst = X.init( textarea( '<p>before</p>' + TABLE ), TABLE_OPTIONS );
    inst.editor.commands.setTextSelection( textPos( inst, 'before' ) );
    inst.updateUI();
    assert.equal( inst.toolbar.controls.row_props.disabled, true );
    inst.editor.commands.setTextSelection( textPos( inst, 'b1' ) );
    inst.updateUI();
    assert.equal( inst.toolbar.controls.row_props.disabled, false );
    inst.runButton( 'row_props' );
    assert.deepEqual( Array.prototype.map.call( fieldOf( 'Class' ).options, ( o ) => o.value ), [ '', 'highlight', 'muted' ] );
    change( fieldOf( 'Class' ), 'highlight' );
    fieldOf( 'Role' ).value = 'data';
    ok();
    assert.match( inst.getHTML(), /<tr customattributes="role\|data" class="highlight"><td><p>a1<\/p><\/td><td><p>b1<\/p><\/td><\/tr>/ );
    // removed again
    inst.runButton( 'row_props' );
    assert.equal( fieldOf( 'Class' ).value, 'highlight' );
    change( fieldOf( 'Class' ), '' );
    fieldOf( 'Role' ).value = '';
    ok();
    assert.match( inst.getHTML(), /<tr><td><p>a1<\/p><\/td>/ );
} );

test( 'a click on tr in the path opens the row dialog', () => {
    const inst = X.init( textarea( TABLE ), TABLE_OPTIONS );
    inst.editor.commands.setTextSelection( textPos( inst, 'a2' ) );
    inst.updateUI();
    const tr = Array.prototype.find.call( inst.statusbar.element.querySelectorAll( '.exp-oe-path-item' ), ( a ) => a.textContent === 'tr' );
    tr.click();
    assert.match( dialog().querySelector( '.exp-oe-dialog-heading' ).textContent, /row/ );
    change( fieldOf( 'Class' ), 'muted' );
    ok();
    assert.match( inst.getHTML(), /<tr class="muted"><td><p>a2<\/p>/ );
} );

test( 'cell_props applies to the cell, its row, its column, the whole table or the selected cells', async () => {
    const { CellSelection } = await import( '@tiptap/pm/tables' );
    const inst = X.init( textarea( TABLE ), TABLE_OPTIONS );
    const run = ( text, scope, cls, kind ) => {
        inst.editor.commands.setTextSelection( textPos( inst, text ) );
        inst.runButton( 'cell_props' );
        const s = fieldOf( 'Apply to' );
        assert.deepEqual( Array.prototype.map.call( s.options, ( o ) => o.value ), [ 'cell', 'row', 'column', 'table' ] );
        change( s, scope );
        if ( kind )
            change( fieldOf( 'Cell type' ), kind );
        change( fieldOf( 'Class' ), cls );
        ok();
    };
    run( 'b1', 'column', 'num' );
    assert.match( inst.getHTML(), /<th class="num"><p>B<\/p><\/th><\/tr><tr><td><p>a1<\/p><\/td><td class="num"><p>b1<\/p><\/td><\/tr><tr><td><p>a2<\/p><\/td><td class="num"><p>b2<\/p>/ );
    run( 'a2', 'row', 'num', 'th' );
    assert.match( inst.getHTML(), /<tr><th class="num"><p>a2<\/p><\/th><th class="num"><p>b2<\/p><\/th><\/tr>/ );
    run( 'a1', 'table', '' );
    assert.doesNotMatch( inst.getHTML(), /class=/ );
    // a cell selection: the choice starts with the selected cells
    const cells = [];
    inst.editor.state.doc.descendants( ( n, p ) => {
        if ( n.type.spec.tableRole === 'cell' || n.type.spec.tableRole === 'header_cell' )
            cells.push( p );
    } );
    inst.editor.view.dispatch( inst.editor.state.tr.setSelection( CellSelection.create( inst.editor.state.doc, cells[0], cells[1] ) ) );
    inst.runButton( 'cell_props' );
    assert.equal( fieldOf( 'Apply to' ).value, 'selection' );
    change( fieldOf( 'Class' ), 'num' );
    ok();
    assert.match( inst.getHTML(), /^<p><table border="1"><tbody><tr><th class="num"><p>A<\/p><\/th><th class="num"><p>B<\/p><\/th><\/tr><tr><td><p>a1/ );
} );

test( 'cell_props keeps the span of every cell it changes', () => {
    const inst = X.init( textarea( '<table><tbody><tr><td colspan="2"><p>wide</p></td></tr><tr><td><p>x</p></td><td><p>y</p></td></tr></tbody></table>' ), TABLE_OPTIONS );
    inst.editor.commands.setTextSelection( textPos( inst, 'y' ) );
    inst.runButton( 'cell_props' );
    change( fieldOf( 'Apply to' ), 'column' );
    change( fieldOf( 'Alignment' ), 'right' );
    ok();
    assert.equal( inst.getHTML(), '<p><table><tbody><tr><td align="right" colspan="2"><p>wide</p></td></tr><tr><td><p>x</p></td><td align="right"><p>y</p></td></tr></tbody></table></p>' );
} );

test( 'bold only switched on for the next typing (no text yet) is not offered as an element', () => {
    const inst = X.init( textarea( '<p>plain</p>' ), OPTIONS );
    inst.editor.commands.setTextSelection( textPos( inst, 'lain' ) );
    inst.editor.commands.toggleBold();
    inst.runButton( 'tag_props' );
    assert.equal( fieldOf( 'Element' ), null );
    assert.deepEqual( Array.prototype.map.call( fieldOf( 'Class' ).options, ( o ) => o.value ), [ '', 'intro', 'lead' ] );
    dialog().querySelector( '.exp-oe-dialog-close' ).click();
} );
