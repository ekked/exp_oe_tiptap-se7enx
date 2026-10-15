/**
 * The a4 skin (node --test, happy-dom): its stylesheet uses no image of ezoe's o2k7 skin, every toolbar icon of the
 * o2k7 look has a Bootstrap Icon, the editor loads no sprite with Skin=a4, and the floating menus (bubble over a
 * selection, "+" on an empty line) run the toolbar's commands with the toolbar's names.
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
const css = ( f ) => readFileSync( resolve( root, f ), 'utf8' );
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
const OPTIONS = {
    attributeId: 42, contentObjectId: 1, version: 1, language: 'eng-GB', rows: 10,
    buttons: [ 'formatselect', 'bold', 'italic', 'underline', '|', 'link', 'unlink', '|', 'image', 'object', 'table', 'literal' ],
    urls: { root: '/', ezoe: '/ezoe/', ezjscore: '/ezjscore/' }, formToken: 'TOKEN', i18n: {}, locale: 'en-GB', ai: { enabled: false }
};

test( 'the a4 stylesheets reference no image of the o2k7 skin', () => {
    for ( const f of [ 'src/css/skin-a4.css', 'src/css/skin-a4-icons.css' ] ) {
        const text = css( f );
        assert.doesNotMatch( text, /icons\.png|button_bg\.png|--exp-oe-icons|--exp-oe-button-bg|skins\/o2k7/, f );
        assert.doesNotMatch( text, /url\(\s*(?!["']?data:)/, f + ': only embedded icons, no file' );
    }
} );

test( 'every toolbar icon of the o2k7 look has a Bootstrap Icon in the a4 skin', () => {
    const o2k7 = new Set( [ ...css( 'src/css/exp_oe_tiptap.css' ).matchAll( /\.exp-oe-icon\.mce_(\w+)/g ) ].map( ( m ) => m[1] ) );
    const a4 = new Set( [ ...css( 'src/css/skin-a4-icons.css' ).matchAll( /\.exp-oe-icon\.mce_(\w+) \{ --exp-oe-a4-icon: url\("data:image\/svg\+xml,/g ) ].map( ( m ) => m[1] ) );
    const missing = [ ...o2k7 ].filter( ( n ) => !a4.has( n ) );
    assert.deepEqual( missing, [] );
    assert.ok( a4.has( 'plus' ), 'the "+" of the insert menu' );
} );

test( 'with Skin=a4 the editor sets no sprite and has the a4 class; o2k7 keeps its sprite', () => {
    const a4 = X.init( textarea( '<p>x</p>' ), Object.assign( {}, OPTIONS, { skin: 'a4' } ) );
    assert.ok( a4.wrapper.classList.contains( 'exp-oe-skin-a4' ) );
    assert.equal( a4.wrapper.style.getPropertyValue( '--exp-oe-icons' ), '' );
    assert.equal( a4.wrapper.style.getPropertyValue( '--exp-oe-button-bg' ), '' );
    const o2k7 = X.init( textarea( '<p>x</p>' ), OPTIONS );
    assert.match( o2k7.wrapper.style.getPropertyValue( '--exp-oe-icons' ), /icons\.png/ );
    assert.equal( o2k7.floating, null, 'no floating menus in the o2k7 look' );
} );

test( 'the floating menus offer only toolbar buttons, with their names, and run their commands', () => {
    const inst = X.init( textarea( '<p>Hello world</p>' ), Object.assign( {}, OPTIONS, { skin: 'a4' } ) );
    const bubble = inst.wrapper.querySelector( '.exp-oe-bubble' );
    const plusMenu = inst.wrapper.querySelector( '.exp-oe-plus-menu' );
    assert.equal( bubble.getAttribute( 'role' ), 'toolbar' );
    assert.deepEqual( [ ...bubble.querySelectorAll( 'button' ) ].map( ( b ) => b.className.replace( /.*exp-oe-button-/, '' ) ), [ 'bold', 'italic', 'underline', 'link', 'unlink' ] );
    assert.deepEqual( [ ...plusMenu.querySelectorAll( 'button' ) ].map( ( b ) => b.className.replace( /.*exp-oe-button-/, '' ) ), [ 'image', 'object', 'table', 'literal' ] );
    for ( const b of inst.wrapper.querySelectorAll( '.exp-oe-floating button' ) )
        assert.ok( b.getAttribute( 'aria-label' ), 'every floating button has a name' );
    inst.editor.commands.setTextSelection( { from: 1, to: 6 } );
    bubble.querySelector( '.exp-oe-button-bold' ).click();
    assert.match( inst.getHTML(), /<strong>Hello<\/strong> world/ );
} );
