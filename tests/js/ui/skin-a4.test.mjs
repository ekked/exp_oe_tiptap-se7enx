/**
 * The a4 skin (node --test, happy-dom): its stylesheet uses no image of ezoe's o2k7 skin, every toolbar icon of the
 * o2k7 look has an icon (Tiptap's own, Lucide where Tiptap has none) with its licence shipped, the editor loads no sprite with Skin=a4, and the floating menus (bubble over a
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

test( 'every toolbar icon of the o2k7 look has an icon in the a4 skin', () => {
    const o2k7 = new Set( [ ...css( 'src/css/exp_oe_tiptap.css' ).matchAll( /\.exp-oe-icon\.mce_(\w+)/g ) ].map( ( m ) => m[1] ) );
    const a4 = new Set( [ ...css( 'src/css/skin-a4-icons.css' ).matchAll( /\.exp-oe-icon\.mce_(\w+) \{ --exp-oe-a4-icon: url\("data:image\/svg\+xml,/g ) ].map( ( m ) => m[1] ) );
    const missing = [ ...o2k7 ].filter( ( n ) => !a4.has( n ) );
    assert.deepEqual( missing, [] );
    assert.ok( a4.has( 'plus' ), 'the "+" of the insert menu' );
} );

test( 'the icon sources and their licences are shipped; the marks use Tiptap\'s own icons', () => {
    for ( const f of [ 'src/icons/NOTICE', 'src/icons/tiptap/LICENSE', 'src/icons/lucide/LICENSE', 'tools/build-skin-a4.py' ] )
        assert.ok( readFileSync( resolve( root, f ), 'utf8' ).length > 100, f );
    assert.match( css( 'src/icons/tiptap/LICENSE' ), /MIT License[\s\S]*Tiptap/ );
    assert.match( css( 'src/icons/lucide/LICENSE' ), /ISC License/ );
    assert.match( css( 'src/icons/lucide/LICENSE' ), /MIT License[\s\S]*Copyright \(c\) 2013-present Cole Bemis[\s\S]*Permission is hereby granted/, 'the Feather part, MIT' );
    assert.match( css( 'src/icons/NOTICE' ), /799929bea4804c73767562b69f8acc2acdb8ac86/ );
    assert.match( css( 'src/icons/NOTICE' ), /lucide-static 0\.468\.0/ );
    const tool = css( 'tools/build-skin-a4.py' );
    for ( const name of [ 'bold', 'italic', 'underline', 'link', 'bullist', 'numlist', 'undo', 'redo' ] )
        assert.match( tool, new RegExp( "'" + name + "': 'tiptap/" ), name + ' uses Tiptap\'s icon' );
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

/** Specificity of one simple selector as a comparable number (ids, classes/attributes/pseudo-classes, types) */
function specificity( selector ) {
    const sel = selector.replace( /:not\(([^)]*)\)/g, ' $1' ).replace( /::[\w-]+/g, '' );
    const ids = ( sel.match( /#[\w-]+/g ) || [] ).length;
    const classes = ( sel.match( /\.[\w-]+|\[[^\]]+\]|:[\w-]+/g ) || [] ).length;
    const types = ( sel.replace( /\[[^\]]+\]/g, '' ).match( /(^|[\s>+~])[a-z][\w-]*/gi ) || [] ).length;
    return ids * 10000 + classes * 100 + types;
}

test( 'a hidden floating element stays hidden: no later display rule outweighs its [hidden] rule', () => {
    for ( const f of [ 'src/css/skin-a4.css', 'design/standard/stylesheets/exp_oe_tiptap/exp_oe_tiptap.css' ] ) {
        const rules = [ ...css( f ).replace( /\/\*[\s\S]*?\*\//g, '' ).matchAll( /([^{}]+)\{([^{}]*)\}/g ) ]
            .flatMap( ( m, index ) => m[1].split( ',' ).map( ( s ) => ( { selector: s.trim(), body: m[2], index } ) ) );
        for ( const el of [ 'exp-oe-plus', 'exp-oe-bubble', 'exp-oe-plus-menu' ] ) {
            const target = new RegExp( '\\.' + el + '(?![\\w-])([^\\s>+~]*)$' );
            const hidden = rules.find( ( r ) => target.test( r.selector ) && /\[hidden\]$/.test( r.selector ) && /display:\s*none/.test( r.body ) );
            assert.ok( hidden, f + ': .' + el + '[hidden] { display: none }' );
            for ( const r of rules ) {
                if ( !target.test( r.selector ) || /\[hidden\]/.test( r.selector ) || !/display:\s*(?!none)/.test( r.body ) )
                    continue;
                const a = specificity( hidden.selector ), b = specificity( r.selector );
                assert.ok( a > b || ( a === b && hidden.index > r.index ),
                           f + ': "' + r.selector + '" sets display and outweighs "' + hidden.selector + '"; add :not([hidden])' );
            }
        }
    }
} );

function keydown( target, key ) {
    const e = new KeyboardEvent( 'keydown', { key, bubbles: true, cancelable: true } );
    target.dispatchEvent( e );
    return e;
}

test( 'the "+" is a menu button that controls the insert menu; the menu is operated with the arrow keys', () => {
    const inst = X.init( textarea( '<p>Hello</p><p></p>' ), Object.assign( {}, OPTIONS, { skin: 'a4' } ) );
    const plus = inst.wrapper.querySelector( '.exp-oe-plus' );
    const menu = inst.wrapper.querySelector( '.exp-oe-plus-menu' );
    assert.equal( plus.getAttribute( 'aria-haspopup' ), 'menu' );
    assert.equal( plus.getAttribute( 'aria-controls' ), menu.id );
    assert.ok( menu.id && document.getElementById( menu.id ) === menu );
    const items = [ ...menu.querySelectorAll( '[role="menuitem"]' ) ];
    assert.equal( items.length, 4 );
    assert.ok( items.every( ( b ) => b.tabIndex === -1 ), 'closed: no item in the tab order' );

    plus.focus();
    keydown( plus, 'ArrowDown' );
    assert.equal( menu.hidden, false );
    assert.equal( plus.getAttribute( 'aria-expanded' ), 'true' );
    assert.equal( document.activeElement, items[0] );
    assert.deepEqual( items.map( ( b ) => b.tabIndex ), [ 0, -1, -1, -1 ] );
    keydown( items[0], 'ArrowDown' );
    assert.equal( document.activeElement, items[1] );
    assert.deepEqual( items.map( ( b ) => b.tabIndex ), [ -1, 0, -1, -1 ] );
    keydown( items[1], 'End' );
    assert.equal( document.activeElement, items[3] );
    keydown( items[3], 'ArrowDown' );
    assert.equal( document.activeElement, items[0], 'wraps to the first' );
    keydown( items[0], 'ArrowUp' );
    assert.equal( document.activeElement, items[3], 'wraps to the last' );
    keydown( items[3], 'Home' );
    assert.equal( document.activeElement, items[0] );

    // Escape in the menu closes it and returns to the "+"
    keydown( items[0], 'Escape' );
    assert.equal( menu.hidden, true );
    assert.equal( plus.getAttribute( 'aria-expanded' ), 'false' );
    assert.equal( document.activeElement, plus );

    // up arrow opens on the last item
    keydown( plus, 'ArrowUp' );
    assert.equal( document.activeElement, items[3] );
} );

test( 'the bubble toolbar has one button in the tab order and moves with left/right, Home and End', () => {
    const inst = X.init( textarea( '<p>Hello world</p>' ), Object.assign( {}, OPTIONS, { skin: 'a4' } ) );
    const items = [ ...inst.wrapper.querySelectorAll( '.exp-oe-bubble button' ) ];
    assert.deepEqual( items.map( ( b ) => b.tabIndex ), [ 0, -1, -1, -1, -1 ] );
    items[0].focus();
    keydown( items[0], 'ArrowRight' );
    assert.equal( document.activeElement, items[1] );
    assert.deepEqual( items.map( ( b ) => b.tabIndex ), [ -1, 0, -1, -1, -1 ] );
    keydown( items[1], 'ArrowLeft' );
    assert.equal( document.activeElement, items[0] );
    keydown( items[0], 'ArrowLeft' );
    assert.equal( document.activeElement, items[items.length - 1], 'wraps' );
    keydown( items[4], 'Home' );
    assert.equal( document.activeElement, items[0] );
    items[2].disabled = true;
    keydown( items[0], 'End' );
    keydown( items[4], 'ArrowLeft' );
    keydown( document.activeElement, 'ArrowLeft' );
    assert.equal( document.activeElement, items[1], 'skips a disabled button' );
} );

test( 'Escape in the editor and a click outside close the insert menu', () => {
    const inst = X.init( textarea( '<p>Hello</p>' ), Object.assign( {}, OPTIONS, { skin: 'a4' } ) );
    const plus = inst.wrapper.querySelector( '.exp-oe-plus' );
    const menu = inst.wrapper.querySelector( '.exp-oe-plus-menu' );
    inst.floating.openPlusMenu( false );
    assert.equal( menu.hidden, false );
    const e = keydown( inst.editor.view.dom, 'Escape' );
    assert.equal( menu.hidden, true );
    assert.equal( plus.getAttribute( 'aria-expanded' ), 'false' );
    assert.ok( e.defaultPrevented, 'the editor consumed the Escape' );
    assert.ok( !keydown( inst.editor.view.dom, 'Escape' ).defaultPrevented, 'with no menu open Escape passes through' );

    inst.floating.openPlusMenu( false );
    document.body.dispatchEvent( new MouseEvent( 'mousedown', { bubbles: true } ) );
    assert.equal( menu.hidden, true, 'a click outside closes it' );
    inst.floating.openPlusMenu( false );
    menu.dispatchEvent( new MouseEvent( 'mousedown', { bubbles: true } ) );
    assert.equal( menu.hidden, false, 'a click inside does not' );
} );

test( 'a blur that moves the focus into the insert menu keeps the menu open; a blur elsewhere hides it', async () => {
    const inst = X.init( textarea( '<p>Hello</p>' ), Object.assign( {}, OPTIONS, { skin: 'a4' } ) );
    const f = inst.floating;
    const menu = inst.wrapper.querySelector( '.exp-oe-plus-menu' );
    f.openPlusMenu( false );
    // the editor's blur arrives while document.activeElement is still the body, before the focus lands in the menu
    document.activeElement.blur();
    f.update( false );
    assert.equal( menu.hidden, false, 'not hidden while the focus is on its way' );
    f.menuItems[0].focus();
    await new Promise( ( r ) => setTimeout( r, 5 ) );
    assert.equal( menu.hidden, false, 'the focus landed in the menu: it stays open' );

    document.activeElement.blur();
    f.update( false );
    await new Promise( ( r ) => setTimeout( r, 5 ) );
    assert.equal( menu.hidden, true, 'the focus went elsewhere: hidden' );
} );

test( 'the a4 skin takes its radius, stacking, control height and type sizes from the --a4-* tokens', () => {
    const text = css( 'src/css/skin-a4.css' ).replace( /\/\*[\s\S]*?\*\//g, '' );
    for ( const m of text.matchAll( /border-radius:\s*([^;]+);/g ) )
        assert.match( m[1], /^(var\(--exp-oe-a4-radius[^;]*|0 0 var\(--exp-oe-a4-radius\) var\(--exp-oe-a4-radius\)|var\(--exp-oe-a4-radius\) var\(--exp-oe-a4-radius\) 0 0|50%)$/, 'one radius token: ' + m[1] );
    for ( const m of text.matchAll( /z-index:\s*([^;]+);/g ) )
        assert.match( m[1], /^var\(--a4-z-[a-z-]+, \d+\)$/, 'a stacking layer token: ' + m[1] );
    for ( const m of text.matchAll( /(?:^|[;{\s])(?:width|height):\s*32px/g ) )
        assert.fail( 'the control height is --a4-control-h: ' + m[0] );
    for ( const m of text.matchAll( /font(?:-size)?:\s*(\d+px)/g ) )
        assert.fail( 'a type size token, not ' + m[1] );
} );
