/**
 * The editable source view (button code): the HTML the user changed there goes back into the editor.
 *
 * The way back: the text is parsed in an inert document of its own (nothing of it is ever part of the page), the
 * white space the source view added between blocks (formatSource) is taken out again, it is cleaned as pasted
 * editor HTML is (paste.js sanitizeSourceHTML: no scripts, styles, frames, SVG, event handlers, only safe links),
 * then the schema reads it, as it reads the textarea. What the schema cannot keep is listed before it is applied
 * (sourceChanges): the result is serialised again and compared with what was typed, by elements, attributes and
 * text, so white space and the order of attributes are no change.
 *
 * @license GPL-2.0-or-later
 */
import { sanitizeSourceHTML, inertDocument } from './paste.js';

const BLOCK = /^(P|H[1-6]|UL|OL|LI|TABLE|TBODY|THEAD|TFOOT|TR|TD|TH|PRE|DIV)$/;
/** Blocks without a counterpart in the schema: what is left of them is a paragraph */
const BLOCKISH = /^(div|section|article|header|footer|main|aside|nav|blockquote|figure|figcaption|address|center|dl|dt|dd|details|summary)$/;
/** The same element in other words: no change */
const ALIAS = { b: 'strong', i: 'em' };
/** Attributes of an editor (TinyMCE, ProseMirror) that never were content */
const IGNORED_ATTRIBUTE = /^(data-mce-.*|data-pm-slice|contenteditable|spellcheck)$/;

const isBlock = ( n ) => n && n.nodeType === 1 && BLOCK.test( n.nodeName.toUpperCase() );

/**
 * Takes out the white space formatSource puts between blocks: a run of white space with a line break next to a
 * block (or at the start or end of one) goes, one inside the text becomes a space. A literal (<pre>) is left as it is.
 */
export function unformatSource( root ) {
    const doc = root.ownerDocument;
    const walker = doc.createTreeWalker( root, 4 );
    const texts = [];
    let n;
    while ( ( n = walker.nextNode() ) )
        texts.push( n );
    for ( const text of texts ) {
        let v = text.nodeValue;
        if ( v.indexOf( '\n' ) === -1 || ( text.parentNode.closest && text.parentNode.closest( 'pre' ) ) )
            continue;
        const parent = text.parentNode, edge = parent === root || isBlock( parent );
        if ( text.previousSibling ? isBlock( text.previousSibling ) : edge )
            v = v.replace( /^[ \t\r]*\n[ \t\r\n]*/, '' );
        if ( text.nextSibling ? isBlock( text.nextSibling ) : edge )
            v = v.replace( /[ \t\r\n]*\n[ \t\r]*$/, '' );
        v = v.replace( /[ \t\r]*\n[ \t\r\n]*/g, ' ' );
        if ( v )
            text.nodeValue = v;
        else
            parent.removeChild( text );
    }
    return root;
}

/**
 * The values of an attribute as they are compared: a class by its names (the editor may add its own), a style by
 * its declarations (written as the browser writes them), anything else as it is
 */
function attributeValues( name, value ) {
    value = String( value || '' ).trim();
    if ( name === 'class' )
        return value.split( /\s+/ ).filter( Boolean );
    if ( name === 'style' )
        return value.split( ';' ).map( ( d ) => d.replace( /\s+/g, '' ).toLowerCase() ).filter( Boolean );
    return [ value ];
}

/** Elements, attributes and text of a piece of HTML, for the comparison */
function inventory( root ) {
    const tags = new Map(), attrs = new Map(), names = new Map();
    const add = ( map, key ) => map.set( key, ( map.get( key ) || 0 ) + 1 );
    for ( const el of Array.prototype.slice.call( root.querySelectorAll( '*' ) ) ) {
        const tag = el.nodeName.toLowerCase();
        // an empty paragraph (<p></p>, <p><br></p>) the editor leaves out at the end or around a table is no loss
        if ( tag === 'p' && !el.attributes.length && !el.textContent.trim() && !el.querySelector( ':not(br)' ) )
            continue;
        if ( tag === 'br' && el.parentNode && el.parentNode.nodeName === 'P' && el.parentNode.childNodes.length === 1 && !el.parentNode.attributes.length )
            continue;
        const name = ALIAS[tag] || tag;
        add( tags, name );
        if ( !names.has( name ) )
            names.set( name, new Set() );
        for ( const a of Array.prototype.slice.call( el.attributes ) ) {
            const attr = a.name.toLowerCase();
            if ( IGNORED_ATTRIBUTE.test( attr ) )
                continue;
            names.get( name ).add( attr );
            for ( const value of attributeValues( attr, a.value ) )
                add( attrs, name + ' ' + attr + ' ' + value );
        }
    }
    return { tags, attrs, names, text: String( root.textContent || '' ).replace( /[\s ]+/g, ' ' ).trim() };
}

/**
 * What the schema drops of the typed HTML: [ { type, tag, attribute, text } ], empty when nothing is lost.
 *   type 'paragraph' an element without a counterpart whose content became a paragraph (<div>)
 *        'element'   an element that is gone (<span style>; tag carries its attributes)
 *        'attribute' an attribute (or a value of it: a class name, a style declaration) that is gone from an
 *                    element that stays
 *        'text'      text that is gone (text: the typed text from the first difference on, shortened)
 *
 * @param {Element} typed  the typed HTML (unformatted, not cleaned)
 * @param {Element} result the HTML the editor makes of it
 */
export function sourceChanges( typed, result ) {
    const a = inventory( typed ), b = inventory( result );
    const changes = [];
    const moreParagraphs = ( b.tags.get( 'p' ) || 0 ) > ( a.tags.get( 'p' ) || 0 );
    const lostTags = new Set();
    for ( const [ tag, count ] of a.tags ) {
        if ( ( b.tags.get( tag ) || 0 ) >= count )
            continue;
        lostTags.add( tag );
        const attrs = Array.from( a.names.get( tag ) || [] ).sort();
        const label = '<' + [ tag ].concat( attrs ).join( ' ' ) + '>';
        changes.push( { type: BLOCKISH.test( tag ) && moreParagraphs ? 'paragraph' : 'element', tag: label } );
    }
    const reported = new Set();
    for ( const [ key, count ] of a.attrs ) {
        const [ tag, attribute ] = key.split( ' ' );
        if ( lostTags.has( tag ) || ( b.attrs.get( key ) || 0 ) >= count || reported.has( tag + ' ' + attribute ) )
            continue;
        reported.add( tag + ' ' + attribute );
        changes.push( { type: 'attribute', tag: '<' + tag + '>', attribute } );
    }
    if ( a.text !== b.text ) {
        let i = 0;
        while ( i < a.text.length && a.text[i] === b.text[i] )
            i++;
        const rest = a.text.slice( i );
        if ( rest )
            changes.push( { type: 'text', text: rest.length > 40 ? rest.slice( 0, 40 ) + '…' : rest } );
    }
    return changes;
}

/**
 * Reads the typed source as the editor would: cleaned, through the schema.
 *
 * @param {string} source the text of the source view
 * @param {Object} instance the editor instance (schema bridge, Tiptap editor)
 * @return {{ doc: Node, html: string, changes: Array, same: boolean }}
 *         doc the new document, html what the form would post, changes what is lost, same: the document or the
 *         HTML the form posts is unchanged (then Apply changes nothing)
 */
export function readSource( source, instance ) {
    const doc = inertDocument();
    const typed = unformatSource( Object.assign( doc.createElement( 'div' ), { innerHTML: String( source || '' ) } ) );
    const clean = sanitizeSourceHTML( typed.innerHTML, doc );
    const editor = instance.editor;
    const json = instance.schema.load( clean, editor.schema, { document: doc } );
    const node = editor.schema.nodeFromJSON( json );
    const html = instance.schema.serialize( node, { document: doc } );
    const result = Object.assign( doc.createElement( 'div' ), { innerHTML: html } );
    return { doc: node, html, changes: sourceChanges( typed, result ), same: node.eq( editor.state.doc ) || html === instance.getHTML() };
}

/** Puts the document read by readSource() into the editor: one transaction, one step of Undo */
export function applySource( instance, read ) {
    if ( read.same )
        return false;
    const editor = instance.editor;
    const state = editor.state;
    editor.view.dispatch( state.tr.replaceWith( 0, state.doc.content.size, read.doc.content ).setMeta( 'expOESource', true ).scrollIntoView() );
    return true;
}
