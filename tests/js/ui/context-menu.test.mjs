/**
 * The context menu (node --test, happy-dom): right click, the context menu key and Shift+F10 open a menu with the
 * commands at the cursor; ARIA menu with the arrow keys; Ctrl+right click and a second right click leave the
 * browser's menu; ContextMenu=disabled switches it off.
 *
 * @license GPL-2.0-or-later
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

let X, form, NodeSelection;

before( async () => {
    GlobalRegistrator.register( { url: 'https://example.test/admin/content/edit/1/1' } );
    X = ( await import( '../../../src/js/index.js' ) ).default;
    ( { NodeSelection } = await import( '@tiptap/pm/state' ) );
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

function editor( html, extra ) {
    const t = document.createElement( 'textarea' );
    t.id = t.name = 'ContentObjectAttribute_data_text_' + Math.floor( Math.random() * 1e6 );
    t.value = html;
    form.appendChild( t );
    return X.init( t, Object.assign( {
        attributeId: 42, contentObjectId: 1, version: 1, language: 'eng-GB', rows: 10, skin: 'a4',
        buttons: [ 'bold', '|', 'link' ], urls: { root: '/', ezoe: '/ezoe/', ezjscore: '/ezjscore/' }, formToken: 'T', ai: { enabled: false },
        customTags: [ { name: 'factbox', title: 'Fact box', inline: false, attributes: [] } ],
        i18n: { 'Edit link': 'Link bearbeiten' }
    }, extra || {} ) );
}

function textPos( inst, text ) {
    let pos = null;
    inst.editor.state.doc.descendants( ( node, p ) => {
        if ( pos === null && node.isText && node.text.indexOf( text ) !== -1 )
            pos = p + node.text.indexOf( text ) + 1;
    } );
    return pos;
}

const menu = ( inst ) => inst.wrapper.querySelector( '.exp-oe-context-menu' );
const labels = ( inst ) => Array.prototype.map.call( menu( inst ).querySelectorAll( '[role="menuitem"]' ), ( b ) => b.textContent );
const keydown = ( target, key, init ) => {
    const e = new KeyboardEvent( 'keydown', Object.assign( { key, bubbles: true, cancelable: true }, init || {} ) );
    target.dispatchEvent( e );
    return e;
};
const contextmenu = ( target, init ) => {
    const e = new MouseEvent( 'contextmenu', Object.assign( { bubbles: true, cancelable: true, button: 2 }, init || {} ) );
    target.dispatchEvent( e );
    return e;
};

test( 'Shift+F10 in a link: edit and remove the link, the tag properties; a menu of menu items with the first one focused', () => {
    const inst = editor( '<p>see <a href="https://example.org/">the site</a> now</p>' );
    inst.editor.commands.setTextSelection( textPos( inst, 'site' ) );
    const e = keydown( inst.editor.view.dom, 'F10', { shiftKey: true } );
    assert.equal( e.defaultPrevented, true );
    assert.equal( menu( inst ).hidden, false );
    assert.equal( menu( inst ).getAttribute( 'role' ), 'menu' );
    assert.deepEqual( labels( inst ), [ 'Link bearbeiten', 'Remove link', 'Tag properties' ] );
    assert.equal( menu( inst ).querySelectorAll( '[role="separator"]' ).length, 1 );
    const items = menu( inst ).querySelectorAll( '[role="menuitem"]' );
    assert.equal( document.activeElement, items[0] );
    keydown( items[0], 'ArrowDown' );
    assert.equal( document.activeElement, items[1] );
    keydown( items[1], 'End' );
    assert.equal( document.activeElement, items[2] );
    keydown( items[2], 'ArrowDown' );
    assert.equal( document.activeElement, items[0] );
    // "Remove link" runs the toolbar's unlink
    items[1].click();
    assert.equal( menu( inst ).hidden, true );
    assert.equal( inst.getHTML(), '<p>see the site now</p>' );
} );

test( 'Escape closes the menu and returns to the text; the context menu key opens it too', () => {
    const inst = editor( '<p>text</p>' );
    inst.editor.commands.setTextSelection( 2 );
    keydown( inst.editor.view.dom, 'ContextMenu' );
    assert.equal( menu( inst ).hidden, false );
    keydown( document.activeElement, 'Escape' );
    assert.equal( menu( inst ).hidden, true );
    assert.equal( document.activeElement, inst.editor.view.dom );
} );

test( 'in a table: table, row and cell properties, insert and delete rows and columns, delete table', () => {
    const inst = editor( '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>' );
    inst.editor.commands.setTextSelection( textPos( inst, 'a' ) );
    keydown( inst.editor.view.dom, 'F10', { shiftKey: true } );
    assert.deepEqual( labels( inst ), [ 'Table properties', 'Table row properties', 'Table cell properties',
        'Insert row before', 'Insert row after', 'Insert column before', 'Insert column after', 'Delete row', 'Delete column',
        'Delete table', 'Tag properties' ] );
    // merge and split only when they can run; three separators between four groups
    assert.equal( menu( inst ).querySelectorAll( '[role="separator"]' ).length, 3 );
    Array.prototype.find.call( menu( inst ).querySelectorAll( '[role="menuitem"]' ), ( b ) => b.textContent === 'Insert column after' ).click();
    assert.equal( inst.getHTML().match( /<td>/g ).length, 3 );
} );

test( 'a selected embed: edit it; a custom tag: edit it', () => {
    const inst = editor( '<p>x <img id="eZObject_57" src="/i.png" alt="medium" view="embed" inline="true" class="ezoeItemContentTypeImages"></p><div type="custom" class="ezoeItemCustomTag factbox"><p>fact</p></div>' );
    let pos = null;
    inst.editor.state.doc.descendants( ( n, p ) => {
        if ( pos === null && n.isAtom && n.isInline && !n.isText )
            pos = p;
    } );
    inst.editor.view.dispatch( inst.editor.state.tr.setSelection( NodeSelection.create( inst.editor.state.doc, pos ) ) );
    keydown( inst.editor.view.dom, 'F10', { shiftKey: true } );
    assert.deepEqual( labels( inst ), [ 'Edit image', 'Tag properties' ] );
    keydown( document.activeElement, 'Escape' );
    inst.editor.commands.setTextSelection( textPos( inst, 'fact' ) );
    keydown( inst.editor.view.dom, 'F10', { shiftKey: true } );
    assert.deepEqual( labels( inst ), [ 'Edit custom tag', 'Tag properties' ] );
} );

test( 'right click: the menu at the pointer; with Ctrl held, or a second right click, the browser\'s own menu', () => {
    const inst = editor( '<p>text</p>' );
    inst.editor.commands.setTextSelection( 2 );
    const first = contextmenu( inst.editor.view.dom, { clientX: 40, clientY: 30 } );
    assert.equal( first.defaultPrevented, true );
    assert.equal( menu( inst ).hidden, false );
    assert.equal( menu( inst ).style.left, '40px' );
    // the second right click: mousedown closes, the contextmenu event is left to the browser
    document.body.dispatchEvent( new MouseEvent( 'mousedown', { bubbles: true, button: 2 } ) );
    assert.equal( menu( inst ).hidden, true );
    const second = contextmenu( inst.editor.view.dom, { clientX: 40, clientY: 30 } );
    assert.equal( second.defaultPrevented, false );
    assert.equal( menu( inst ).hidden, true );
    const ctrl = contextmenu( inst.editor.view.dom, { clientX: 40, clientY: 30, ctrlKey: true } );
    assert.equal( ctrl.defaultPrevented, false );
    assert.equal( menu( inst ).hidden, true );
} );

test( 'ContextMenu=disabled: no menu, the browser\'s one', () => {
    const inst = editor( '<p>text</p>', { contextMenu: false } );
    assert.equal( menu( inst ), null );
    const e = contextmenu( inst.editor.view.dom, { clientX: 10, clientY: 10 } );
    assert.equal( e.defaultPrevented, false );
} );

test( 'Tab closes the menu and returns to the text', () => {
    const inst = editor( '<p>text</p>' );
    inst.editor.commands.setTextSelection( 2 );
    keydown( inst.editor.view.dom, 'F10', { shiftKey: true } );
    const e = new KeyboardEvent( 'keydown', { key: 'Tab', bubbles: true, cancelable: true } );
    document.activeElement.dispatchEvent( e );
    assert.equal( menu( inst ).hidden, true );
    assert.equal( document.activeElement, inst.editor.view.dom );
} );
