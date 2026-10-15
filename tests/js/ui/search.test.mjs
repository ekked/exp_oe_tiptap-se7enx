/**
 * Find and replace (node --test, happy-dom): Ctrl+F opens the bar with the selected text, the matches are marked, Enter
 * / Shift+Enter / F3 move, case sensitivity, replace and replace all (one undo), Escape closes; matches never cross a
 * paragraph or an inline object; read only editors cannot replace.
 *
 * @license GPL-2.0-or-later
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

let X, S, form;

before( async () => {
    GlobalRegistrator.register( { url: 'https://example.test/admin/content/edit/1/1' } );
    X = ( await import( '../../../src/js/index.js' ) ).default;
    S = await import( '../../../src/js/editor/search.js' );
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
        buttons: [ 'bold', '|', 'search', 'replace', 'undo' ], urls: { root: '/', ezoe: '/ezoe/', ezjscore: '/ezjscore/' }, formToken: 'T', ai: { enabled: false },
        i18n: { '%1 of %2': '%1 von %2' }
    }, extra || {} ) );
}

const press = ( inst, key, init ) => {
    const e = new KeyboardEvent( 'keydown', Object.assign( { key, bubbles: true, cancelable: true }, init || {} ) );
    return !!inst.editor.view.someProp( 'handleKeyDown', ( f ) => f( inst.editor.view, e ) );
};
const keydown = ( target, key, init ) => target.dispatchEvent( new KeyboardEvent( 'keydown', Object.assign( { key, bubbles: true, cancelable: true }, init || {} ) ) );
const type = ( input, value ) => {
    input.value = value;
    input.dispatchEvent( new Event( 'input', { bubbles: true } ) );
};
const marks = ( inst ) => Array.prototype.map.call( inst.editor.view.dom.querySelectorAll( '.exp-oe-search-match' ), ( m ) => m.textContent );

test( 'findMatches: literal text, with or without case, never across blocks or inline objects', () => {
    const inst = editor( '<p>Tea and tea (t.a)</p><p>te</p><p>a te<a name="x" class="mceItemAnchor"></a>a</p>' );
    const doc = inst.editor.state.doc;
    assert.equal( S.findMatches( doc, 'tea', false ).length, 2 );
    assert.equal( S.findMatches( doc, 'tea', true ).length, 1 );
    assert.equal( S.findMatches( doc, '(t.a)', false ).length, 1, 'no regular expression' );
    assert.equal( S.findMatches( doc, 'tea', false ).every( ( m ) => doc.textBetween( m.from, m.to ).toLowerCase() === 'tea' ), true );
    assert.equal( S.findMatches( doc, 'tea', false ).length, 2, 'not across the paragraph or the anchor' );
} );

test( 'Ctrl+F opens the bar with the selected text, marks the matches and counts them', () => {
    const inst = editor( '<p>one two one two one</p>' );
    inst.editor.commands.setTextSelection( { from: 1, to: 4 } );
    assert.equal( press( inst, 'f', { ctrlKey: true } ), true, 'handled: the browser\'s find does not open' );
    const bar = inst.wrapper.querySelector( '.exp-oe-searchbar' );
    assert.equal( bar.hidden, false );
    assert.equal( bar.getAttribute( 'role' ), 'search' );
    const find = bar.querySelector( '.exp-oe-search-find' );
    assert.equal( find.value, 'one' );
    assert.equal( document.activeElement, find );
    assert.deepEqual( marks( inst ), [ 'one', 'one', 'one' ] );
    assert.equal( bar.querySelector( '.exp-oe-search-status' ).textContent, '1 von 3' );
    assert.equal( bar.querySelector( '.exp-oe-search-status' ).getAttribute( 'aria-live' ), 'polite' );
    // Enter, Shift+Enter, F3
    keydown( find, 'Enter' );
    assert.equal( bar.querySelector( '.exp-oe-search-status' ).textContent, '2 von 3' );
    assert.equal( inst.editor.state.doc.textBetween( inst.editor.state.selection.from, inst.editor.state.selection.to ), 'one' );
    keydown( find, 'Enter', { shiftKey: true } );
    keydown( find, 'Enter', { shiftKey: true } );
    assert.equal( bar.querySelector( '.exp-oe-search-status' ).textContent, '3 von 3' );
    keydown( find, 'F3' );
    assert.equal( bar.querySelector( '.exp-oe-search-status' ).textContent, '1 von 3' );
    assert.equal( inst.editor.view.dom.querySelectorAll( '.exp-oe-search-current' ).length, 1 );
    // nothing found
    type( find, 'three' );
    assert.equal( bar.querySelector( '.exp-oe-search-status' ).textContent, 'No matches' );
    assert.equal( find.getAttribute( 'aria-invalid' ), 'true' );
    assert.equal( bar.querySelector( '[title="Replace all"]' ).disabled, true );
    // Escape: closed, no marks, the focus in the text
    keydown( find, 'Escape' );
    assert.equal( bar.hidden, true );
    assert.deepEqual( marks( inst ), [] );
    assert.equal( document.activeElement, inst.editor.view.dom );
} );

test( 'match case, replace one by one and replace all in one undo step', () => {
    const inst = editor( '<p>Cat cat CAT cat</p>' );
    inst.runButton( 'replace' );
    const bar = inst.wrapper.querySelector( '.exp-oe-searchbar' );
    const find = bar.querySelector( '.exp-oe-search-find' ), replace = bar.querySelector( '.exp-oe-search-replace' );
    type( find, 'cat' );
    assert.equal( marks( inst ).length, 4 );
    const box = bar.querySelector( 'input[type="checkbox"]' );
    box.checked = true;
    box.dispatchEvent( new Event( 'change' ) );
    assert.deepEqual( marks( inst ), [ 'cat', 'cat' ] );
    replace.value = 'dog';
    keydown( replace, 'Enter' );
    assert.equal( inst.getHTML(), '<p>Cat dog CAT cat</p>' );
    assert.equal( bar.querySelector( '.exp-oe-search-status' ).textContent, '1 von 1' );
    box.checked = false;
    box.dispatchEvent( new Event( 'change' ) );
    bar.querySelector( '[title="Replace all"]' ).click();
    assert.equal( inst.getHTML(), '<p>dog dog dog dog</p>' );
    assert.equal( bar.querySelector( '.exp-oe-search-status' ).textContent, '3 replaced' );
    inst.editor.commands.undo();
    assert.equal( inst.getHTML(), '<p>Cat dog CAT cat</p>' );
} );

test( 'formatting of a replaced word stays; replacing is off in a read only editor', () => {
    const inst = editor( '<p>a <strong>bold</strong> word</p>' );
    inst.runButton( 'search' );
    const bar = inst.wrapper.querySelector( '.exp-oe-searchbar' );
    type( bar.querySelector( '.exp-oe-search-find' ), 'bold' );
    bar.querySelector( '.exp-oe-search-replace' ).value = 'strong';
    bar.querySelector( '[title="Replace"]' ).click();
    assert.equal( inst.getHTML(), '<p>a <strong>strong</strong> word</p>' );
    inst.setLocked( true );
    type( bar.querySelector( '.exp-oe-search-find' ), 'word' );
    assert.equal( bar.querySelector( '[title="Replace"]' ).disabled, true );
    assert.equal( bar.querySelector( '.exp-oe-search-replace' ).disabled, true );
    assert.equal( bar.querySelector( '[title^="Next match"]' ).disabled, false );
} );
