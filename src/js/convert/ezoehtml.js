/**
 * Post-processing of the HTML Tiptap serialises, so that it is the HTML ezoe's TinyMCE posts and eZOEInputParser
 * expects (the same clean-ups ezoe's own plugins make when the form is saved):
 *
 *  - an empty paragraph is <p><br></p> (TinyMCE's form; the parser keeps it as an empty paragraph)
 *  - a list item with a single paragraph without attributes is written without the <p> (eZOEXMLInput writes it so)
 *  - the preview inside <div>/<span> embeds becomes the text "ezembed" (ezembed plugin, issue 18264)
 *  - the ezoeAlign<align> helper class of image embeds is removed (ezembed plugin, EZP-22487)
 *  - line breaks in a <pre> are <br> (eZOEXMLInput writes them so; the parser reads both)
 *
 * and the pre-processing of the HTML eZOEXMLInput::inputXML() writes, before Tiptap parses it (prepareFromEzoe()).
 *
 * @license GPL-2.0-or-later
 */

const BLOCK_IN_LI = /^(ul|ol)$/i;

function isElement( node, name ) {
    return node && node.nodeType === 1 && ( !name || node.nodeName.toLowerCase() === name );
}

function hasAttributes( element ) {
    return element.attributes && element.attributes.length > 0;
}

function isBareParagraph( node ) {
    return isElement( node, 'p' ) && !hasAttributes( node );
}

/** A paragraph that holds nothing but one <br> (not TinyMCE's bogus one, which the schema ignores anyway) */
function isBreakParagraph( node ) {
    return isElement( node, 'p' ) && node.childNodes.length === 1 && isElement( node.firstChild, 'br' ) &&
        !node.firstChild.hasAttribute( 'data-mce-bogus' );
}

/**
 * Removes from the parsed editor HTML what only TinyMCE's way of editing put there, so it does not turn into empty
 * paragraphs of the Tiptap document (which were then posted, shown and, after the next switch, multiplied):
 *
 *  - empty <p></p> without attributes. eZOEXMLInput writes a paragraph that holds a block (table, list, embed, custom
 *    tag) as <p><table>...</table></p> (and so does wrapTables()); TinyMCE keeps that, but the HTML parser of the browser closes the <p> before
 *    the block and makes a second, empty <p></p> of the stray </p> after it. ezoe writes every empty paragraph of
 *    the ezxml as <p><br></p>, so an empty <p></p> never is content.
 *  - the <p><br></p> eZOEXMLInput::inputXML() appends to every text, the line TinyMCE needs to put the cursor after a
 *    last table or embed (eZOEXMLInput::validateInput() removes it again on store). Tiptap places the cursor there
 *    with its gap cursor. Only for a whole document (options.trailer), not for a fragment of a dialog.
 *  - the <br> of <p><br></p>: TinyMCE's form of an empty paragraph, not a line break (typing into it would make
 *    "text<br>" of it). The serialiser writes the <br> again (cleanupForEzoe()).
 *
 * @param {Element} root the element the HTML was parsed into
 * @param {object} [options]
 * @param {boolean} [options.trailer=true] remove the empty paragraph at the end
 * @returns {Element} root
 */
export function prepareFromEzoe( root, options = {} ) {
    root.querySelectorAll( 'p' ).forEach( p => {
        if ( p.childNodes.length === 0 && isBareParagraph( p ) )
            p.remove();
    } );
    if ( options.trailer !== false && root.lastChild && isBareParagraph( root.lastChild ) && isBreakParagraph( root.lastChild ) )
        root.removeChild( root.lastChild );
    root.querySelectorAll( 'p' ).forEach( p => {
        if ( isBreakParagraph( p ) )
            p.removeChild( p.firstChild );
    } );
    return root;
}

/**
 * Removes the empty paragraphs at the end of a serialised document: eZOEXMLInput::validateInput() would remove the
 * last one and eZOEInputParser drops empty paragraphs, so they are never stored; leaving them out keeps the posted
 * HTML the same however often the text goes through the editor.
 *
 * @param {Element} root
 * @returns {Element} root
 */
export function trimTrailingParagraphs( root ) {
    while ( root.lastChild && isBareParagraph( root.lastChild ) &&
            ( root.lastChild.childNodes.length === 0 || isBreakParagraph( root.lastChild ) ) )
        root.removeChild( root.lastChild );
    return root;
}

const TABLE_CONTAINER = /^(td|th|div)$/i;

/** A block embed as the editor writes it (<div id="eZObject_1" ... class="ezoeItemNonEditable ...">) */
function isBlockEmbed( node ) {
    return isElement( node, 'div' ) && /\bezoeItemNonEditable\b/.test( node.getAttribute( 'class' ) || '' );
}

/**
 * Writes every table of the document (and of a table cell or a block custom tag) in a paragraph of its own,
 * <p><table>...</table></p>, as eZOEXMLInput::inputXML() writes it and TinyMCE posts it. eZOEInputParser puts blocks
 * that follow each other without a <p> into one ezxml paragraph: two tables in a row, or a table after a list, were
 * stored as one paragraph instead of two. prepareFromEzoe() takes the paragraph out again when the text is loaded.
 *
 * A table after a bare <br> (the <line> of block embeds, see BlockBreak in schema/nodes.js) shares the paragraph of
 * that line, as eZOEXMLInput wrote it: the embeds and the <br> go into the same <p>.
 *
 * @param {Element} root
 * @returns {Element} root
 */
export function wrapTables( root ) {
    root.querySelectorAll( 'table' ).forEach( table => {
        const parent = table.parentNode;
        if ( parent !== root && !( isElement( parent ) && TABLE_CONTAINER.test( parent.nodeName ) ) )
            return;
        let first = table;
        if ( isElement( first.previousSibling, 'br' ) ) {
            first = first.previousSibling;
            while ( isBlockEmbed( first.previousSibling ) )
                first = first.previousSibling;
        }
        const p = table.ownerDocument.createElement( 'p' );
        parent.insertBefore( p, first );
        while ( p.nextSibling !== table )
            p.appendChild( p.nextSibling );
        p.appendChild( table );
    } );
    return root;
}

/**
 * Applies the save clean-ups to the children of `root` (a DOM element holding the serialised document).
 *
 * @param {Element} root
 * @param {object} [options]
 * @param {boolean} [options.save=true] replace embed previews by "ezembed" and drop ezoeAlign classes
 */
export function cleanupForEzoe( root, options = {} ) {
    const save = options.save !== false;
    const doc = root.ownerDocument;

    root.querySelectorAll( 'p' ).forEach( p => {
        if ( p.childNodes.length === 0 )
            p.appendChild( doc.createElement( 'br' ) );
    } );

    root.querySelectorAll( 'li' ).forEach( li => {
        const children = Array.from( li.childNodes );
        if ( !children.length || !isElement( children[ 0 ], 'p' ) || hasAttributes( children[ 0 ] ) )
            return;
        const rest = children.slice( 1 );
        if ( rest.some( child => !isElement( child ) || !BLOCK_IN_LI.test( child.nodeName ) ) )
            return;
        const p = children[ 0 ];
        // an empty paragraph keeps its <br> only when it is the whole item
        if ( p.childNodes.length === 1 && isElement( p.firstChild, 'br' ) && rest.length )
            p.removeChild( p.firstChild );
        while ( p.firstChild )
            li.insertBefore( p.firstChild, p );
        li.removeChild( p );
    } );

    root.querySelectorAll( 'pre' ).forEach( pre => {
        Array.from( pre.childNodes ).forEach( child => {
            if ( child.nodeType !== 3 || child.nodeValue.indexOf( '\n' ) === -1 )
                return;
            const parts = child.nodeValue.split( '\n' );
            parts.forEach( ( part, index ) => {
                if ( index > 0 )
                    pre.insertBefore( doc.createElement( 'br' ), child );
                if ( part !== '' )
                    pre.insertBefore( doc.createTextNode( part ), child );
            } );
            pre.removeChild( child );
        } );
    } );

    if ( save ) {
        root.querySelectorAll( 'div.ezoeItemNonEditable, span.ezoeItemNonEditable' ).forEach( node => {
            node.textContent = 'ezembed';
        } );
        root.querySelectorAll( '[class*="ezoeAlign"]' ).forEach( node => {
            node.classList.remove( 'ezoeAlign' + node.getAttribute( 'align' ) );
            if ( !node.getAttribute( 'class' ) )
                node.removeAttribute( 'class' );
        } );
    }
    return root;
}
