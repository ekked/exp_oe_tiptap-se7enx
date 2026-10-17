/**
 * Autolink (node --test, happy-dom, #1121): a URL closed by a space becomes a link, the space stays outside.
 *
 * @license GPL-2.0-or-later
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

let X, form, urlAtEnd;

before( async () => {
    GlobalRegistrator.register( { url: 'https://example.test/admin/content/edit/1/1' } );
    X = ( await import( '../../../src/js/index.js' ) ).default;
    urlAtEnd = ( await import( '../../../src/js/editor/autolink.js' ) ).urlAtEnd;
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
        attributeId: 42, contentObjectId: 1, version: 1, language: 'eng-GB', rows: 10, skin: 'o2k7',
        buttons: [ 'bold' ], urls: { root: '/', ezoe: '/ezoe/', ezjscore: '/ezjscore/' }, formToken: 'T', ai: { enabled: false }
    } );
}

function typeText( inst, text ) {
    const view = inst.editor.view;
    for ( const ch of text ) {
        const { from, to } = view.state.selection;
        if ( !view.someProp( 'handleTextInput', ( f ) => f( view, from, to, ch ) ) )
            view.dispatch( view.state.tr.insertText( ch, from, to ) );
    }
}

function enter( inst ) {
    const view = inst.editor.view;
    const e = new KeyboardEvent( 'keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true } );
    view.someProp( 'handleKeyDown', ( f ) => f( view, e ) );
}

function typed( html, text ) {
    const inst = editor( html );
    inst.editor.commands.focus( 'end' );
    typeText( inst, text );
    return inst.getHTML();
}

test( 'urlAtEnd finds http(s) and www words, not plain words', () => {
    assert.deepEqual( urlAtEnd( 'see https://example.org' ), { start: 4, url: 'https://example.org', href: 'https://example.org', trailing: 0 } );
    assert.equal( urlAtEnd( 'www.example.org' ).href, 'https://www.example.org' );
    assert.equal( urlAtEnd( 'example.org' ), null );
    assert.equal( urlAtEnd( 'see ' ), null );
    assert.equal( urlAtEnd( 'https://.' ), null );
} );

test( 'urlAtEnd keeps trailing punctuation outside the URL', () => {
    assert.deepEqual( urlAtEnd( 'Mehr unter https://x.org.' ), { start: 11, url: 'https://x.org', href: 'https://x.org', trailing: 1 } );
    assert.equal( urlAtEnd( 'a https://x.org/a?b=1;' ).url, 'https://x.org/a?b=1' );
    assert.equal( urlAtEnd( 'a https://x.org/…' ).url, 'https://x.org/' );
    assert.equal( urlAtEnd( 'a https://x.org»' ).trailing, 1 );
    assert.equal( urlAtEnd( 'a https://x.org?c=\'d\'' ).url, 'https://x.org?c=\'d' );
    assert.equal( urlAtEnd( 'a https://x.org!?' ).trailing, 2 );
} );

test( 'urlAtEnd strips a closing parenthesis only if the URL has no unclosed one', () => {
    const wiki = urlAtEnd( 'https://en.wikipedia.org/wiki/Foo_(bar)' );
    assert.equal( wiki.url, 'https://en.wikipedia.org/wiki/Foo_(bar)' );
    assert.equal( wiki.trailing, 0 );
    const paren = urlAtEnd( '(www.example.org)' );
    assert.equal( paren.url, 'www.example.org' );
    assert.equal( paren.start, 1 );
    assert.equal( paren.trailing, 1 );
    assert.equal( urlAtEnd( '(siehe https://x.org/a_(b))' ).url, 'https://x.org/a_(b)' );
} );

test( 'urlAtEnd accepts opening brackets and quotes before the URL', () => {
    for ( const open of [ '(', '[', '„', '«', '"' ] )
        assert.equal( urlAtEnd( open + 'https://x.org' ).start, 1, open );
    assert.equal( urlAtEnd( 'ahttps://x.org' ), null );
} );

test( 'urlAtEnd ends at an inline atom and may follow one (U+FFFC)', () => {
    assert.equal( urlAtEnd( 'https://x.org\ufffc' ), null );
    assert.equal( urlAtEnd( 'a\ufffchttps://x.org' ).start, 2 );
} );

test( 'a URL followed by a space becomes a link and the space stays outside', () => {
    assert.equal( typed( '<p></p>', 'siehe https://example.org und' ), '<p>siehe <a href="https://example.org">https://example.org</a> und</p>' );
} );

test( 'www. gets https:// in the href, the text stays', () => {
    assert.equal( typed( '<p></p>', 'www.example.org ' ), '<p><a href="https://www.example.org">www.example.org</a> </p>' );
} );

test( 'punctuation after the URL stays outside the link in the editor', () => {
    assert.equal( typed( '<p></p>', 'Mehr unter https://x.org. Dann' ), '<p>Mehr unter <a href="https://x.org">https://x.org</a>. Dann</p>' );
    assert.equal( typed( '<p></p>', '(www.example.org) ' ), '<p>(<a href="https://www.example.org">www.example.org</a>) </p>' );
    assert.equal( typed( '<p></p>', 'https://en.wikipedia.org/wiki/Foo_(bar) ' ),
        '<p><a href="https://en.wikipedia.org/wiki/Foo_(bar)">https://en.wikipedia.org/wiki/Foo_(bar)</a> </p>' );
} );

test( 'a hard break ends the word: the URL is linked without it, or not at all after it', () => {
    const inst = editor( '<p>https://x.org<br></p>' );
    inst.editor.commands.focus( 'end' );
    typeText( inst, ' ' );
    assert.ok( !inst.getHTML().includes( 'href=' ), inst.getHTML() );
    const inst2 = editor( '<p>a<br>https://x.org</p>' );
    inst2.editor.commands.focus( 'end' );
    typeText( inst2, ' ' );
    assert.equal( inst2.getHTML(), '<p>a<br><a href="https://x.org">https://x.org</a> </p>' );
} );

test( 'a word that is already a link keeps its href when a space follows', () => {
    const html = '<p><a href="https://a.example">https://x.org</a></p>';
    const inst = editor( html );
    inst.editor.commands.focus( 'end' );
    typeText( inst, ' ' );
    assert.equal( inst.getHTML(), '<p><a href="https://a.example">https://x.org</a> </p>' );
} );

test( 'no link inside a literal block', () => {
    const inst = editor( '<pre>x</pre>' );
    inst.editor.commands.focus( 'end' );
    typeText( inst, ' https://x.org ' );
    assert.ok( !inst.getHTML().includes( '<a ' ), inst.getHTML() );
} );

test( 'no link without the closing space', () => {
    assert.ok( !typed( '<p></p>', 'https://example.org' ).includes( 'href=' ) );
} );

test( 'Enter links the URL before the cursor', () => {
    const inst = editor( '<p></p>' );
    inst.editor.commands.focus( 'end' );
    typeText( inst, 'siehe https://example.org' );
    enter( inst );
    assert.ok( inst.getHTML().includes( '<a href="https://example.org">https://example.org</a>' ), inst.getHTML() );
} );

test( 'Enter after a URL with a closing parenthesis keeps the parenthesis outside', () => {
    const inst = editor( '<p></p>' );
    inst.editor.commands.focus( 'end' );
    typeText( inst, '(https://example.org)' );
    enter( inst );
    assert.ok( inst.getHTML().includes( '(<a href="https://example.org">https://example.org</a>)' ), inst.getHTML() );
} );
