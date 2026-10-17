/**
 * Atomic inline custom tags (node --test, happy-dom): the inline custom tags of exp_oe_tiptap.ini [EditorSettings]
 * AtomicInlineCustomTags[] (math_latex and math_mathml by default) are one piece in the editor (the inline node
 * ezCustomInlineAtom), the other inline custom tags stay marks.
 *
 * As marks, formulas were damaged by ordinary edits:
 *  - A1: editing an inline custom tag in the custom tag dialog nested a second tag in it (also for marks);
 *  - A2: bold, italic or a link around a formula went inside it after any edit (the custom mark is outermost), and
 *        the TeX source then held markup;
 *  - A3: two adjacent formulas with the same attributes merged into one;
 *  - Enter split a formula, typing after it went into it, converting to literal dropped it, remove formatting
 *    removed it.
 * The stored HTML of unedited content stays byte for byte what ezoe wrote.
 *
 * @license GPL-2.0-or-later
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

let X, M, S, NodeSelection, TextSelection, getSchema, form;

before( async () => {
    GlobalRegistrator.register( { url: 'https://example.test/admin/content/edit/1/1' } );
    X = ( await import( '../../../src/js/index.js' ) ).default;
    M = await import( '../../../src/js/schema/index.js' );
    S = await import( '../../../src/js/ai/structure.js' );
    ( { NodeSelection, TextSelection } = await import( '@tiptap/pm/state' ) );
    ( { getSchema } = await import( '@tiptap/core' ) );
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
    form.addEventListener( 'submit', ( e ) => e.preventDefault() );
    document.body.appendChild( form );
} );

const attr = ( id, extra ) => Object.assign( { id, name: id.charAt( 0 ).toUpperCase() + id.slice( 1 ), type: 'text', title: '' }, extra || {} );
const DISPLAY = attr( 'display', { type: 'select', selection: { inline: 'inline', block: 'block' } } );
const TAGS = [
    { name: 'math_latex', title: 'LaTeX', inline: true, attributes: [ DISPLAY, attr( 'alt' ) ] },
    { name: 'math_mathml', title: 'MathML', inline: true, attributes: [ DISPLAY, attr( 'mathml', { type: 'textarea' } ) ] },
    { name: 'strike', title: 'Strike', inline: true, attributes: [ attr( 'tone' ) ] },
    { name: 'factbox', title: 'Fact box', inline: false, attributes: [ attr( 'title' ) ] }
];
const OPTIONS = {
    attributeId: 42, contentObjectId: 1, version: 1, language: 'eng-GB', rows: 10,
    buttons: [ 'bold', 'italic', 'removeformat', 'literal', 'custom' ],
    urls: { root: '/', ezoe: '/ezoe/', ezjscore: '/ezjscore/' }, formToken: 'TOKEN', i18n: {}, locale: 'en-GB',
    ai: { enabled: false }, customTags: TAGS, customTagControls: true
};

const latex = ( text, alt, display ) => '<span class="ezoeItemCustomTag math_latex" type="custom" customattributes="display|' + ( display || 'inline' ) +
    'attribute_separationalt|' + ( alt || 'x' ) + '">' + text + '</span>';

function textarea( html ) {
    const t = document.createElement( 'textarea' );
    t.id = t.name = 'ContentObjectAttribute_data_text_' + Math.floor( Math.random() * 1e6 );
    t.value = html;
    form.appendChild( t );
    return t;
}

function start( html, options ) {
    const t = textarea( html );
    const inst = X.init( t, Object.assign( {}, OPTIONS, options || {} ) );
    return { t, inst, editor: inst.editor };
}

/** positions of the atoms in the document, in order */
function atoms( editor ) {
    const found = [];
    editor.state.doc.descendants( ( node, pos ) => {
        if ( node.type.name === 'ezCustomInlineAtom' )
            found.push( { node, pos } );
    } );
    return found;
}

function selectAtom( inst, index = 0 ) {
    const { pos } = atoms( inst.editor )[ index ];
    inst.editor.view.dispatch( inst.editor.state.tr.setSelection( NodeSelection.create( inst.editor.state.doc, pos ) ) );
    inst.updateUI();
}

function textPos( editor, text ) {
    let at = null;
    editor.state.doc.descendants( ( node, pos ) => {
        if ( at === null && node.isText && node.text.indexOf( text ) !== -1 )
            at = pos + node.text.indexOf( text );
    } );
    assert.notEqual( at, null, 'text ' + text );
    return at;
}

function select( inst, from, to ) {
    inst.editor.view.dispatch( inst.editor.state.tr.setSelection( TextSelection.create( inst.editor.state.doc, from, to === undefined ? from : to ) ) );
    inst.updateUI();
}

const dialog = () => document.querySelector( '.exp-oe-dialog' );
function fieldOf( label ) {
    const l = Array.prototype.find.call( dialog().querySelectorAll( 'label' ), ( x ) => x.textContent.replace( ' *', '' ) === label );
    assert.ok( l, 'field ' + label );
    return document.getElementById( l.getAttribute( 'for' ) );
}
function setField( label, value ) {
    const el = fieldOf( label );
    el.value = value;
    el.dispatchEvent( new Event( 'change', { bubbles: true } ) );
}
function ok() {
    dialog().querySelector( '.exp-oe-primary' ).click();
    assert.equal( dialog(), null, 'the dialog is closed' );
}

// ------------------------------------------------------------------ schema, unedited content

test( 'formulas are inline atoms, other inline custom tags stay marks, and the HTML is the same byte for byte', () => {
    const html = '<p>A ' + latex( '\\pi r^2', 'pi r' ) + ' b <span class="ezoeItemCustomTag strike" type="custom">old</span> c ' +
        '<span class="ezoeItemCustomTag math_mathml" type="custom" customattributes="display|inlineattribute_separationmathml|m">a</span></p>';
    const json = M.fromEditorHTML( html );
    const inline = json.content[ 0 ].content;
    assert.equal( inline[ 1 ].type, 'ezCustomInlineAtom' );
    assert.equal( inline[ 1 ].attrs.text, '\\pi r^2' );
    assert.equal( inline[ 3 ].type, 'text' );
    assert.equal( inline[ 3 ].marks[ 0 ].type, 'ezCustomInline' );
    assert.equal( inline[ 5 ].type, 'ezCustomInlineAtom' );
    assert.equal( M.toEditorHTML( json ), html );
} );

test( 'A2/A3 unedited: bold around a formula stays outside, adjacent formulas with the same attributes stay two', () => {
    const html = '<p><strong>fett ' + latex( 'x^2' ) + '</strong> and ' + latex( 'a' ) + latex( 'b' ) + ' and x' + latex( '&nbsp;a+b ' ) + 'y</p>';
    assert.equal( M.normalizeEditorHTML( html ), html );
    const { t, inst, editor } = start( html + '<p>second</p>' );
    // an edit somewhere else
    select( inst, textPos( editor, 'second' ) + 6 );
    editor.commands.insertContent( ' more' );
    assert.equal( t.value, html + '<p>second more</p>' );
    assert.equal( atoms( editor ).length, 4 );
} );

test( 'an atomic tag with markup inside (stored that way) stays a mark and keeps its markup', () => {
    const html = '<p>' + latex( 'a<strong>b</strong>c' ) + '</p>';
    const json = M.fromEditorHTML( html );
    assert.ok( json.content[ 0 ].content.every( ( n ) => n.type === 'text' ) );
    assert.equal( M.toEditorHTML( json ), html );
} );

test( 'the list of atomic tags is an option: other names, or none', () => {
    const html = '<p>' + latex( 'x' ) + ' <span class="ezoeItemCustomTag strike" type="custom">s</span></p>';
    const strikeOnly = { extensions: M.ezoeExtensions( { atomicInlineCustomTags: [ 'strike' ] } ) };
    const inline = M.fromEditorHTML( html, strikeOnly ).content[ 0 ].content;
    assert.equal( inline[ 0 ].type, 'text' );
    assert.equal( inline[ 2 ].type, 'ezCustomInlineAtom' );
    assert.equal( M.normalizeEditorHTML( html, strikeOnly ), html );
    const none = { extensions: M.ezoeExtensions( { atomicInlineCustomTags: [] } ) };
    assert.ok( M.fromEditorHTML( html, none ).content[ 0 ].content.every( ( n ) => n.type === 'text' ) );
    assert.deepEqual( M.atomicCustomTagNames( getSchema( M.ezoeExtensions() ) ), M.DEFAULT_ATOMIC_INLINE_CUSTOM_TAGS );
    // and the editor takes it from its options (exp_oe_tiptap.ini [EditorSettings] AtomicInlineCustomTags[])
    const { editor } = start( html, { atomicInlineCustomTags: [ 'strike' ] } );
    assert.deepEqual( atoms( editor ).map( ( a ) => a.node.attrs.class ), [ 'ezoeItemCustomTag strike' ] );
} );

// ------------------------------------------------------------------ A1: the custom tag dialog

test( 'A1: editing a formula in the custom tag dialog replaces its attributes, it does not nest a second one', () => {
    const { t, inst } = start( '<p>Text ' + latex( 'MATH', 'alt' ) + ' end</p>' );
    selectAtom( inst );
    inst.runButton( 'custom' );
    assert.equal( fieldOf( 'Content' ).value, 'MATH' );
    assert.equal( fieldOf( 'Alt' ).value, 'alt' );
    fieldOf( 'Alt' ).value = 'neu';
    ok();
    assert.equal( t.value, '<p>Text ' + latex( 'MATH', 'neu' ) + ' end</p>' );
} );

test( 'A1: the content field changes the text of the formula, also with the keyboard shortcut', () => {
    const { t, inst, editor } = start( '<p>Text ' + latex( 'MATH', 'alt' ) + ' end</p>' );
    selectAtom( inst );
    const event = new KeyboardEvent( 'keydown', { key: 'E', altKey: true, shiftKey: true, bubbles: true, cancelable: true } );
    assert.ok( editor.view.someProp( 'handleKeyDown', ( f ) => f( editor.view, event ) ) );
    fieldOf( 'Content' ).value = 'a < b & c';
    ok();
    assert.equal( t.value, '<p>Text ' + latex( 'a &lt; b &amp; c', 'alt' ) + ' end</p>' );
} );

test( 'A1: editing an inline custom tag that is a mark replaces it too', () => {
    // (happy-dom selects the wrong option of a longer list built with a selected option, so the list is short)
    const { t, inst, editor } = start( '<p>a <span class="ezoeItemCustomTag strike" type="custom" customattributes="tone|soft">struck</span> b</p>',
                                       { customTags: [ TAGS[ 2 ], TAGS[ 0 ] ] } );
    select( inst, textPos( editor, 'struck' ) + 2 );
    inst.runButton( 'custom' );
    assert.equal( fieldOf( 'Tone' ).value, 'soft' );
    assert.throws( () => fieldOf( 'Content' ) );
    fieldOf( 'Tone' ).value = 'loud';
    ok();
    assert.equal( t.value, '<p>a <span class="ezoeItemCustomTag strike" type="custom" customattributes="tone|loud">struck</span> b</p>' );
} );

test( 'a new formula takes the selected text as its content, as one piece', () => {
    const { t, inst, editor } = start( '<p>x^2 here</p>' );
    const at = textPos( editor, 'x^2' );
    select( inst, at, at + 3 );
    inst.runButton( 'custom' );
    setField( 'Name', 'math_latex' );
    assert.equal( fieldOf( 'Content' ).value, 'x^2' );
    fieldOf( 'Alt' ).value = 'x squared';
    ok();
    assert.equal( t.value, '<p>' + latex( 'x^2', 'x squared' ) + ' here</p>' );
    assert.equal( atoms( editor ).length, 1 );
    // the command does the same
    select( inst, textPos( editor, 'here' ), textPos( editor, 'here' ) + 4 );
    editor.commands.setCustomInline( 'math_latex', 'alt|h' );
    assert.equal( atoms( editor ).length, 2 );
    assert.equal( atoms( editor )[ 1 ].node.attrs.text, 'here' );
} );

// ------------------------------------------------------------------ A2: formatting around a formula

test( 'A2: bold over a sentence with a formula wraps the formula, bold on the formula alone too', () => {
    const { t, inst, editor } = start( '<p>Text ' + latex( 'MATH' ) + ' end</p><p>' + latex( 'y' ) + '</p>' );
    select( inst, 1, editor.state.doc.firstChild.nodeSize - 1 );
    inst.runButton( 'bold' );
    selectAtom( inst, 1 );
    inst.runButton( 'italic' );
    assert.equal( t.value, '<p><strong>Text ' + latex( 'MATH' ) + ' end</strong></p><p><em>' + latex( 'y' ) + '</em></p>' );
} );

test( 'remove formatting removes the bold around a formula and keeps the formula', () => {
    const { t, inst, editor } = start( '<p><strong>fett ' + latex( 'x^2' ) + '</strong> <span class="ezoeItemCustomTag strike" type="custom">s</span></p>' );
    select( inst, 1, editor.state.doc.firstChild.nodeSize - 1 );
    inst.runButton( 'removeformat' );
    assert.equal( t.value, '<p>fett ' + latex( 'x^2' ) + ' s</p>' );
} );

// ------------------------------------------------------------------ typing, Enter, literal, removing

test( 'Enter next to a formula does not split it, typing after it does not go into it', () => {
    const { t, inst, editor } = start( '<p>a ' + latex( 'MATH' ) + ' b</p>' );
    const { pos, node } = atoms( editor )[ 0 ];
    select( inst, pos + node.nodeSize );
    editor.commands.insertContent( 'plus' );
    assert.equal( t.value, '<p>a ' + latex( 'MATH' ) + 'plus b</p>' );
    select( inst, pos + node.nodeSize );
    editor.commands.splitBlock();
    assert.equal( t.value, '<p>a ' + latex( 'MATH' ) + '</p><p>plus b</p>' );
} );

test( 'converting a paragraph to literal keeps the text of its formulas', () => {
    const { t, inst, editor } = start( '<p>a <strong>' + latex( 'x^2' ) + '</strong> b</p>' );
    select( inst, textPos( editor, 'a' ) );
    inst.runButton( 'literal' );
    assert.equal( t.value, '<pre>a x^2 b</pre>' );
} );

test( 'remove (Alt+Shift+Delete) turns a formula into its text, with the formatting it had', () => {
    const { t, inst, editor } = start( '<p>a <em>' + latex( 'x^2' ) + '</em> b</p>' );
    selectAtom( inst );
    const event = new KeyboardEvent( 'keydown', { key: 'Delete', altKey: true, shiftKey: true, bubbles: true, cancelable: true } );
    assert.ok( editor.view.someProp( 'handleKeyDown', ( f ) => f( editor.view, event ) ) );
    assert.equal( t.value, '<p>a <em>x^2</em> b</p>' );
} );

// ------------------------------------------------------------------ AI structure, plain text

test( 'the AI markup has a formula as one custom tag token, bold around it as <b>, and gives it back unchanged', () => {
    const schema = getSchema( M.ezoeExtensions() );
    const html = '<p>Text <strong>fett ' + latex( 'x^2' ) + '</strong> end</p>';
    const doc = schema.nodeFromJSON( M.fromEditorHTML( html ) );
    const { markup, map } = S.serialize( { mode: 'blocks', content: doc.content } );
    assert.equal( markup, '<p>Text <b>fett ⟦C1⟧</b> end</p>' );
    assert.equal( map.tokens.get( 'C1' ).label, 'Custom tag: math_latex' );
    const frag = S.rebuild( markup, map, schema, { mode: 'blocks' } );
    assert.equal( M.toEditorHTML( schema.topNodeType.create( null, frag ) ), html );
    // the formula's text is part of the plain text of the document
    assert.equal( doc.textBetween( 0, doc.content.size ), 'Text fett x^2 end' );
} );

// ------------------------------------------------------------------ line breaks, TeX comments, the element

test( 'the stored text of a formula has no line breaks: a break is a space, a TeX comment goes with its break', () => {
    const tex = ( s ) => M.storedCustomTagText( s, true );
    assert.equal( tex( '\\cdot\nx' ), '\\cdot x' );
    assert.equal( tex( 'a  \r\n\n   b' ), 'a b' );
    assert.equal( tex( 'a % Kommentar\n+ b' ), 'a + b' );
    assert.equal( tex( '\\alpha%\nbeta' ), '\\alpha beta', 'the comment ended the control word' );
    assert.equal( tex( '\\alpha%\n  2' ), '\\alpha2', 'no letter after it: nothing to separate' );
    assert.equal( tex( '\\\\alpha%\nbeta' ), '\\\\alphabeta', '\\\\ is a line break, alpha no control word' );
    assert.equal( tex( '50\\% of x\ny' ), '50\\% of x y', 'an escaped % is no comment' );
    assert.equal( tex( 'a\\\\% c\nb' ), 'a\\\\b', 'after \\\\ the % starts a comment' );
    assert.equal( tex( 'a % last line' ), 'a % last line', 'a comment without a line break stays, as on the server' );
    assert.equal( tex( '\u00a0a' ), '\u00a0a', 'a non-breaking space is no white space here' );
    // the spoken form of MathML is no TeX: a % is a percent sign
    assert.equal( M.storedCustomTagText( '50 % mehr\nals', false ), '50 % mehr als' );
} );

test( 'a line break typed into the content field, or a formula made of two paragraphs, is stored as a space', () => {
    const { t, inst } = start( '<p>Text ' + latex( 'MATH', 'alt' ) + ' end</p>' );
    selectAtom( inst );
    inst.runButton( 'custom' );
    fieldOf( 'Content' ).value = '\\cdot\n  x % c\n+ y';
    ok();
    assert.equal( t.value, '<p>Text ' + latex( '\\cdot x + y', 'alt' ) + ' end</p>' );

    const two = start( '<p>a+b</p><p>c+d</p>' );
    const doc = two.editor.state.doc;
    select( two.inst, 1, doc.firstChild.nodeSize + doc.child( 1 ).nodeSize - 1 );
    two.inst.runButton( 'custom' );
    setField( 'Name', 'math_latex' );
    ok();
    assert.equal( two.t.value, '<p><span class="ezoeItemCustomTag math_latex" type="custom" customattributes="display|inline">a+b c+d</span></p>' );
    // pasted or typed in the source view with a line break: read as it will be stored
    assert.equal( M.normalizeEditorHTML( '<p>' + latex( 'a\n b' ) + '</p>' ), '<p>' + latex( 'a b' ) + '</p>' );
} );

test( 'editing a formula written as <u> keeps the <u>', () => {
    const u = '<u class="ezoeItemCustomTag math_latex" type="custom" customattributes="display|inlineattribute_separationalt|x">x^2</u>';
    const { t, inst } = start( '<p>a ' + u + ' b</p>' );
    assert.equal( atoms( inst.editor ).length, 1 );
    selectAtom( inst );
    inst.runButton( 'custom' );
    fieldOf( 'Alt' ).value = 'neu';
    ok();
    assert.equal( t.value, '<p>a ' + u.replace( 'alt|x', 'alt|neu' ) + ' b</p>' );
} );
