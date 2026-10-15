/**
 * The source view (node --test, happy-dom): the posted HTML, read only, one block per line; formatting adds only
 * white space between blocks.
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

function editor( html ) {
    const t = document.createElement( 'textarea' );
    t.id = t.name = 'ContentObjectAttribute_data_text_' + Math.floor( Math.random() * 1e6 );
    t.value = html;
    form.appendChild( t );
    return X.init( t, {
        attributeId: 42, contentObjectId: 1, version: 1, language: 'eng-GB', rows: 10, skin: 'a4',
        buttons: [ 'bold', '|', 'code' ], urls: { root: '/', ezoe: '/ezoe/', ezjscore: '/ezjscore/' }, formToken: 'T', ai: { enabled: false }
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

test( 'the code button shows the posted HTML read only, with a copy button', () => {
    const inst = editor( '<p>Hello <em>world</em></p><table><tbody><tr><td><p>c</p></td></tr></tbody></table>' );
    assert.ok( inst.toolbar.controls.code );
    inst.runButton( 'code' );
    const dialog = document.querySelector( '.exp-oe-dialog.exp-oe-source' );
    const area = dialog.querySelector( 'textarea' );
    assert.equal( area.readOnly, true );
    assert.equal( area.value, '<p>Hello <em>world</em></p>\n<table>\n  <tbody>\n    <tr>\n      <td>\n        <p>c</p>\n      </td>\n    </tr>\n  </tbody>\n</table>' );
    assert.match( dialog.textContent, /characters/ );
    assert.deepEqual( Array.prototype.map.call( dialog.querySelectorAll( '.exp-oe-dialog-footer button' ), ( b ) => b.textContent ), [ 'Copy', 'Close' ] );
    dialog.querySelector( '.exp-oe-primary' ).click();
    assert.equal( document.querySelector( '.exp-oe-dialog' ), null );
} );
