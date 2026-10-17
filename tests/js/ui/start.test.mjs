/**
 * The editor starts from a file (node --test, happy-dom): the edit template writes each editor's options as a JSON
 * block after the textarea and carries no inline script; exp_oe_tiptap_start.js parses the blocks and calls
 * window.ExpOETiptap.init( textarea, options ) once per editor, waits for the page when the bundle comes later, and
 * leaves a textarea with broken options as plain text.
 *
 * @license GPL-2.0-or-later
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

const root = resolve( dirname( fileURLToPath( import.meta.url ) ), '../../..' );
const tpl = readFileSync( resolve( root, 'design/standard/templates/content/datatype/edit/ezxmltext_exp_oe_tiptap_editor.tpl' ), 'utf8' );
const source = readFileSync( resolve( root, 'design/standard/javascript/exp_oe_tiptap/exp_oe_tiptap_start.js' ), 'utf8' );

before( () => {
    GlobalRegistrator.register( { url: 'https://example.test/admin/content/edit/1/1' } );
} );
after( async () => {
    await GlobalRegistrator.unregister();
} );

// The page: textareas and their option blocks; runs the start file as the browser would
function page( html, bundle )
{
    document.body.innerHTML = html;
    // a new page: the start file has not run on it yet
    delete window.expOETiptapStart;
    delete window.expOETiptapStartAll;
    const calls = [], errors = [];
    if ( bundle )
        window.ExpOETiptap = { init: ( textarea, options ) => calls.push( { id: textarea.id, options } ) };
    else
        delete window.ExpOETiptap;
    const consoleError = console.error;
    console.error = ( message ) => errors.push( String( message ) );
    try
    {
        new Function( source )();
    }
    finally
    {
        console.error = consoleError;
    }
    return { calls, errors };
}
const block = ( id, json ) => '<textarea id="' + id + '"></textarea><script type="application/json" data-exp-oe-options-for="' + id + '">' + json + '</script>';

test( 'the template carries no inline script, only the start file and the JSON options', () => {
    const code = tpl.replace( /\{\*[\s\S]*?\*\}/g, '' );
    const scripts = [ ...code.matchAll( /<script\b([^>]*)>/g ) ].map( ( m ) => m[1] );
    assert.ok( scripts.length >= 2 );
    for ( const attributes of scripts )
        assert.ok( /\ssrc=/.test( attributes ) || /type="application\/json"/.test( attributes ), 'inline script: <script' + attributes + '>' );
    assert.ok( code.includes( "<script src=\"{'javascript/exp_oe_tiptap/exp_oe_tiptap_start.js'|ezdesign( 'no' )}\" charset=\"utf-8\" defer></script>" ) );
    assert.doesNotMatch( code, /\son[a-z]+\s*=/i, 'no event handler attribute' );
} );

test( 'the options block is JSON once the template values are in', () => {
    const code = tpl.replace( /\{\*[\s\S]*?\*\}/g, '' );
    const printed = code.match( /<script type="application\/json" data-exp-oe-options-for="[^"]*">([\s\S]*?)<\/script>/ )[1];
    // one set-block variable, printed with < and > as \u003c and \u003e: json_encode leaves "<!--" as it is, and
    // "<!--<script>" in a value would make the browser read past the block and skip the scripts after it
    const name = printed.match( /^\{\$(\w+)\|explode\( '<' \)\|implode\( '\\u003c' \)\|explode\( '>' \)\|implode\( '\\u003e' \)\}$/ );
    assert.ok( name, 'the block is printed through the escape chain: ' + printed );
    const json = code.match( new RegExp( '\\{set-block variable=\\$' + name[1] + '\\}([\\s\\S]*?)\\{/set-block\\}' ) )[1];
    // every template expression stands for one JSON value; {ldelim} and {rdelim} are the braces
    const filled = json.replace( /\{(?!ldelim\}|rdelim\})[^{}]*\}/g, '0' ).replace( /\{ldelim\}/g, '{' ).replace( /\{rdelim\}/g, '}' );
    const options = JSON.parse( filled );
    for ( const key of [ 'attributeId', 'buttons', 'urls', 'formToken', 'ai', 'i18n', 'customTagControls', 'sourceEditable', 'locale' ] )
        assert.ok( key in options, key );
    assert.equal( options.ai.call, 'expoetiptap::ai' );
    assert.deepEqual( Object.keys( options.urls ), [ 'root', 'ezoe', 'ezjscore', 'contentEdit', 'switch' ] );
} );

test( 'every editor starts once with its options', () => {
    const t = page( block( 'ContentObjectAttribute_data_text_5', '{"attributeId": 5, "buttons": ["bold"], "label": "<\\/script>", "trap": "\\u003c!--\\u003cscript\\u003e"}' )
                    + block( 'ContentObjectAttribute_data_text_6', '{"attributeId": 6}' ), true );
    assert.deepEqual( t.calls.map( ( c ) => c.id ), [ 'ContentObjectAttribute_data_text_5', 'ContentObjectAttribute_data_text_6' ] );
    assert.deepEqual( t.calls[0].options, { attributeId: 5, buttons: [ 'bold' ], label: '</script>', trap: '<!--<script>' } );
    window.expOETiptapStartAll();
    assert.equal( t.calls.length, 2, 'a second start starts no editor twice' );
    assert.equal( typeof window.expOETiptapStart, 'function' );
    assert.deepEqual( t.errors, [] );
} );

test( 'broken options leave the textarea as plain text and say so', () => {
    const t = page( block( 'a', '{broken' ) + block( 'b', '{"attributeId": 2}' ), true );
    assert.deepEqual( t.calls.map( ( c ) => c.id ), [ 'b' ] );
    assert.equal( t.errors.length, 1 );
    assert.match( t.errors[0], /options of a are not valid JSON/ );
} );

test( 'without the bundle the start waits for the page, then the textarea stays and the console says why', () => {
    Object.defineProperty( document, 'readyState', { configurable: true, get: () => 'interactive' } );
    const t = page( block( 'a', '{}' ), false );
    assert.deepEqual( t.errors, [], 'nothing yet while the page is parsed' );
    // a bundle that comes later on the page is there when the page is parsed
    window.ExpOETiptap = { init: ( textarea, options ) => t.calls.push( { id: textarea.id, options } ) };
    document.dispatchEvent( new Event( 'DOMContentLoaded' ) );
    assert.deepEqual( t.calls.map( ( c ) => c.id ), [ 'a' ] );

    const u = page( block( 'b', '{}' ), false );
    const consoleError = console.error;
    console.error = ( message ) => u.errors.push( String( message ) );
    try
    {
        document.dispatchEvent( new Event( 'DOMContentLoaded' ) );
    }
    finally
    {
        console.error = consoleError;
        delete document.readyState;
    }
    assert.deepEqual( u.calls, [] );
    assert.match( u.errors[0], /bundle is not loaded, editing b as plain text/ );
} );

test( 'an editor added after DOMContentLoaded and before load starts, at once with the bundle, else on load', () => {
    Object.defineProperty( document, 'readyState', { configurable: true, get: () => 'interactive' } );
    try
    {
        // DOMContentLoaded is past: the bundle is there, so the editor starts at once
        const t = page( block( 'late', '{"attributeId": 9}' ), true );
        assert.deepEqual( t.calls.map( ( c ) => c.id ), [ 'late' ] );

        // DOMContentLoaded is past and the bundle comes later: load starts it, once
        const u = page( block( 'later', '{}' ), false );
        assert.deepEqual( u.calls, [] );
        window.ExpOETiptap = { init: ( textarea ) => u.calls.push( { id: textarea.id } ) };
        window.dispatchEvent( new Event( 'load' ) );
        document.dispatchEvent( new Event( 'DOMContentLoaded' ) );
        window.dispatchEvent( new Event( 'load' ) );
        assert.deepEqual( u.calls.map( ( c ) => c.id ), [ 'later' ], 'started once' );
        assert.deepEqual( u.errors, [] );
    }
    finally
    {
        delete document.readyState;
    }
} );

test( 'while the page is loading the start waits for DOMContentLoaded', () => {
    Object.defineProperty( document, 'readyState', { configurable: true, get: () => 'loading' } );
    try
    {
        const t = page( block( 'parsing', '{}' ), false );
        window.ExpOETiptap = { init: ( textarea ) => t.calls.push( { id: textarea.id } ) };
        window.dispatchEvent( new Event( 'load' ) );
        assert.deepEqual( t.calls, [], 'not on load alone while loading' );
        document.dispatchEvent( new Event( 'DOMContentLoaded' ) );
        assert.deepEqual( t.calls.map( ( c ) => c.id ), [ 'parsing' ] );
    }
    finally
    {
        delete document.readyState;
    }
} );

test( 'the file included once per editor starts every editor once and defines its functions once', () => {
    const t = page( block( 'one', '{"attributeId": 1}' ), true );
    const start = window.expOETiptapStart, startAll = window.expOETiptapStartAll;
    // the second editor of the page and its own include of the file
    document.body.insertAdjacentHTML( 'beforeend', block( 'two', '{"attributeId": 2}' ) );
    new Function( source )();
    new Function( source )();
    assert.deepEqual( t.calls.map( ( c ) => c.id ), [ 'one', 'two' ] );
    assert.equal( window.expOETiptapStart, start );
    assert.equal( window.expOETiptapStartAll, startAll );
} );
