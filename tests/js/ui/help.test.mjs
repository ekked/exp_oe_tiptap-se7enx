/**
 * The help (node --test, happy-dom): tabs for the toolbar (only this editor's buttons, with icon and text), the
 * keyboard, the tags, tips and about; tab pattern with the arrow keys; every text translated.
 *
 * @license GPL-2.0-or-later
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

const root = resolve( dirname( fileURLToPath( import.meta.url ) ), '../../..' );
let X, H, form;

before( async () => {
    GlobalRegistrator.register( { url: 'https://example.test/admin/content/edit/1/1' } );
    X = ( await import( '../../../src/js/index.js' ) ).default;
    H = await import( '../../../src/js/ui/help.js' );
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

function editor( extra ) {
    const t = document.createElement( 'textarea' );
    t.id = t.name = 'ContentObjectAttribute_data_text_' + Math.floor( Math.random() * 1e6 );
    t.value = '<p>x</p>';
    form.appendChild( t );
    return X.init( t, Object.assign( {
        attributeId: 42, contentObjectId: 1, version: 1, language: 'eng-GB', rows: 10, skin: 'a4',
        buttons: [ 'formatselect', 'bold', 'italic', '|', 'link', 'table', '|', 'search', 'help' ],
        urls: { root: '/', ezoe: '/ezoe/', ezjscore: '/ezjscore/' }, formToken: 'T', ai: { enabled: false },
        i18n: { Keyboard: 'Tastatur', 'Make the selected text bold. If it is bold already, the formatting is removed.': 'Fett.' }
    }, extra || {} ) );
}

test( 'Alt+0 / the help button: tabs Toolbar, Keyboard, Tags, Tips, About; the toolbar tab describes this toolbar', () => {
    const inst = editor();
    inst.runButton( 'help' );
    const dialog = document.querySelector( '.exp-oe-dialog.exp-oe-help' );
    assert.ok( dialog );
    const tabs = Array.prototype.slice.call( dialog.querySelectorAll( '[role="tab"]' ) );
    assert.deepEqual( tabs.map( ( b ) => b.textContent ), [ 'Toolbar', 'Tastatur', 'Tags', 'Tips', 'About' ] );
    const panels = dialog.querySelectorAll( '[role="tabpanel"]' );
    assert.equal( panels.length, 5 );
    assert.equal( panels[0].hidden, false );
    const rows = Array.prototype.map.call( panels[0].querySelectorAll( 'tbody th' ), ( th ) => th.textContent );
    assert.deepEqual( rows, [ 'Format', 'Bold (Ctrl+B)', 'Italic (Ctrl+I)', 'Insert/edit link', 'Insert/edit table', 'Find (Ctrl+F)', 'Help (Alt+0)' ] );
    assert.equal( panels[0].querySelector( 'tbody td' ).textContent, H.BUTTON_HELP.formatselect );
    assert.equal( panels[0].querySelectorAll( 'tbody td' )[1].textContent, 'Fett.' );
    assert.ok( panels[0].querySelector( '.mce_bold' ) );
    // the tab pattern: arrow keys move and show
    tabs[0].focus();
    tabs[0].dispatchEvent( new KeyboardEvent( 'keydown', { key: 'ArrowRight', bubbles: true } ) );
    assert.equal( document.activeElement, tabs[1] );
    assert.equal( tabs[1].getAttribute( 'aria-selected' ), 'true' );
    assert.equal( panels[0].hidden, true );
    assert.equal( panels[1].hidden, false );
    assert.match( panels[1].textContent, /Ctrl\+Shift\+V/ );
    assert.doesNotMatch( panels[1].textContent, /Alt\+Shift\+E/ );
    tabs[1].dispatchEvent( new KeyboardEvent( 'keydown', { key: 'End', bubbles: true } ) );
    assert.equal( document.activeElement, tabs[4] );
} );

test( 'the custom tag shortcuts are listed where the custom tag controls are on', () => {
    const inst = editor( { customTagControls: true } );
    inst.runButton( 'help' );
    assert.match( document.querySelectorAll( '.exp-oe-help [role="tabpanel"]' )[1].textContent, /Alt\+Shift\+E/ );
} );

test( 'every button of the registry that does something visible has a help text, and every help text is a string of the build', () => {
    const inst = editor();
    for ( const name of Object.keys( inst.commands ) )
        assert.ok( H.BUTTON_HELP[name], 'help text for ' + name );
    const strings = JSON.parse( readFileSync( resolve( root, 'design/standard/javascript/exp_oe_tiptap/strings.json' ), 'utf8' ) );
    for ( const text of Object.values( H.BUTTON_HELP ).concat( H.TAG_HELP.map( ( r ) => r[1] ), Object.values( H.TIPS ), H.SHORTCUTS.map( ( r ) => r[1] ) ) )
        assert.ok( strings.indexOf( text ) !== -1, 'in strings.json: ' + text );
} );
