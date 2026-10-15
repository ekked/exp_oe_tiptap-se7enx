/**
 * Paste (node --test, happy-dom): Word, Google Docs and web page HTML (tests/js/paste/, as the browsers put it on the
 * clipboard) is cleaned to ezxmltext's structures; "Paste as text" and Ctrl+Shift+V paste the text only.
 *
 * @license GPL-2.0-or-later
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

const here = dirname( fileURLToPath( import.meta.url ) );
const sample = ( name ) => readFileSync( resolve( here, '../paste', name + '.html' ), 'utf8' );
let X, P, form;

before( async () => {
    GlobalRegistrator.register( { url: 'https://example.test/admin/content/edit/1/1' } );
    X = ( await import( '../../../src/js/index.js' ) ).default;
    P = await import( '../../../src/js/editor/paste.js' );
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
        buttons: [ 'bold', '|', 'pastetext' ], urls: { root: '/', ezoe: '/ezoe/', ezjscore: '/ezjscore/' },
        formToken: 'T', ai: { enabled: false },
        customTags: [ { name: 'underline', inline: true, attributes: [] } ]
    }, extra || {} ) );
}

/** A paste event as the browser sends it, through ProseMirror's own paste handling */
function paste( inst, data ) {
    const event = new Event( 'paste', { bubbles: true, cancelable: true } );
    event.clipboardData = { getData: ( type ) => data[type] || '', types: Object.keys( data ), files: [], items: [] };
    inst.editor.view.dom.dispatchEvent( event );
}

const squash = ( html ) => html.replace( />\s+</g, '><' ).replace( /\s+/g, ' ' );

test( 'Word: comments, styles, classes, <o:p>, bookmarks, footnote anchors, comments and header go; lists become lists', () => {
    const html = sample( 'word-document' );
    assert.ok( P.isOfficeHTML( html ) );
    const out = squash( P.cleanPastedHTML( html ) );
    for ( const junk of [ 'mso', 'Mso', 'o:p', '<span', 'style=', 'class=', '<!--', '_Toc', '#_ftn', 'Company letterhead', 'Check this', '[A1]', '<hr', 'clear=', 'onmouseover', '<meta', 'font-face' ] )
        assert.equal( out.indexOf( junk ), -1, junk + ' in ' + out );
    assert.match( out, /<h1>Annual report<\/h1>/ );
    assert.match( out, /<p align="center"><b>Summary<\/b><\/p>/ );
    assert.match( out, /see <a href="https:\/\/example.org\/report">the report<\/a>\[1\]\. Second sentence\.<\/p>/ );
    assert.match( out, /<ul><li>First point<ul><li>Nested point<\/li><\/ul><\/li><li>Second point<\/li><\/ul>/ );
    assert.match( out, /<ol><li>Step one<\/li><li>Step <u>two<\/u><\/li><\/ol>/ );
    assert.match( out, /<table border="1">(<tbody>)?<tr><td><p><b>Year<\/b><\/p><\/td><td><p align="right">Value<\/p><\/td><\/tr><tr><td colspan="2"><p>2026 wurde gut<\/p><\/td><\/tr>(<\/tbody>)?<\/table>/ );
    assert.match( out, /<p>Commented text<\/p>/ );
    assert.match( out, /<p>\[1\] Source of the figures\.<\/p>/ );
    // an empty Word paragraph (<o:p>&nbsp;</o:p>) is an empty paragraph
    assert.match( out, /<p><\/p>/ );
} );

test( 'Word through the editor: what is posted is ezoe\'s dialect only', () => {
    const inst = editor( '' );
    inst.editor.commands.setTextSelection( 1 );
    paste( inst, { 'text/html': sample( 'word-document' ), 'text/plain': 'Annual report' } );
    const out = inst.getHTML();
    assert.match( out, /<h1>Annual report<\/h1>/ );
    assert.match( out, /<ul><li>First point<ul><li>Nested point<\/li><\/ul><\/li><li>Second point<\/li><\/ul>/ );
    assert.match( out, /<u class="ezoeItemCustomTag underline" type="custom">two<\/u>/ );
    assert.match( out, /<td colspan="2"><p>2026 wurde gut<\/p><\/td>/ );
    assert.doesNotMatch( out, /mso|style=|o:p|_Toc|letterhead/ );
} );

test( 'Google Docs: styles become bold, italic and superscript, the wrapper and the link underline go', () => {
    const out = P.cleanPastedHTML( sample( 'google-docs' ) ).trim();
    assert.equal( out, '<p><strong>Bold</strong> and <em>italic</em><sup>2</sup></p><ul><li><p>Item</p></li></ul><p align="center"><a href="https://example.org/">Link</a></p>' );
} );

test( 'a web page: scripts, forms, images and unknown markup go, their text stays; only safe links stay', () => {
    const out = P.cleanPastedHTML( sample( 'web-page' ) );
    assert.equal( out, '<h2>News new</h2><p>A short lead.</p><p>Text with old font, code, marked and an  image. Struck words stay. bad link and ' +
                       '<a href="https://example.org/">good link</a>.</p><p>Quoted</p><p>Prices</p><table><thead><tr><th align="right">Item</th></tr></thead><tbody><tr><td>Tea</td></tr></tbody></table>' );
} );

test( 'HTML of this editor or of ezoe is left as it is', () => {
    const own = '<p data-pm-slice="1 1 []">a <span class="ezoeItemCustomTag factbox" type="custom">b</span></p>';
    assert.equal( P.cleanPastedHTML( own ), own );
    const ezoe = '<div type="custom" class="ezoeItemCustomTag factbox" customattributes="title|x"><p>t</p></div>';
    assert.equal( P.cleanPastedHTML( ezoe ), ezoe );
} );

test( 'plain text: blank lines make paragraphs, single line breaks stay line breaks', () => {
    const inst = editor( '<p>x</p>' );
    inst.editor.commands.setTextSelection( 2 );
    paste( inst, { 'text/plain': 'one\ntwo\n\nthree' } );
    assert.equal( inst.getHTML(), '<p>xone<br>two</p><p>three</p>' );
} );

test( '"Paste as text" is a switch: while on, formatted HTML is pasted as its text', () => {
    const inst = editor( '<p>x</p>' );
    const button = inst.toolbar.controls.pastetext;
    assert.ok( button );
    assert.equal( button.getAttribute( 'aria-pressed' ), 'false' );
    button.click();
    assert.equal( button.getAttribute( 'aria-pressed' ), 'true' );
    inst.editor.commands.setTextSelection( 2 );
    paste( inst, { 'text/html': '<p><strong>Bold</strong> text</p>', 'text/plain': 'Bold text' } );
    assert.equal( inst.getHTML(), '<p>xBold text</p>' );
    button.click();
    paste( inst, { 'text/html': '<p><strong>B</strong></p>', 'text/plain': 'B' } );
    assert.match( inst.getHTML(), /<strong>B<\/strong>/ );
} );

test( 'Ctrl+Shift+V: the next paste is text only', () => {
    const inst = editor( '<p>x</p>' );
    inst.editor.commands.setTextSelection( 2 );
    const key = new KeyboardEvent( 'keydown', { key: 'V', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true } );
    inst.editor.view.someProp( 'handleKeyDown', ( f ) => f( inst.editor.view, key ) );
    assert.equal( key.defaultPrevented, false, 'the browser pastes' );
    paste( inst, { 'text/html': '<p><em>it</em></p>', 'text/plain': 'it' } );
    assert.equal( inst.getHTML(), '<p>xit</p>' );
    paste( inst, { 'text/html': '<p><em>it</em></p>', 'text/plain': 'it' } );
    assert.match( inst.getHTML(), /<em>it<\/em>/ );
} );

test( 'links: only http(s), mailto, tel, ftp and relative addresses stay; spaces and control characters do not hide a script', () => {
    for ( const href of [ 'javascript:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)', 'JaVaScRiPt:x', '\u0001javascript:x', 'vbscript:x', 'data:text/html,x', 'file:///c:/x', '#_Toc1' ] )
        assert.equal( P.cleanPastedHTML( '<p><a href="' + href.replace( /"/g, '&quot;' ) + '">t</a></p>' ), '<p>t</p>', JSON.stringify( href ) );
    for ( const href of [ 'https://example.org/a?b=1', 'http://x', 'mailto:a@example.org', 'tel:+49', '/content/view/1', 'page.html' ] )
        assert.match( P.cleanPastedHTML( '<p><a href="' + href + '">t</a></p>' ), /<a href=/, href );
} );

test( 'HTML marked as this editor\'s or ezoe\'s keeps its markup, but not unsafe links, event handlers or scripts', () => {
    const out = P.cleanPastedHTML( '<p data-pm-slice="1 1 []"><a href=" javascript:alert(1)">x</a><a href="eznode://2">n</a>' +
        '<a href="#top">t</a><img id="eZObject_1" src="/i.png" onerror="window.__pasted=1"><span class="ezoeItemCustomTag f" type="custom" onclick="x()">c</span></p><script>window.__pasted=2</script>' );
    assert.equal( out, '<p data-pm-slice="1 1 []">x<a href="eznode://2">n</a><a href="#top">t</a><img id="eZObject_1" src="/i.png"><span class="ezoeItemCustomTag f" type="custom">c</span></p>' );
    // the markers count as attributes only, not as text of foreign HTML
    assert.equal( P.isEditorHTML( '<p>write customattributes="x" and data-pm-slice</p>' ), false );
    assert.equal( P.isEditorHTML( '<p data-pm-slice="0 0 []">x</p>' ), true );
} );

test( 'pasted HTML is parsed in an inert document, never in the page: no image loads, no handler runs', () => {
    const before = document.body.innerHTML;
    window.__pasted = 0;
    P.cleanPastedHTML( '<p>x<img src="https://example.invalid/x.png" onerror="window.__pasted=1"><svg onload="window.__pasted=1"></svg></p>' );
    assert.equal( window.__pasted, 0 );
    assert.equal( document.body.innerHTML, before );
    assert.equal( document.querySelectorAll( 'img[onerror]' ).length, 0 );
} );

test( 'plain text pasted into literal text keeps its line breaks in the literal', () => {
    const inst = editor( '<pre>a</pre>' );
    inst.editor.commands.setTextSelection( 2 );
    paste( inst, { 'text/plain': 'one\n\ntwo' } );
    assert.equal( inst.getHTML(), '<pre>aone<br><br>two</pre>' );
} );

test( 'after Ctrl+Shift+V another key ends the plain text paste: a following Ctrl+V keeps the formatting', () => {
    const inst = editor( '<p>x</p>' );
    inst.editor.commands.setTextSelection( 2 );
    const press = ( init ) => {
        const e = new KeyboardEvent( 'keydown', Object.assign( { bubbles: true, cancelable: true }, init ) );
        inst.editor.view.someProp( 'handleKeyDown', ( f ) => f( inst.editor.view, e ) );
    };
    press( { key: 'V', ctrlKey: true, shiftKey: true } );
    press( { key: 'v', ctrlKey: true } );
    paste( inst, { 'text/html': '<p><em>it</em></p>', 'text/plain': 'it' } );
    assert.match( inst.getHTML(), /<em>it<\/em>/ );
} );

test( 'a Word list that starts at level 2 nests in an item, not in empty lists', () => {
    const word = '<p class=MsoListParagraph style="mso-list:l0 level2 lfo1"><span style="mso-list:Ignore">o&nbsp;</span>Deep</p>';
    assert.equal( P.cleanPastedHTML( '<html xmlns:o="urn:schemas-microsoft-com:office:office"><body>' + word + '</body></html>' ).trim(), '<ul><li><ul><li>Deep</li></ul></li></ul>' );
} );
