/**
 * The dialogs (node --test, happy-dom): with Skin=a4 every dialog of the editor is a card in admin4's look with the
 * same accessible markup (aria-labelledby, aria-describedby, close button with an icon, stacked fields with hints and
 * required marks, primary button last, focus on the first field, Tab stays inside, Escape closes, the focus returns
 * to the text); o2k7 keeps ezoe's popup. The a4 dialog styles use admin4's tokens with fallbacks only, and the
 * dialog texts reach the translation list. Also the cell type, the literal dialog and the path click
 * (TagPathOpenDialog).
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
const read = ( f ) => readFileSync( resolve( root, f ), 'utf8' );
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
    attributeId: 42, contentObjectId: 1, version: 1, language: 'eng-GB', rows: 10, skin: 'a4',
    buttons: [ 'formatselect', 'bold', '|', 'link', 'anchor', '|', 'image', 'object', 'file', 'custom', 'literal', 'charmap', '|',
               'table', 'cell_props', '|', 'help' ],
    customTags: [ { name: 'factbox', title: 'Fact box', inline: false, attributes: [] } ],
    tableDefinitions: {
        table: { classes: {}, defaults: { width: '100%', border: '0' }, attributes: [
            { id: 'summary', name: 'Summary (WAI)', type: 'text', required: true, title: '' },
            { id: 'caption', name: 'Caption', type: 'text', title: 'Shown above the table' } ] },
        td: { classes: {}, attributes: [] }, th: { classes: {}, attributes: [] }
    },
    urls: { root: '/', ezoe: '/ezoe/', ezjscore: '/ezjscore/' }, formToken: 'TOKEN', locale: 'de-DE', ai: { enabled: false },
    i18n: { 'Insert table': 'Tabelle einfügen', 'Summary (WAI)': 'Zusammenfassung (für Screenreader)', 'Caption': 'Beschriftung', 'Close': 'Schließen' }
};

const overlay = () => document.querySelector( '.exp-oe-dialog-overlay' );
const dialog = () => document.querySelector( '.exp-oe-dialog' );
const key = ( target, k, shift ) => target.dispatchEvent( new KeyboardEvent( 'keydown', { key: k, shiftKey: !!shift, bubbles: true, cancelable: true } ) );

function cellPos( inst ) {
    let pos = null;
    inst.editor.state.doc.descendants( ( node, p ) => {
        if ( pos === null && node.isText && node.text === 'cell' )
            pos = p + 1;
    } );
    return pos;
}

/** Opens every dialog the editor has; returns [ name, open() ] */
function everyDialog( inst ) {
    return [
        [ 'link', () => {
            inst.editor.commands.setTextSelection( { from: 1, to: 3 } );
            inst.runButton( 'link' );
        } ],
        [ 'anchor', () => inst.runButton( 'anchor' ) ],
        [ 'image', () => inst.runButton( 'image' ) ],
        [ 'object', () => inst.runButton( 'object' ) ],
        [ 'file', () => inst.runButton( 'file' ) ],
        [ 'custom', () => inst.runButton( 'custom' ) ],
        [ 'table', () => inst.runButton( 'table' ) ],
        [ 'cell_props', () => {
            inst.editor.commands.setTextSelection( cellPos( inst ) );
            inst.runButton( 'cell_props' );
        } ],
        [ 'literal', () => inst.runButton( 'literal' ) ],
        [ 'charmap', () => inst.runButton( 'charmap' ) ],
        [ 'help', () => inst.runButton( 'help' ) ]
    ];
}

test( 'with Skin=a4 every dialog has the a4 card markup: labelled, described, close icon, primary button last', () => {
    const inst = X.init( textarea( '<p>text</p><table><tbody><tr><td><p>cell</p></td></tr></tbody></table>' ),
                         Object.assign( {}, OPTIONS, { literal: { classes: { code: 'Code' }, attributes: [] } } ) );
    const seen = [];
    for ( const [ name, open ] of everyDialog( inst ) ) {
        open();
        const box = dialog();
        assert.ok( box, name + ' opens a dialog' );
        assert.ok( overlay().classList.contains( 'exp-oe-skin-a4' ), name + ': the overlay carries the skin' );
        assert.equal( box.getAttribute( 'role' ), 'dialog', name );
        assert.equal( box.getAttribute( 'aria-modal' ), 'true', name );
        const title = document.getElementById( box.getAttribute( 'aria-labelledby' ) );
        assert.ok( title && title.tagName === 'H2' && title.textContent.trim(), name + ': aria-labelledby names the heading' );
        const desc = document.getElementById( box.getAttribute( 'aria-describedby' ) || '' );
        assert.ok( desc && desc.textContent.trim(), name + ': aria-describedby names a description' );
        const close = box.querySelector( '.exp-oe-dialog-close' );
        assert.ok( close.getAttribute( 'aria-label' ), name + ': the close button has a name' );
        assert.ok( close.querySelector( '.exp-oe-icon.mce_close[aria-hidden="true"]' ), name + ': the close button shows the icon' );
        assert.ok( !/×/.test( close.textContent ), name + ': no "×" character' );
        const buttons = box.querySelectorAll( '.exp-oe-dialog-footer button' );
        const primary = box.querySelector( '.exp-oe-dialog-footer .exp-oe-primary' );
        if ( primary )
            assert.equal( buttons[buttons.length - 1], primary, name + ': the primary button is the last one' );
        assert.ok( box.contains( document.activeElement ), name + ': the focus is in the dialog' );
        for ( const label of box.querySelectorAll( '.exp-oe-field > label' ) )
            assert.ok( document.getElementById( label.getAttribute( 'for' ) ), name + ': every label belongs to a control' );
        seen.push( name );
        key( document.activeElement, 'Escape' );
        assert.equal( dialog(), null, name + ': Escape closes it' );
    }
    assert.equal( seen.length, 11 );
} );

test( 'a4 table dialog: translated title and labels, required mark and hint are accessible, focus on the first field', () => {
    const inst = X.init( textarea( '<p>x</p>' ), OPTIONS );
    inst.editor.commands.setTextSelection( 2 );
    inst.runButton( 'table' );
    const box = dialog();
    assert.equal( box.querySelector( '.exp-oe-dialog-heading' ).textContent, 'Tabelle einfügen' );
    const labels = Array.prototype.map.call( box.querySelectorAll( '.exp-oe-field > label' ), ( l ) => l.textContent );
    assert.ok( labels.includes( 'Zusammenfassung (für Screenreader) *' ), labels.join( ' | ' ) );
    assert.ok( labels.includes( 'Beschriftung' ) );
    const summaryLabel = Array.prototype.find.call( box.querySelectorAll( '.exp-oe-field > label' ), ( l ) => /Zusammenfassung/.test( l.textContent ) );
    const summary = document.getElementById( summaryLabel.getAttribute( 'for' ) );
    assert.equal( summary.getAttribute( 'aria-required' ), 'true' );
    assert.equal( summaryLabel.querySelector( '.exp-oe-required' ).getAttribute( 'aria-hidden' ), 'true', 'the "*" is not read, aria-required is' );
    const captionLabel = Array.prototype.find.call( box.querySelectorAll( '.exp-oe-field > label' ), ( l ) => l.textContent === 'Beschriftung' );
    const caption = document.getElementById( captionLabel.getAttribute( 'for' ) );
    const hint = document.getElementById( caption.getAttribute( 'aria-describedby' ) );
    assert.equal( hint.textContent, 'Shown above the table', 'the attribute description is a hint below the field' );
    assert.equal( caption.getAttribute( 'placeholder' ), null );
    assert.equal( document.activeElement, box.querySelector( '.exp-oe-dialog-panel input' ), 'the first field has the focus' );
    // the required field is checked
    box.querySelector( '.exp-oe-primary' ).click();
    assert.ok( dialog(), 'stays open' );
    assert.match( box.querySelector( '.exp-oe-dialog-error' ).textContent, /Zusammenfassung/ );
    key( document.activeElement, 'Escape' );
} );

test( 'Tab and Shift+Tab stay inside the dialog; closing gives the focus back to the text', () => {
    const inst = X.init( textarea( '<p>x</p>' ), OPTIONS );
    inst.runButton( 'anchor' );
    const box = dialog();
    const focusables = Array.prototype.filter.call( box.querySelectorAll( 'button, input, select, textarea' ), ( e ) => !e.disabled );
    const first = focusables[0], last = focusables[focusables.length - 1];
    last.focus();
    key( last, 'Tab' );
    assert.equal( document.activeElement, first, 'Tab on the last control goes to the first' );
    key( first, 'Tab', true );
    assert.equal( document.activeElement, last, 'Shift+Tab on the first control goes to the last' );
    box.querySelector( '.exp-oe-dialog-close' ).click();
    assert.equal( dialog(), null );
    assert.ok( inst.editor.view.dom.contains( document.activeElement ) || document.activeElement === inst.editor.view.dom, 'the text has the focus again' );
} );

test( 'o2k7 keeps ezoe\'s popup: OK before Cancel, the "×", no a4 class, the description only for screen readers', () => {
    const inst = X.init( textarea( '<p>x</p>' ), Object.assign( {}, OPTIONS, { skin: 'o2k7' } ) );
    inst.runButton( 'anchor' );
    assert.ok( !overlay().classList.contains( 'exp-oe-skin-a4' ) );
    const buttons = dialog().querySelectorAll( '.exp-oe-dialog-footer button' );
    assert.ok( buttons[0].classList.contains( 'exp-oe-primary' ) );
    assert.equal( dialog().querySelector( '.exp-oe-dialog-close' ).textContent, '×' );
    assert.ok( dialog().getAttribute( 'aria-describedby' ) );
    const css = read( 'src/css/exp_oe_tiptap.css' );
    assert.match( css, /\.exp-oe-dialog-description \{ position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset\(50%\)/ );
    assert.match( css, /\.exp-oe-dialog \{\s*width: 480px; max-width: 100%; background: #f0f0ee;/, 'the o2k7 popup is unchanged' );
} );

test( 'the cell dialog switches between data and header cell', () => {
    const t = textarea( '<table><tbody><tr><td><p>cell</p></td><td><p>b</p></td></tr></tbody></table>' );
    const inst = X.init( t, OPTIONS );
    inst.editor.commands.setTextSelection( cellPos( inst ) );
    inst.runButton( 'cell_props' );
    const kind = Array.prototype.find.call( dialog().querySelectorAll( 'select' ), ( s ) => s.querySelector( 'option[value="th"]' ) );
    assert.ok( kind, 'a cell type field' );
    assert.equal( kind.value, 'td' );
    kind.value = 'th';
    dialog().querySelector( '.exp-oe-primary' ).click();
    assert.match( t.value, /<tr><th[^>]*><p>cell<\/p><\/th><td/ );
} );

test( 'with literal classes the literal button asks for the class; without, it only switches the block', () => {
    const t = textarea( '<p>code</p>' );
    const inst = X.init( t, Object.assign( {}, OPTIONS, { literal: { classes: { html: 'HTML' }, attributes: [] } } ) );
    inst.editor.commands.setTextSelection( 2 );
    inst.runButton( 'literal' );
    const sel = dialog().querySelector( 'select' );
    sel.value = 'html';
    dialog().querySelector( '.exp-oe-primary' ).click();
    assert.match( t.value, /^<pre[^>]*class="html"[^>]*>code<\/pre>$/ );
    // editing: the stored class, and "Convert to paragraph"
    inst.editor.commands.setTextSelection( 2 );
    inst.runButton( 'literal' );
    assert.equal( dialog().querySelector( 'select' ).value, 'html' );
    const convert = Array.prototype.find.call( dialog().querySelectorAll( '.exp-oe-dialog-footer button' ), ( b ) => b.textContent === 'Convert to paragraph' );
    convert.click();
    assert.match( t.value, /^<p>code<\/p>$/ );

    const t2 = textarea( '<p>plain</p>' );
    const inst2 = X.init( t2, OPTIONS );
    inst2.editor.commands.setTextSelection( 2 );
    inst2.runButton( 'literal' );
    assert.equal( dialog(), null );
    assert.match( t2.value, /^<pre[^>]*>plain<\/pre>$/ );
} );

test( 'TagPathOpenDialog: a click on a path item opens the dialog of that tag', () => {
    const html = '<table><tbody><tr><td><p>cell</p></td></tr></tbody></table>';
    const inst = X.init( textarea( html ), Object.assign( {}, OPTIONS, { pathOpenDialog: true } ) );
    inst.editor.commands.setTextSelection( cellPos( inst ) );
    const td = Array.prototype.find.call( inst.wrapper.querySelectorAll( '.exp-oe-path-item' ), ( a ) => a.textContent === 'td' );
    td.click();
    assert.match( dialog().querySelector( '.exp-oe-dialog-heading' ).textContent, /cell/i );
    key( document.activeElement, 'Escape' );

    const off = X.init( textarea( html ), OPTIONS );
    off.editor.commands.setTextSelection( cellPos( off ) );
    Array.prototype.find.call( off.wrapper.querySelectorAll( '.exp-oe-path-item' ), ( a ) => a.textContent === 'td' ).click();
    assert.equal( dialog(), null, 'off by default: the click only selects' );
} );

test( 'the a4 dialog styles use admin4 tokens: no colour without a var(--a4-*) around it, no o2k7 popup colour', () => {
    const css = read( 'src/css/skin-a4.css' );
    const start = css.indexOf( '/* dialogs (ui/dialog.js' );
    assert.ok( start > 0, 'the dialog section' );
    const section = css.slice( start );
    // remove every token with its fallback (one level of nested parentheses, rgba() in a fallback)
    let rest = section, prev;
    do {
        prev = rest;
        rest = rest.replace( /var\(--a4-[\w-]+(?:,\s*(?:[^()]|\([^()]*\))*)?\)/g, 'TOKEN' );
    } while ( rest !== prev );
    assert.doesNotMatch( rest, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, 'a literal colour outside a token fallback' );
    assert.doesNotMatch( section, /#e5effd|#f0f0ee|#abc6dd|#919b9c|Tahoma|linear-gradient/i, 'nothing of the o2k7 popup' );
    assert.match( section, /@media \(forced-colors: active\)/ );
    assert.match( section, /@media \(max-width: 40rem\)/ );
    assert.match( section, /width: 32rem/ );
    assert.match( section, /html\[data-a4-theme="dark"\] \.exp-oe-dialog-overlay\.exp-oe-skin-a4 \{ color-scheme: dark; \}/ );
    assert.match( read( 'src/css/skin-a4-icons.css' ), /\.exp-oe-icon\.mce_close \{ --exp-oe-a4-icon: url\("data:image\/svg\+xml,/ );
    assert.match( read( 'tools/build-skin-a4.py' ), /'close': 'tiptap\/close-icon'/ );
} );

test( 'the dialog texts are in the translation list and in both translation files', () => {
    const strings = JSON.parse( read( 'design/standard/javascript/exp_oe_tiptap/strings.json' ) );
    const de = read( 'translations/ger-DE/translation.ts' ), un = read( 'translations/untranslated/translation.ts' );
    const php = read( 'classes/expoetiptapeditor.php' );
    const wanted = [ 'Insert table', 'Table properties', 'Insert link', 'Edit link', 'Insert/edit anchor', 'Custom tag', 'Table cell properties',
                     'Insert special character', 'Help', 'Close', 'Cancel', 'OK', 'Size and attributes of the new table.', 'Cell type', 'Header cell',
                     'Literal text', 'Convert to paragraph' ];
    for ( const s of wanted ) {
        assert.ok( strings.includes( s ) || php.includes( "'" + s + "'" ), s + ' reaches options.i18n' );
        const esc = s.replace( /&/g, '&amp;' );
        assert.ok( de.includes( '<source>' + esc + '</source>' ), s + ' in ger-DE' );
        assert.ok( un.includes( '<source>' + esc + '</source>' ), s + ' in untranslated' );
    }
    for ( const s of [ 'Summary (WAI)', 'Caption' ] ) {
        assert.ok( php.includes( "'" + s + "'" ), s + ' in the server list' );
        assert.ok( de.includes( '<source>' + s + '</source>' ), s );
    }
    assert.match( de, /<source>Summary \(WAI\)<\/source>\s*<translation>Zusammenfassung \(für Screenreader\)<\/translation>/ );
    assert.match( de, /<source>Caption<\/source>\s*<translation>Beschriftung<\/translation>/ );
    assert.match( de, /<source>Insert table<\/source>\s*<translation>Tabelle einfügen<\/translation>/ );
} );
