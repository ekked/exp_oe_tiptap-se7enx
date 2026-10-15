/**
 * The source view (node --test, happy-dom): the posted HTML, one block per line (formatting adds only white space
 * between blocks), read only with SourceEditable=disabled, else editable: Apply cleans the HTML as pasted HTML, warns
 * about what the schema drops and puts the result into the editor as one step of Undo.
 *
 * @license GPL-2.0-or-later
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

const fixtures = resolve( dirname( fileURLToPath( import.meta.url ) ), '../../fixtures' );
let X, D, form;

before( async () => {
    GlobalRegistrator.register( { url: 'https://example.test/admin/content/edit/1/1' } );
    X = ( await import( '../../../src/js/index.js' ) ).default;
    D = await import( '../../../src/js/ui/dialogs.js' );
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
    return X.init( t, {
        attributeId: 42, contentObjectId: 1, version: 1, language: 'eng-GB', rows: 10, skin: 'a4',
        buttons: [ 'bold', '|', 'code' ], urls: { root: '/', ezoe: '/ezoe/', ezjscore: '/ezjscore/' }, formToken: 'T', ai: { enabled: false }, ...extra
    } );
}

test( 'formatSource: one block per line, nested blocks indented, inline content and literals untouched', () => {
    assert.equal( D.formatSource( '<p>a <strong>b</strong></p><ul><li>x<ul><li>y</li></ul></li></ul><pre>l1<br>l2</pre>' ),
        '<p>a <strong>b</strong></p>\n<ul>\n  <li>x\n    <ul>\n      <li>y</li>\n    </ul>\n  </li>\n</ul>\n<pre>l1<br>l2</pre>' );
} );

test( 'formatSource changes only white space between tags: every fixture comes back', () => {
    for ( const file of readdirSync( fixtures ).filter( ( f ) => f.endsWith( '.html' ) ) ) {
        const html = readFileSync( resolve( fixtures, file ), 'utf8' ).trim();
        // white space between two tags is no content of ezoe's dialect
        const plain = ( x ) => x.replace( /\n */g, '' ).replace( />\s+</g, '><' );
        assert.equal( plain( D.formatSource( html ) ), plain( html ), file );
    }
} );

test( 'with SourceEditable=disabled the code button shows the posted HTML read only, with a copy button', () => {
    const inst = editor( '<p>Hello <em>world</em></p><table><tbody><tr><td><p>c</p></td></tr></tbody></table>', { sourceEditable: false } );
    assert.ok( inst.toolbar.controls.code );
    inst.runButton( 'code' );
    const dialog = document.querySelector( '.exp-oe-dialog.exp-oe-source' );
    const area = dialog.querySelector( 'textarea' );
    assert.equal( area.readOnly, true );
    assert.equal( area.value, '<p>Hello <em>world</em></p>\n<p>\n  <table>\n    <tbody>\n      <tr>\n        <td>\n          <p>c</p>\n        </td>\n      </tr>\n    </tbody>\n  </table>\n</p>' );
    assert.match( dialog.textContent, /characters/ );
    assert.deepEqual( Array.prototype.map.call( dialog.querySelectorAll( '.exp-oe-dialog-footer button' ), ( b ) => b.textContent ), [ 'Copy', 'Close' ] );
    dialog.querySelector( '.exp-oe-primary' ).click();
    assert.equal( document.querySelector( '.exp-oe-dialog' ), null );
} );

// ------------------------------------------------------------------ editable

const S = () => import( '../../../src/js/editor/source.js' );

function openSource( inst ) {
    inst.runButton( 'code' );
    const dialog = document.querySelector( '.exp-oe-dialog.exp-oe-source' );
    return {
        dialog,
        area: dialog.querySelector( 'textarea' ),
        warning: dialog.querySelector( '.exp-oe-source-warning' ),
        buttons: () => Array.prototype.map.call( dialog.querySelectorAll( '.exp-oe-dialog-footer button' ), ( b ) => b.textContent ),
        apply: () => dialog.querySelector( '.exp-oe-primary' ).click(),
        type( value ) {
            this.area.value = value;
            this.area.dispatchEvent( new Event( 'input' ) );
        }
    };
}

const isOpen = () => !!document.querySelector( '.exp-oe-dialog.exp-oe-source' );

test( 'the source view is editable by default: Copy, Cancel and Apply, the note about ezxmltext, a wrap switch', () => {
    const inst = editor( '<p>a</p>' );
    const s = openSource( inst );
    assert.equal( s.area.readOnly, false );
    assert.deepEqual( s.buttons(), [ 'Copy', 'Cancel', 'Apply' ] );
    assert.match( s.dialog.textContent, /HTML of the editor; what is stored is ezxmltext/ );
    assert.equal( s.warning.hidden, true );
    const wrap = s.dialog.querySelector( '.exp-oe-source-wrap' );
    assert.equal( s.area.getAttribute( 'wrap' ), 'off' );
    wrap.checked = true;
    wrap.dispatchEvent( new Event( 'change' ) );
    assert.equal( s.area.getAttribute( 'wrap' ), 'soft' );
    assert.ok( s.area.classList.contains( 'exp-oe-source-wrapped' ) );
} );

test( 'Apply puts the changed HTML into the editor as one step of Undo', () => {
    const inst = editor( '<p>one</p>' );
    const s = openSource( inst );
    s.type( '<p>one</p>\n<h2>two</h2>\n<ul>\n  <li>three</li>\n</ul>' );
    s.apply();
    assert.equal( isOpen(), false );
    assert.equal( inst.getHTML(), '<p>one</p><h2>two</h2><ul><li>three</li></ul>' );
    assert.equal( inst.textarea.value, inst.getHTML() );
    inst.editor.commands.undo();
    assert.equal( inst.getHTML(), '<p>one</p>' );
    inst.editor.commands.redo();
    assert.equal( inst.getHTML(), '<p>one</p><h2>two</h2><ul><li>three</li></ul>' );
} );

test( 'Cancel and Escape leave the text as it is; with unapplied changes the first one asks, the second discards', () => {
    const inst = editor( '<p>one</p>' );
    const escape = () => document.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Escape', bubbles: true } ) );
    let s = openSource( inst );
    escape();
    assert.equal( isOpen(), false, 'nothing changed: Escape closes at once' );
    s = openSource( inst );
    s.type( '<p>two</p>' );
    s.dialog.querySelectorAll( '.exp-oe-dialog-footer button' )[1].click();
    assert.equal( isOpen(), true );
    assert.match( s.dialog.querySelector( '.exp-oe-source-status' ).textContent, /Cancel again/ );
    s.dialog.querySelectorAll( '.exp-oe-dialog-footer button' )[1].click();
    assert.equal( isOpen(), false );
    assert.equal( inst.getHTML(), '<p>one</p>' );
    s = openSource( inst );
    s.type( '<p>two</p>' );
    escape();
    assert.equal( isOpen(), true );
    // a new edit asks again
    s.type( '<p>three</p>' );
    escape();
    assert.equal( isOpen(), true );
    escape();
    assert.equal( isOpen(), false );
    assert.equal( inst.getHTML(), '<p>one</p>' );
} );

test( 'no warning when Apply would change nothing, even if the typed HTML has something the schema drops', () => {
    const inst = editor( '<p>a b</p>' );
    const s = openSource( inst );
    s.type( '<p>a <span>b</span></p>' );
    s.apply();
    assert.equal( isOpen(), false );
    assert.equal( inst.dirty, false );
} );

test( 'no warning for empty paragraphs the editor leaves out (at the end, around a table)', () => {
    const inst = editor( '<p>a</p>' );
    const s = openSource( inst );
    s.type( '<p>a</p><p></p><p><table><tbody><tr><td><p>c</p></td></tr></tbody></table></p><p><br></p>' );
    s.apply();
    assert.equal( isOpen(), false, 'applied without asking' );
    assert.equal( inst.getHTML(), '<p>a</p><p><table><tbody><tr><td><p>c</p></td></tr></tbody></table></p>' );
} );

test( 'Apply without a change changes nothing: every fixture stays byte for byte, without a warning', () => {
    for ( const file of readdirSync( fixtures ).filter( ( f ) => f.endsWith( '.html' ) ) ) {
        const original = readFileSync( resolve( fixtures, file ), 'utf8' ).trim();
        const inst = editor( original );
        const before = inst.getHTML();
        const s = openSource( inst );
        s.apply();
        assert.equal( isOpen(), false, file + ': no warning' );
        assert.equal( inst.dirty, false, file + ': nothing changed' );
        assert.equal( inst.textarea.value, original, file );
        assert.equal( inst.getHTML(), before, file );
    }
} );

test( 'the formatted source reads back to the same document for every fixture, with no change listed', async () => {
    const { readSource } = await S();
    for ( const file of readdirSync( fixtures ).filter( ( f ) => f.endsWith( '.html' ) ) ) {
        const inst = editor( readFileSync( resolve( fixtures, file ), 'utf8' ).trim() );
        const read = readSource( D.formatSource( inst.getHTML() ), inst );
        assert.equal( read.same, true, file );
        assert.deepEqual( read.changes, [], file );
        assert.equal( read.html, inst.getHTML(), file );
        X.destroy( inst.textarea );
    }
} );

test( 'no warning for formatting: white space, line breaks, attribute order, b and i', async () => {
    const { readSource } = await S();
    const inst = editor( '<p>a</p>' );
    for ( const html of [
        '<p>a <strong>b</strong>\n   c</p>',
        '\n\n  <ul>\n\n    <li>x</li>\n  </ul>\n',
        '<p><a title="t" href="https://example.test/">l</a></p>',
        '<p><a href="https://example.test/" title="t">l</a></p>',
        '<p><b>bold</b> <i>it</i></p>',
        '<table border="1"><tbody>\n<tr>\n<td>c</td>\n</tr>\n</tbody></table>',
        'plain text'
    ] )
        assert.deepEqual( readSource( html, inst ).changes, [], html );
} );

test( 'losses are listed: inline styles, unknown elements and attributes, blocks that become paragraphs', async () => {
    const { readSource } = await S();
    const inst = editor( '<p>a</p>' );
    const changes = ( html ) => readSource( html, inst ).changes;
    assert.deepEqual( changes( '<p>a <span style="color:red">red</span></p>' ), [ { type: 'element', tag: '<span style>' } ] );
    assert.deepEqual( changes( '<div>text</div>' ), [ { type: 'paragraph', tag: '<div>' } ] );
    assert.deepEqual( changes( '<p>a <font color="red">b</font></p>' ), [ { type: 'element', tag: '<font color>' } ] );
    assert.deepEqual( changes( '<blockquote><p>q</p></blockquote>' ), [ { type: 'element', tag: '<blockquote>' } ] );
    assert.deepEqual( changes( '<p>a<br class="x">b</p>' ), [ { type: 'attribute', tag: '<br>', attribute: 'class' } ] );
    // what the schema keeps is no loss, also when it writes it differently
    assert.deepEqual( changes( '<h2 style="color:red" id="x">h</h2><p><a href="https://x.test/" rel="nofollow" class="c">l</a></p>' ), [] );
    // a style the browser cannot read is lost
    assert.deepEqual( changes( '<ul style="x"><li>i</li></ul>' ), [ { type: 'attribute', tag: '<ul>', attribute: 'style' } ] );
    assert.deepEqual( changes( '<p>a<script>alert(1)</script></p>' ), [ { type: 'element', tag: '<script>' }, { type: 'text', text: 'alert(1)' } ] );
} );

test( 'a loss asks first: the warning lists it, Apply anyway applies, a new edit asks again', () => {
    const inst = editor( '<p>one</p>' );
    const s = openSource( inst );
    s.type( '<p>one <span style="color:red">red</span></p>' );
    s.apply();
    assert.equal( isOpen(), true );
    assert.equal( s.warning.hidden, false );
    assert.match( s.warning.textContent, /<span style> is removed/ );
    assert.deepEqual( s.buttons(), [ 'Copy', 'Cancel', 'Apply anyway' ] );
    assert.equal( inst.getHTML(), '<p>one</p>' );
    // a change of the text: the warning goes, Apply asks again
    s.type( '<div>two</div>' );
    assert.equal( s.warning.hidden, true );
    assert.deepEqual( s.buttons(), [ 'Copy', 'Cancel', 'Apply' ] );
    s.apply();
    assert.match( s.warning.textContent, /<div> becomes a paragraph/ );
    s.apply();
    assert.equal( isOpen(), false );
    assert.equal( inst.getHTML(), '<p>two</p>' );
    inst.editor.commands.undo();
    assert.equal( inst.getHTML(), '<p>one</p>' );
} );

test( 'Apply cleans as paste does: event handlers, script addresses, SVG and scripts, data addresses never reach the page or the text', () => {
    const inst = editor( '<p>a</p>' );
    let ran = 0;
    window.expOEXss = () => { ran++; };
    const vectors = [
        '<p><img src="x" onerror="expOEXss()">a</p>',
        '<p><a href="java\tscript:expOEXss()">l1</a> <a href=" javascript:expOEXss()">l2</a> <a href="&#x6A;avascript:expOEXss()">l3</a> <a href="jav&#x0A;ascript:x">l4</a></p>',
        '<p><a href="\u0001javascript:x">l5</a> <a href="data:text/html;base64,PHNjcmlwdD4=">l6</a></p>',
        '<svg><script>expOEXss()</script></svg><p onclick="expOEXss()" onmouseover="expOEXss()">b</p>',
        '<p><a href="vbscript:x">l7</a></p><iframe src="javascript:expOEXss()"></iframe><style>p{}</style><script>expOEXss()</script>',
        '<p><img src="data:image/svg+xml,<svg onload=expOEXss()>">c</p>'
    ];
    for ( const html of vectors ) {
        const s = openSource( inst );
        s.type( html );
        s.apply();
        if ( isOpen() ) {
            assert.equal( s.warning.hidden, false, html );
            s.apply();
        }
        const out = inst.getHTML();
        assert.doesNotMatch( out, /on(error|click|mouseover|load)=|javascript:|vbscript:|data:|<script|<svg|<iframe|<style|expOEXss/i, html + ' -> ' + out );
    }
    assert.match( inst.getHTML(), /c/ );
    assert.equal( ran, 0 );
    delete window.expOEXss;
} );

test( 'the source is parsed in an inert document: an onerror never runs, not even before Apply', async () => {
    const { readSource } = await S();
    const inst = editor( '<p>a</p>' );
    let ran = 0;
    window.expOEXss = () => { ran++; };
    const read = readSource( '<p><img src="x" onerror="expOEXss()"><a href="https://example.test/" onclick="expOEXss()">ok</a></p>', inst );
    assert.ok( read.changes.some( ( c ) => c.type === 'attribute' && c.attribute === 'onclick' || c.tag === '<img onerror src>' ), JSON.stringify( read.changes ) );
    await new Promise( ( r ) => setTimeout( r, 20 ) );
    assert.equal( ran, 0 );
    assert.match( read.html, /href="https:\/\/example.test\/"/ );
    assert.doesNotMatch( read.html, /onclick|onerror/ );
    delete window.expOEXss;
} );

test( 'Tab indents in the field and Shift+Tab outdents; Ctrl+M makes Tab move the focus', () => {
    const inst = editor( '<ul><li>a</li></ul>' );
    const s = openSource( inst );
    s.area.setSelectionRange( 0, 0 );
    s.area.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Tab', bubbles: true, cancelable: true } ) );
    assert.equal( s.area.value.slice( 0, 6 ), '  <ul>' );
    s.area.setSelectionRange( 0, s.area.value.length );
    s.area.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true } ) );
    assert.equal( s.area.value, '<ul>\n<li>a</li>\n</ul>' );
    s.area.dispatchEvent( new KeyboardEvent( 'keydown', { key: 'm', ctrlKey: true, bubbles: true, cancelable: true } ) );
    assert.equal( s.area.getAttribute( 'data-exp-oe-tab' ), 'move' );
    assert.match( s.dialog.querySelector( '.exp-oe-field .exp-oe-hint' ).textContent, /Tab moves the focus/ );
    const e = new KeyboardEvent( 'keydown', { key: 'Tab', bubbles: true, cancelable: true } );
    s.area.dispatchEvent( e );
    assert.equal( s.area.value, '<ul>\n<li>a</li>\n</ul>' );
} );

test( 'the source view of a locked editor is read only', () => {
    const inst = editor( '<p>a</p>' );
    inst.locked = false;
    inst.editor.setEditable( false );
    const s = openSource( inst );
    assert.equal( s.area.readOnly, true );
    assert.deepEqual( s.buttons(), [ 'Copy', 'Close' ] );
} );
