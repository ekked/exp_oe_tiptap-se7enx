/**
 * Keyboard shortcuts as the platform names them (node --test, happy-dom): ⌘ ⇧ ⌥ ⌃ on a Mac in the order of its
 * menus, the translated modifier names elsewhere; tooltips, the help's keyboard table and tips, the custom tag
 * controls and the source view's hint; every key binding uses Tiptap's Mod- where it means Cmd on a Mac.
 *
 * @license GPL-2.0-or-later
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

const root = resolve( dirname( fileURLToPath( import.meta.url ) ), '../../..' );
let X, K, D, form, platform;

const GERMAN = { Ctrl: 'Strg', Shift: 'Umschalt', Alt: 'Alt', Space: 'Leertaste', Enter: 'Eingabe', Escape: 'Esc', Up: 'Nach oben', Down: 'Nach unten',
                 Delete: 'Entf', 'Bold (Ctrl+B)': 'Fett (Strg+B)', 'Paste as text (Ctrl+Shift+V)': 'Als Text einfügen (Strg+Umschalt+V)' };

/** navigator.platform as the editor reads it (ProseMirror's keymap reads it once, on import) */
function setPlatform( value ) {
    Object.defineProperty( navigator, 'platform', { value, configurable: true } );
}

before( async () => {
    GlobalRegistrator.register( { url: 'https://example.test/admin/content/edit/1/1' } );
    platform = navigator.platform;
    X = ( await import( '../../../src/js/index.js' ) ).default;
    K = await import( '../../../src/js/ui/keys.js' );
    D = await import( '../../../src/js/ui/dom.js' );
} );
after( async () => {
    for ( const i of X.instances.slice() )
        X.destroy( i.textarea );
    await GlobalRegistrator.unregister();
} );
beforeEach( () => {
    setPlatform( platform );
    for ( const i of X.instances.slice() )
        X.destroy( i.textarea );
    document.body.innerHTML = '';
    form = document.createElement( 'form' );
    document.body.appendChild( form );
} );

function editor( i18n, extra ) {
    const t = document.createElement( 'textarea' );
    t.id = t.name = 'ContentObjectAttribute_data_text_' + Math.floor( Math.random() * 1e6 );
    t.value = '<p>x</p>';
    form.appendChild( t );
    return X.init( t, Object.assign( {
        attributeId: 42, rows: 10, buttons: [ 'bold', 'undo', 'redo', 'pastetext', 'search', 'nonbreaking', 'code', 'help' ],
        urls: { root: '/', ezoe: '/ezoe/', ezjscore: '/ezjscore/' }, formToken: 'T', ai: { enabled: false }, i18n: i18n || {}
    }, extra || {} ) );
}

test( 'isMac() decides as ProseMirror\'s keymap does', () => {
    assert.equal( K.isMac( { platform: 'MacIntel' } ), true );
    assert.equal( K.isMac( { platform: 'iPad' } ), true );
    assert.equal( K.isMac( { platform: 'Win32' } ), false );
    assert.equal( K.isMac( { platform: 'Linux x86_64' } ), false );
    assert.equal( K.isMac( {} ), false );
} );

test( 'formatKeys on a Mac: symbols in the order of the menus, Ctrl is Cmd unless it means the Control key', () => {
    const mac = ( s, o ) => K.formatKeys( s, Object.assign( { mac: true }, o ) );
    assert.equal( mac( 'Bold (Ctrl+B)' ), 'Bold (⌘B)' );
    assert.equal( mac( 'Paste as text (Ctrl+Shift+V)' ), 'Paste as text (⇧⌘V)' );
    assert.equal( mac( 'Redo: Ctrl+Y / Ctrl+Shift+Z.' ), 'Redo: ⌘Y / ⇧⌘Z.' );
    assert.equal( mac( 'Ctrl+1 ... Ctrl+6' ), '⌘1 ... ⌘6' );
    assert.equal( mac( 'Help (Alt+0)' ), 'Help (⌥0)' );
    assert.equal( mac( 'Alt+Shift+E' ), '⌥⇧E' );
    assert.equal( mac( 'Ctrl+Shift+Space' ), '⇧⌘Space' );
    assert.equal( mac( 'F3 / Shift+F3' ), 'F3 / ⇧F3' );
    assert.equal( mac( 'Copy it with Ctrl+c.' ), 'Copy it with ⌘C.' );
    // German texts
    assert.equal( mac( 'Als Text einfügen (Strg+Umschalt+V)' ), 'Als Text einfügen (⇧⌘V)' );
    assert.equal( mac( 'Umschalt+Eingabe' ), '⇧Eingabe' );
    // the Control key itself
    assert.equal( mac( 'Ctrl+M makes Tab move the focus.', { control: true } ), '⌃M makes Tab move the focus.' );
    assert.equal( mac( 'Strg+Rechtsklick', { control: true } ), '⌃Rechtsklick' );
    // no shortcut, nothing changes
    assert.equal( mac( 'C++ and 1+1, Alt text' ), 'C++ and 1+1, Alt text' );
} );

test( 'formatKeys elsewhere: the text as it is, the modifier names translated', () => {
    assert.equal( K.formatKeys( 'Bold (Ctrl+B)', { mac: false } ), 'Bold (Ctrl+B)' );
    assert.equal( K.formatKeys( 'Ctrl+Shift+V', { mac: false, names: { Ctrl: 'Strg', Shift: 'Umschalt' } } ), 'Strg+Umschalt+V' );
    assert.equal( K.formatKeys( 'Strg+M', { mac: false, control: true, names: { Ctrl: 'Strg' } } ), 'Strg+M' );
} );

test( 'the translator formats every text it translates; t.keys only formats', () => {
    const mac = D.translator( GERMAN, { mac: true } ), pc = D.translator( GERMAN, { mac: false } );
    assert.equal( mac( 'Bold (Ctrl+B)' ), 'Fett (⌘B)' );
    assert.equal( pc( 'Bold (Ctrl+B)' ), 'Fett (Strg+B)' );
    assert.equal( mac( 'Paste as text (Ctrl+Shift+V)' ), 'Als Text einfügen (⇧⌘V)' );
    assert.equal( pc( 'Undo (Ctrl+Z)' ), 'Undo (Strg+Z)', 'an untranslated text gets the translated modifier names' );
    assert.equal( mac( 'Use Ctrl+M.', null, { control: true } ), 'Use ⌃M.' );
    assert.equal( mac.keys( 'Ctrl+K' ), '⌘K' );
    assert.equal( K.shortcutLabel( 'Alt+Shift+Up / Down', pc ), 'Alt+Umschalt+Nach oben / Nach unten' );
    assert.equal( K.shortcutLabel( 'Ctrl+Shift+Space', mac ), '⇧⌘Leertaste' );
    assert.equal( K.shortcutLabel( 'Escape', pc ), 'Esc' );
} );

test( 'on a Mac: tooltips, the help\'s keyboard table and tips, the custom tag controls and the source hint show ⌘ ⇧ ⌥ ⌃', () => {
    setPlatform( 'MacIntel' );
    const inst = editor( {}, { customTagControls: true, customTags: [ { name: 'factbox', title: 'Fact box', inline: false, attributes: [] } ] } );
    inst.editor.commands.setContent( '<div type="custom" class="ezoeItemCustomTag factbox"><p>box</p></div><p>x</p>' );
    inst.editor.commands.setTextSelection( 2 );
    const control = ( cls ) => inst.contentArea.querySelector( '.exp-oe-custom-tag-controls .exp-oe-custom-tag-' + cls ).getAttribute( 'title' );
    assert.equal( control( 'edit' ), 'Edit the custom tag (\u2325\u21E7E)' );
    assert.equal( control( 'up' ), 'Move the custom tag up (\u2325\u21E7Up)' );
    const title = ( name ) => inst.toolbar.element.querySelector( '[data-exp-oe-button="' + name + '"]' ).getAttribute( 'title' );
    assert.equal( title( 'bold' ), 'Bold (⌘B)' );
    assert.equal( title( 'undo' ), 'Undo (⌘Z)' );
    assert.equal( title( 'pastetext' ), 'Paste as text (⇧⌘V)' );
    assert.equal( title( 'search' ), 'Find (⌘F)' );
    assert.equal( title( 'nonbreaking' ), 'Insert non-breaking space (⇧⌘Space)' );
    assert.equal( title( 'help' ), 'Help (⌥0)' );

    inst.runButton( 'help' );
    const dialog = document.querySelector( '.exp-oe-dialog.exp-oe-help' );
    const keys = Array.prototype.map.call( dialog.querySelectorAll( '.exp-oe-help-keys tbody th' ), ( th ) => th.textContent );
    assert.ok( keys.includes( '⌘B' ) && keys.includes( '⌘F' ) && keys.includes( '⇧⌘V' ) && keys.includes( '⌘Y / ⇧⌘Z' ), keys.join( ' | ' ) );
    assert.ok( keys.includes( '⌥⇧E' ), 'the custom tag shortcuts too' );
    assert.ok( !keys.some( ( k ) => /Ctrl|Shift\+|Alt\+/.test( k ) ), keys.join( ' | ' ) );
    assert.ok( !/On a Mac/.test( dialog.textContent ), 'no hint to translate the keys in the head any more' );
    const tips = dialog.textContent;
    assert.match( tips, /⌃right click for the browser's own menu/, 'the context menu tip names the Control key' );
    assert.match( tips, /⇧⌘V pastes the text only/ );
} );

test( 'in German off the Mac: the help\'s keyboard table names Strg, Umschalt, Leertaste', () => {
    setPlatform( 'Win32' );
    const inst = editor( GERMAN );
    inst.runButton( 'help' );
    const keys = Array.prototype.map.call( document.querySelectorAll( '.exp-oe-help-keys tbody th' ), ( th ) => th.textContent );
    assert.ok( keys.includes( 'Strg+B' ) && keys.includes( 'Strg+Umschalt+Leertaste' ) && keys.includes( 'Umschalt+Eingabe' ) && keys.includes( 'Esc' ), keys.join( ' | ' ) );
    assert.ok( !keys.some( ( k ) => /Ctrl|Shift/.test( k ) ), keys.join( ' | ' ) );
} );

test( 'the source view\'s hint names the Control key on a Mac (Ctrl+M stays Ctrl+M there)', () => {
    setPlatform( 'MacIntel' );
    const inst = editor();
    inst.runButton( 'code' );
    const dialog = document.querySelector( '.exp-oe-dialog.exp-oe-source' );
    assert.match( dialog.textContent, /⌃M makes/ );
    assert.ok( !/Ctrl\+M/.test( dialog.textContent ) );
} );

test( 'the search bar takes Cmd+F on a Mac and Ctrl+F elsewhere, not the other one', () => {
    for ( const [ name, mac ] of [ [ 'MacIntel', true ], [ 'Win32', false ] ] ) {
        setPlatform( name );
        const inst = editor();
        inst.searchBar.open( false );
        const field = inst.searchBar.find;
        const press = ( opts ) => {
            const e = new KeyboardEvent( 'keydown', Object.assign( { key: 'f', bubbles: true, cancelable: true }, opts ) );
            field.dispatchEvent( e );
            return e.defaultPrevented;
        };
        assert.equal( press( { metaKey: true } ), mac, name + ': Cmd+F' );
        assert.equal( press( { ctrlKey: true } ), !mac, name + ': Ctrl+F' );
        X.destroy( inst.textarea );
    }
} );

test( 'every key binding with Ctrl uses Tiptap\'s Mod- (Cmd on a Mac), or has a Mod- twin', () => {
    const files = [];
    const walk = ( dir ) => {
        for ( const f of readdirSync( dir, { withFileTypes: true } ) ) {
            if ( f.isDirectory() )
                walk( resolve( dir, f.name ) );
            else if ( f.name.endsWith( '.js' ) )
                files.push( resolve( dir, f.name ) );
        }
    };
    walk( resolve( root, 'src/js' ) );
    const ctrl = [];
    for ( const file of files ) {
        const source = readFileSync( file, 'utf8' );
        for ( const m of source.matchAll( /['"]Ctrl-([\w-]+)['"]/g ) ) {
            if ( !source.includes( "'Mod-" + m[1] + "'" ) )
                ctrl.push( file.slice( root.length + 1 ) + ': Ctrl-' + m[1] );
        }
    }
    assert.deepEqual( ctrl, [] );
    const instance = readFileSync( resolve( root, 'src/js/editor/instance.js' ), 'utf8' );
    for ( const key of [ "'Mod-f'", "'Mod-k'", "'Mod-s'", "'Mod-Shift-Space'" ] )
        assert.ok( instance.includes( key ), key );
    assert.ok( readFileSync( resolve( root, 'src/js/editor/paste.js' ), 'utf8' ).includes( "'Mod-Shift-v'" ) );
} );
