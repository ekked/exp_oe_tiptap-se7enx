/**
 * Empty paragraphs that only TinyMCE's way of editing needs do not become content (node --test, happy-dom):
 * the <p><br></p> eZOEXMLInput::inputXML() appends, and the empty paragraphs the HTML parser of a browser makes around
 * <p><table>...</table></p>. Each fixture goes through Tiptap three times, as the field does when it is stored and
 * edited again; the full way through eZOEInputParser is tests/php/EmptyParagraphRoundtripTest.php.
 *
 * @license GPL-2.0-or-later
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

let S, X;

before( async () => {
    GlobalRegistrator.register( { url: 'https://example.test/admin/content/edit/1/1' } );
    S = await import( '../../../src/js/schema/index.js' );
    X = ( await import( '../../../src/js/index.js' ) ).default;
} );
after( async () => {
    for ( const i of X.instances.slice() )
        X.destroy( i.textarea );
    await GlobalRegistrator.unregister();
} );

const TABLE = '<table border="1"><tbody><tr><td><p>cell</p></td></tr></tbody></table>';

/** What eZOEXMLInput::inputXML() writes for the stored text: the posted HTML plus the empty paragraph for the cursor */
const inputXML = ( posted ) => posted + '<p><br></p>';

/**
 * The textarea value as a browser's HTML parser reads it: <p><table> closes the <p> before the table (happy-dom does
 * that too), and the stray </p> after it becomes an empty <p></p> (happy-dom drops it, so it is added here).
 */
const asBrowser = ( html ) => html.replace( /<\/table><\/p>/g, '</table></p><p></p>' );

const FIXTURES = {
    'paragraph alone': [ '<p>Kurzfassung E2E.</p><p><br></p>', '<p>Kurzfassung E2E.</p>' ],
    'table at the end': [ '<p>Before.</p><p>' + TABLE + '</p><p><br></p>', '<p>Before.</p><p>' + TABLE + '</p>' ],
    'table in the middle': [ '<p>Before.</p><p>' + TABLE + '</p><p>After.</p><p><br></p>', '<p>Before.</p><p>' + TABLE + '</p><p>After.</p>' ],
    'table first': [ '<p>' + TABLE + '</p><p>After.</p><p><br></p>', '<p>' + TABLE + '</p><p>After.</p>' ],
    'two tables': [ '<p>' + TABLE + '</p><p>' + TABLE + '</p><p><br></p>', '<p>' + TABLE + '</p><p>' + TABLE + '</p>' ],
    'a wanted empty paragraph between two': [ '<p>One.</p><p><br></p><p>Two.</p><p><br></p>', '<p>One.</p><p><br></p><p>Two.</p>' ],
    'lines with a <br> at the end': [ '<p>first<br>second<br></p><p><br></p>', '<p>first<br>second<br></p>' ]
};

const topLevelTypes = ( json ) => json.content.map( ( n ) => n.type + ( n.type === 'paragraph' && !n.content ? '(empty)' : '' ) );

for ( const [ name, [ ezoe, posted ] ] of Object.entries( FIXTURES ) ) {
    test( name + ': the posted HTML and the document stay the same after 1, 2 and 3 passes', () => {
        let html = asBrowser( ezoe );
        let firstDoc = null;
        for ( let pass = 1; pass <= 3; pass++ ) {
            const json = S.fromEditorHTML( html, { document } );
            if ( firstDoc === null )
                firstDoc = json;
            assert.deepEqual( json, firstDoc, name + ', pass ' + pass + ': the document' );
            const out = S.toEditorHTML( json, { document } );
            assert.equal( out, posted, name + ', pass ' + pass + ': the posted HTML' );
            html = asBrowser( inputXML( out ) );
        }
    } );
}

test( 'no empty paragraph around a table or at the end of the document', () => {
    const json = S.fromEditorHTML( asBrowser( FIXTURES[ 'table in the middle' ][ 0 ] ), { document } );
    assert.deepEqual( topLevelTypes( json ), [ 'paragraph', 'table', 'paragraph' ] );
    assert.deepEqual( topLevelTypes( S.fromEditorHTML( asBrowser( FIXTURES[ 'table at the end' ][ 0 ] ), { document } ) ), [ 'paragraph', 'table' ] );
    assert.deepEqual( topLevelTypes( S.fromEditorHTML( FIXTURES[ 'paragraph alone' ][ 0 ], { document } ) ), [ 'paragraph' ] );
} );

test( 'an empty paragraph of the text is kept, as an empty paragraph and not as a line break', () => {
    const json = S.fromEditorHTML( FIXTURES[ 'a wanted empty paragraph between two' ][ 0 ], { document } );
    assert.deepEqual( topLevelTypes( json ), [ 'paragraph', 'paragraph(empty)', 'paragraph' ] );
    assert.deepEqual( topLevelTypes( S.fromEditorHTML( '<p><br data-mce-bogus="1"></p>', { document } ) ), [ 'paragraph(empty)' ] );
} );

test( 'empty paragraphs at the end are not posted, attributes or not-empty ones are', () => {
    assert.equal( S.toEditorHTML( S.fromEditorHTML( '<p>a</p><p><br></p><p><br></p><p><br></p>', { document } ), { document } ), '<p>a</p>' );
    assert.equal( S.toEditorHTML( S.fromEditorHTML( '<p>a</p><p class="x"><br></p>', { document } ), { document } ), '<p>a</p><p class="x"><br></p>' );
    assert.equal( S.toEditorHTML( S.fromEditorHTML( '<p><br></p>', { document } ), { document } ), '' );
} );

test( 'a fragment (a dialog\'s HTML) keeps its empty last paragraph', () => {
    assert.deepEqual( topLevelTypes( S.fromEditorHTML( '<p>a</p><p><br></p>', { document, fragment: true } ) ), [ 'paragraph', 'paragraph(empty)' ] );
} );

test( 'a table after the line of block embeds is posted without a <p>, so no embed is written inside a paragraph', () => {
    const embed = '<div id="eZObject_1" title="Object" alt="medium" view="embed" inline="false" class="ezoeItemNonEditable ezoeItemContentTypeObjects">ezembed</div>';
    // inputXML() writes the line and the table in one <p>; eZOEInputParser stores the same paragraph from the
    // unwrapped form, but would keep "ezembed" as the text of an <embed> written inside a <p>
    const stored = '<p>' + embed + embed + '<br>' + TABLE + '</p><p>After.</p>';
    const posted = embed + embed + '<br>' + TABLE + '<p>After.</p>';
    let html = asBrowser( inputXML( stored ) );
    for ( let pass = 0; pass < 3; pass++ ) {
        html = S.toEditorHTML( S.fromEditorHTML( html, { document } ), { document } );
        assert.equal( html, posted, 'pass ' + ( pass + 1 ) );
    }
} );

test( 'block embeds in the cells of a table posted in a <p> lose the "ezembed" placeholder, so it never becomes the text of the <embed>', () => {
    const embed = text => '<div id="eZObject_1" title="Object" alt="medium" view="embed" inline="false" align="center" class="ezoeItemNonEditable ezoeItemContentTypeObjects">' + text + '</div>';
    // eZOEInputParser keeps "ezembed" as the text of the stored <embed> when the embed is the first thing in a cell of
    // a table inside a <p>; an empty <div> becomes the same <embed> without text
    const table = text => '<table width="100%" border="0" class="default"><tbody><tr><td width="49%">' + embed( text ) +
        '</td><td><p>Some neutral text.</p></td><td width="49%">' + embed( text ) + '</td></tr></tbody></table>';
    const posted = '<p>' + table( '' ) + '</p><p>After.</p>';
    let html = '<p>' + table( '<div class="object-center">Preview</div>' ) + '</p><p>After.</p>';
    for ( let pass = 0; pass < 3; pass++ ) {
        html = S.toEditorHTML( S.fromEditorHTML( html, { document } ), { document } );
        assert.equal( html, posted, 'pass ' + ( pass + 1 ) );
    }
    // the preview is kept for display (save: false), and an embed outside a table keeps its placeholder
    const shown = S.toEditorHTML( S.fromEditorHTML( '<p>' + table( '<div class="object-center">Preview</div>' ) + '</p>', { document } ), { document, save: false } );
    assert.ok( shown.includes( '>Preview</div></div>' ), shown );
    assert.ok( S.toEditorHTML( S.fromEditorHTML( embed( 'x' ) + '<p>After.</p>', { document } ), { document } ).includes( '>ezembed</div>' ) );
} );

test( 'a table in a list item is posted in a paragraph of its own; a <br> without embeds before a table stays out of it', () => {
    const li = '<ul><li><p>item</p><p>' + TABLE + '</p></li></ul>';
    assert.equal( S.toEditorHTML( S.fromEditorHTML( asBrowser( inputXML( li ) ), { document } ), { document } ), li );
    const out = S.toEditorHTML( S.fromEditorHTML( '<p>a</p><br>' + TABLE, { document } ), { document } );
    assert.ok( out.includes( '<br><p><table' ), out );
} );

test( 'the editor: the field gets no empty paragraphs when the text is changed, and the same ones on every switch', () => {
    const form = document.createElement( 'form' );
    document.body.appendChild( form );
    let value = asBrowser( FIXTURES[ 'table in the middle' ][ 0 ] );
    for ( let pass = 1; pass <= 3; pass++ ) {
        const t = document.createElement( 'textarea' );
        t.name = t.id = 'ContentObjectAttribute_data_text_' + pass;
        t.value = value;
        form.appendChild( t );
        const inst = X.init( t, { attributeId: pass, buttons: [ 'bold' ], i18n: {}, ai: { enabled: false } } );
        assert.deepEqual( topLevelTypes( inst.editor.getJSON() ), [ 'paragraph', 'table', 'paragraph' ], 'pass ' + pass );
        inst.editor.commands.setTextSelection( 2 );
        inst.editor.commands.insertContent( 'x' );
        inst.editor.commands.undo();
        inst.sync();
        assert.equal( t.value, FIXTURES[ 'table in the middle' ][ 1 ], 'pass ' + pass );
        X.destroy( t );
        value = asBrowser( inputXML( t.value ) );
    }
} );
