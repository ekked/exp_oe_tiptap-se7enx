/**
 * Non-breaking space (node --test, happy-dom): the button nonbreaking and Ctrl+Shift+Space insert U+00A0, which the
 * posted HTML writes as &nbsp; and ezxmltext keeps as the character.
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

function editor( html, buttons ) {
    const t = document.createElement( 'textarea' );
    t.id = t.name = 'ContentObjectAttribute_data_text_' + Math.floor( Math.random() * 1e6 );
    t.value = html;
    form.appendChild( t );
    return X.init( t, {
        attributeId: 42, contentObjectId: 1, version: 1, language: 'eng-GB', rows: 10, skin: 'o2k7',
        buttons: buttons || [ 'bold', 'nonbreaking' ], urls: { root: '/', ezoe: '/ezoe/', ezjscore: '/ezjscore/' }, formToken: 'T', ai: { enabled: false }
    } );
}

test( 'the nonbreaking button inserts a non-breaking space; ezoe\'s sprite icon in o2k7', () => {
    const inst = editor( '<p>10km</p>' );
    assert.ok( inst.toolbar.controls.nonbreaking.querySelector( '.mce_nonbreaking' ) );
    inst.editor.commands.setTextSelection( 3 );
    inst.toolbar.controls.nonbreaking.click();
    assert.equal( inst.getHTML(), '<p>10&nbsp;km</p>' );
} );

test( 'Ctrl+Shift+Space inserts it without the button too, and replaces a selection', () => {
    const inst = editor( '<p>a b</p>', [ 'bold' ] );
    assert.equal( inst.toolbar.controls.nonbreaking, undefined );
    inst.editor.commands.setTextSelection( { from: 2, to: 3 } );
    const e = new KeyboardEvent( 'keydown', { key: ' ', code: 'Space', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true } );
    assert.equal( !!inst.editor.view.someProp( 'handleKeyDown', ( f ) => f( inst.editor.view, e ) ), true );
    assert.equal( inst.getHTML(), '<p>a&nbsp;b</p>' );
} );
