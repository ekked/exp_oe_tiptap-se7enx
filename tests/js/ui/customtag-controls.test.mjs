/**
 * UI tests of the custom tag controls and hidden custom tags (node --test, happy-dom): the bar on the focused
 * tag, moving, removing, the keyboard shortcuts, Backspace in an empty tag, labels, and the custom tag list
 * leaving out content.ini [CustomTagSettings] IsHidden[] tags.
 *
 * The controls are rebuilt from LoveStack's custom_tags_controls plugin (mugoweb/ezpublish-legacy, commit
 * 63334f1681, Copyright 2014, Mugo Web), hidden custom tags from commit e21ef46691.
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
    form.addEventListener( 'submit', ( e ) => e.preventDefault() );
    document.body.appendChild( form );
} );

function textarea( html ) {
    const t = document.createElement( 'textarea' );
    t.id = t.name = 'ContentObjectAttribute_data_text_' + Math.floor( Math.random() * 1e6 );
    t.value = html;
    form.appendChild( t );
    return t;
}

const TAGS = [
    { name: 'factbox', title: 'Fact box', inline: false, icon: '', hidden: false, preview: '', attributes: [] },
    { name: 'quote', title: 'Quote', inline: false, icon: '', hidden: true, preview: '', attributes: [] },
    { name: 'strike', title: 'strike', inline: true, icon: '', hidden: false, preview: '', attributes: [] }
];
const OPTIONS = {
    attributeId: 42, contentObjectId: 1, version: 1, language: 'eng-GB', rows: 10, buttons: [ 'custom' ],
    urls: { root: '/', ezoe: '/ezoe/', ezjscore: '/ezjscore/' }, formToken: 'TOKEN', i18n: {}, locale: 'en-GB',
    ai: { enabled: false }, customTags: TAGS, customTagControls: true
};
const DOC = '<p>first</p><div type="custom" class="ezoeItemCustomTag factbox"><p>box</p></div><p>last</p>';

/** a keydown through ProseMirror's key handling */
function key( inst, k, mods ) {
    const event = new KeyboardEvent( 'keydown', Object.assign( { key: k, bubbles: true, cancelable: true }, mods || {} ) );
    return inst.editor.view.someProp( 'handleKeyDown', ( f ) => f( inst.editor.view, event ) );
}

/** puts the caret into the text `text` */
function caretIn( inst, text ) {
    let at = null;
    inst.editor.state.doc.descendants( ( n, pos ) => {
        if ( at === null && n.isText && n.text.indexOf( text ) !== -1 )
            at = pos + 1;
    } );
    inst.editor.commands.setTextSelection( at );
}

const bar = ( inst ) => inst.contentArea.querySelector( '.exp-oe-custom-tag-controls' );

test( 'the bar shows on a focused custom tag only, with labelled buttons', () => {
    const inst = X.init( textarea( DOC ), OPTIONS );
    caretIn( inst, 'first' );
    assert.equal( bar( inst ).hidden, true );
    caretIn( inst, 'box' );
    assert.equal( bar( inst ).hidden, false );
    assert.equal( bar( inst ).getAttribute( 'role' ), 'toolbar' );
    const labels = Array.prototype.map.call( bar( inst ).querySelectorAll( 'button' ), ( b ) => b.getAttribute( 'aria-label' ) );
    assert.deepEqual( labels, [ 'Move the custom tag up', 'Move the custom tag down', 'Edit the custom tag', 'Remove the custom tag' ] );
} );

test( 'no bar and no shortcuts while the controls are off', () => {
    const inst = X.init( textarea( DOC ), Object.assign( {}, OPTIONS, { customTagControls: false } ) );
    caretIn( inst, 'box' );
    assert.equal( bar( inst ), null );
    assert.ok( !key( inst, 'ArrowUp', { altKey: true, shiftKey: true } ) );
} );

test( 'move up and down by button and by Alt+Shift+Up/Down; a tag moved last gets a paragraph after it', () => {
    const t = textarea( DOC );
    const inst = X.init( t, OPTIONS );
    caretIn( inst, 'box' );
    bar( inst ).querySelector( '.exp-oe-custom-tag-up' ).click();
    assert.match( t.value, /^<div[^>]*factbox[^>]*><p>box<\/p><\/div><p>first<\/p><p>last<\/p>$/ );
    assert.equal( bar( inst ).querySelector( '.exp-oe-custom-tag-up' ).disabled, true, 'first block: nothing to move above' );
    assert.ok( key( inst, 'ArrowDown', { altKey: true, shiftKey: true } ) );
    assert.match( t.value, /^<p>first<\/p><div[^>]*factbox[^>]*><p>box<\/p><\/div><p>last<\/p>$/ );
    assert.ok( key( inst, 'ArrowDown', { altKey: true, shiftKey: true } ) );
    // the paragraph to go on writing is in the editor, but an empty last paragraph is never posted
    assert.match( t.value, /^<p>first<\/p><p>last<\/p><div[^>]*factbox[^>]*><p>box<\/p><\/div>$/ );
    assert.equal( inst.editor.state.doc.lastChild.type.name, 'paragraph' );
    assert.equal( inst.editor.state.doc.lastChild.content.size, 0 );
    assert.ok( !t.value.includes( 'exp-oe-custom-tag' ), 'nothing of the controls in the saved text' );
} );

test( 'remove keeps the content, also with Alt+Shift+Delete', () => {
    const t = textarea( DOC );
    const inst = X.init( t, OPTIONS );
    caretIn( inst, 'box' );
    bar( inst ).querySelector( '.exp-oe-custom-tag-remove' ).click();
    assert.equal( t.value, '<p>first</p><p>box</p><p>last</p>' );

    const t2 = textarea( '<p>a <span type="custom" class="ezoeItemCustomTag strike">struck</span> b</p>' );
    const inst2 = X.init( t2, OPTIONS );
    caretIn( inst2, 'struck' );
    assert.ok( key( inst2, 'Delete', { altKey: true, shiftKey: true } ) );
    assert.equal( t2.value, '<p>a struck b</p>' );
} );

test( 'Backspace in an empty block custom tag removes it, in a filled one it does not', () => {
    const t = textarea( '<p>first</p><div type="custom" class="ezoeItemCustomTag factbox"><p></p></div>' );
    const inst = X.init( t, OPTIONS );
    let inside = null;
    inst.editor.state.doc.descendants( ( n, pos ) => {
        if ( n.type.name === 'ezCustomBlock' )
            inside = pos + 2;
    } );
    inst.editor.commands.setTextSelection( inside );
    assert.ok( key( inst, 'Backspace' ) );
    assert.ok( !t.value.includes( 'factbox' ) );

    const inst2 = X.init( textarea( DOC ), OPTIONS );
    caretIn( inst2, 'box' );
    assert.ok( !key( inst2, 'Backspace' ), 'a tag with text is left to the normal Backspace' );
} );

test( 'Alt+Shift+E opens the custom tag dialog of the focused tag', () => {
    const inst = X.init( textarea( DOC ), OPTIONS );
    caretIn( inst, 'box' );
    assert.ok( key( inst, 'E', { altKey: true, shiftKey: true } ) );
    const dlg = document.querySelector( '.exp-oe-dialog' );
    assert.ok( dlg );
    assert.equal( dlg.querySelector( 'select' ).value, 'factbox' );
} );

test( 'labels: one ::before rule per block custom tag', () => {
    const inst = X.init( textarea( DOC ), OPTIONS );
    assert.ok( inst.wrapper.classList.contains( 'exp-oe-custom-tag-labels' ) );
    const css = document.getElementById( 'exp-oe-custom-tag-labels' ).textContent;
    assert.match( css, /div\.ezoeItemCustomTag\.factbox::before \{ content: "Fact box"; \}/ );
    assert.ok( !/strike/.test( css ), 'inline tags get no label' );
} );

test( 'hidden custom tags are not offered for new tags but stay in the list of a hidden tag being edited', () => {
    const inst = X.init( textarea( '<p>text</p>' ), OPTIONS );
    caretIn( inst, 'text' );
    inst.toolbar.controls.custom.click();
    let names = Array.prototype.map.call( document.querySelectorAll( '.exp-oe-dialog select option' ), ( o ) => o.value );
    assert.deepEqual( names, [ 'factbox', 'strike' ] );
    document.querySelector( '.exp-oe-dialog-overlay' ).remove();

    const inst2 = X.init( textarea( '<div type="custom" class="ezoeItemCustomTag quote"><p>said</p></div>' ), OPTIONS );
    caretIn( inst2, 'said' );
    inst2.toolbar.controls.custom.click();
    const sel = document.querySelector( '.exp-oe-dialog select' );
    names = Array.prototype.map.call( sel.querySelectorAll( 'option' ), ( o ) => o.value );
    assert.deepEqual( names, [ 'factbox', 'quote', 'strike' ] );
    assert.equal( sel.value, 'quote' );
} );
