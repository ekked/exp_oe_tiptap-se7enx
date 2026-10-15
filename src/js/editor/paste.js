/**
 * Paste: what comes from Word, Excel, LibreOffice, Google Docs or a web page is cleaned to the structures ezxmltext
 * stores, the way ezoe's TinyMCE paste plugin and its paste_preprocess / paste_postprocess did (Word comments and
 * conditional comments, namespaced tags such as <o:p> and smart tags, mso- styles and classes, Word's list paragraphs
 * as real lists, empty spans, header, footer and comment parts, footnote and table of contents anchors).
 *
 * What stays: paragraphs, headings, lists, tables (with border, colspan and rowspan), links (href, title, target),
 * bold, italic, underline, sub- and superscript, line breaks and literal text; text alignment becomes ezoe's align
 * attribute. Everything else is unwrapped (its text stays) or, where it is no content (styles, scripts, images of the
 * clipboard, form controls), removed. A link stays only with a relative address or http(s), mailto, tel or ftp
 * (safeHref). The HTML is parsed in an inert document of its own, never in the page. HTML copied from this editor (ProseMirror's data-pm-slice) or from ezoe's own
 * dialect (ezoeItem classes, customattributes) is the schema's and stays as it is.
 *
 * Plain text: "Paste as text" (toolbar button pastetext, a switch like TinyMCE 3's) and Ctrl+Shift+V paste the text
 * only; a blank line starts a new paragraph, a single line break becomes a line break, as ezoe pastes text.
 *
 * @license GPL-2.0-or-later
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Slice, Fragment } from '@tiptap/pm/model';

/** Elements that are content of their own, with the attributes they keep */
const KEEP = {
    P: [ 'align' ], H1: [ 'align' ], H2: [ 'align' ], H3: [ 'align' ], H4: [ 'align' ], H5: [ 'align' ], H6: [ 'align' ],
    UL: [], OL: [], LI: [], PRE: [], BR: [],
    TABLE: [ 'border' ], THEAD: [], TBODY: [], TFOOT: [], TR: [], TD: [ 'colspan', 'rowspan', 'align' ], TH: [ 'colspan', 'rowspan', 'align' ],
    A: [ 'href', 'title', 'target' ], STRONG: [], B: [], EM: [], I: [], U: [], SUB: [], SUP: []
};

/** No content: removed with everything inside */
const DROP = /^(STYLE|SCRIPT|NOSCRIPT|TEMPLATE|META|LINK|TITLE|HEAD|XML|OBJECT|EMBED|IFRAME|FRAME|IMG|PICTURE|SVG|MATH|VIDEO|AUDIO|SOURCE|TRACK|CANVAS|MAP|AREA|INPUT|BUTTON|SELECT|OPTION|TEXTAREA|FORM|DEL|HR|COLGROUP|COL|W:.*|V:.*|O:.*|M:.*)$/;

/** Blocks without a counterpart: a paragraph when they hold only text, else unwrapped */
const BLOCKISH = /^(DIV|SECTION|ARTICLE|HEADER|FOOTER|MAIN|ASIDE|NAV|BLOCKQUOTE|FIGURE|FIGCAPTION|ADDRESS|DT|DD|DETAILS|SUMMARY|CENTER|CAPTION)$/;
const BLOCK_CHILD = /^(P|H[1-6]|UL|OL|LI|TABLE|PRE|DIV|SECTION|ARTICLE|HEADER|FOOTER|MAIN|ASIDE|NAV|BLOCKQUOTE|FIGURE|FIGCAPTION|ADDRESS|DL|DT|DD|DETAILS|SUMMARY|CENTER|CAPTION)$/;

const BULLET = /^[•·§Øo●○▪■◦–—➢✓✔*-]/;

/** HTML from Word or another Office program (also LibreOffice and Outlook) */
export function isOfficeHTML( html ) {
    return /class="?'?Mso|style="[^"]*\bmso-|<o:p\b|xmlns:[ow]=|urn:schemas-microsoft-com:office|<meta[^>]+(Microsoft Word|Excel|LibreOffice|OpenOffice)/i.test( html || '' );
}

/**
 * HTML this editor or ezoe wrote: the schema reads it as it is (after the link check of safeHref and without event
 * handlers). Only attributes count, never the text: data-pm-slice, ezoe's classes, customattributes.
 */
export function isEditorHTML( html ) {
    return /<[a-z][^>]*\sdata-pm-slice=|<[a-z][^>]*\sclass=["']?[^"'>]*\b(ezoeItem|mceItem)\w*|<[a-z][^>]*\scustomattributes=/i.test( html || '' );
}

/**
 * Whether a pasted link address may stay: no scheme (a relative address), or one of the allowed schemes. Spaces and
 * control characters are removed first, as browsers do (" javascript:", "java\tscript:" are javascript:).
 * @param {string}  href
 * @param {boolean} editor HTML of this editor or of ezoe: also #anchor, eznode:// and ezobject://
 */
export function safeHref( href, editor ) {
    const norm = String( href || '' ).replace( /[\u0000-\u0020\u007f-\u009f\u00a0\u1680\u2000-\u200d\u2028\u2029\u202f\u205f\u3000\ufeff]+/g, '' );
    if ( !norm )
        return false;
    if ( norm[0] === '#' )
        return !!editor;
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec( norm );
    if ( !scheme )
        return true;                                         // a relative address
    return ( editor ? /^(https?|mailto|tel|ftp|eznode|ezobject)$/i : /^(https?|mailto|tel|ftp)$/i ).test( scheme[1] );
}

/** HTML of this editor or of ezoe: unsafe links become their text, event handlers and scripts go */
function sanitizeEditorHTML( root ) {
    for ( const el of elements( root ) ) {
        if ( !el.parentNode )
            continue;
        if ( /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|FRAME|META|LINK|BASE|FORM)$/.test( el.nodeName ) ) {
            el.parentNode.removeChild( el );
            continue;
        }
        for ( const a of Array.prototype.slice.call( el.attributes ) ) {
            if ( /^on/i.test( a.name ) || ( /^(src|action|formaction|xlink:href)$/i.test( a.name ) && /^\s*(javascript|vbscript|data):/i.test( a.value.replace( /[\u0000-\u0020]+/g, '' ) ) ) )
                el.removeAttribute( a.name );
        }
        if ( el.nodeName === 'A' && el.hasAttribute( 'href' ) && !safeHref( el.getAttribute( 'href' ), true ) )
            unwrap( el );
    }
}

function styleOf( el ) {
    return String( el.getAttribute( 'style' ) || '' ).toLowerCase();
}

function unwrap( el ) {
    const parent = el.parentNode;
    if ( !parent )
        return;
    while ( el.firstChild )
        parent.insertBefore( el.firstChild, el );
    parent.removeChild( el );
}

function rename( el, tag ) {
    const next = el.ownerDocument.createElement( tag );
    while ( el.firstChild )
        next.appendChild( el.firstChild );
    el.parentNode.replaceChild( next, el );
    return next;
}

/** Wraps the children of el into new elements (strong, em ...) from the inside out */
function wrapChildren( el, tags ) {
    for ( const tag of tags ) {
        const w = el.ownerDocument.createElement( tag );
        while ( el.firstChild )
            w.appendChild( el.firstChild );
        el.appendChild( w );
    }
}

function elements( root ) {
    return Array.prototype.slice.call( root.querySelectorAll( '*' ) );
}

/** Word list paragraphs (MsoListParagraph..., style mso-list: lN levelM) as nested <ul>/<ol> */
function convertOfficeLists( root ) {
    const doc = root.ownerDocument;
    const paragraphs = Array.prototype.slice.call( root.querySelectorAll( 'p' ) ).filter( ( p ) =>
        /mso-list:\s*l\d+/i.test( p.getAttribute( 'style' ) || '' ) || /MsoListParagraph/i.test( p.getAttribute( 'class' ) || '' ) );
    let stack = [], lastParagraph = null;
    for ( const p of paragraphs ) {
        const m = /mso-list:\s*l\d+\s+level(\d+)/i.exec( p.getAttribute( 'style' ) || '' );
        const level = m ? Math.max( 1, parseInt( m[1], 10 ) ) : 1;
        // the marker: Word's span with mso-list:Ignore (bullet or number), else the start of the text
        let marker = '';
        const ignore = Array.prototype.find.call( p.querySelectorAll( 'span' ), ( s ) => /mso-list:\s*ignore/i.test( s.getAttribute( 'style' ) || '' ) );
        if ( ignore ) {
            marker = ignore.textContent.replace( /[\s ]+/g, '' );
            ignore.parentNode.removeChild( ignore );
        }
        else {
            const text = p.textContent.replace( /^[\s ]+/, '' );
            const mm = /^([•·§Ø●○▪■◦]|\(?[0-9a-zA-Z]{1,4}[.)])[\s ]+/.exec( text );
            if ( mm ) {
                marker = mm[1];
                stripLeadingText( p, mm[0].length + ( p.textContent.length - p.textContent.replace( /^[\s ]+/, '' ).length ) );
            }
        }
        const type = !marker || BULLET.test( marker ) && !/^\(?[0-9a-zA-Z]{1,4}[.)]$/.test( marker ) ? 'UL' : 'OL';
        // a run of list paragraphs: the previous one must be the paragraph right before this one
        const adjacent = lastParagraph && nextElement( lastParagraph.marker ) === p;
        if ( !adjacent )
            stack = [];
        while ( stack.length > level )
            stack.pop();
        while ( stack.length && stack.length === level && stack[stack.length - 1].list.nodeName !== type )
            stack.pop();
        while ( stack.length < level ) {
            const list = doc.createElement( type );
            let parentItem = stack.length ? stack[stack.length - 1].list.lastElementChild : null;
            // a list that starts deeper than level 1: an item holds the nested list
            if ( !parentItem && stack.length ) {
                parentItem = doc.createElement( 'li' );
                stack[stack.length - 1].list.appendChild( parentItem );
            }
            if ( parentItem )
                parentItem.appendChild( list );
            else
                p.parentNode.insertBefore( list, p );
            stack.push( { list } );
        }
        const li = doc.createElement( 'li' );
        while ( p.firstChild )
            li.appendChild( p.firstChild );
        stack[stack.length - 1].list.appendChild( li );
        // the paragraph stays as a marker of the position until the next one is handled
        p.removeAttribute( 'style' );
        p.removeAttribute( 'class' );
        lastParagraph = { marker: p };
        p.setAttribute( 'data-exp-oe-list-done', '' );
    }
    root.querySelectorAll( 'p[data-exp-oe-list-done]' ).forEach( ( p ) => p.parentNode.removeChild( p ) );
}

/** The next element sibling, skipping white space text and comments */
function nextElement( el ) {
    let n = el.nextSibling;
    while ( n && ( n.nodeType === 8 || ( n.nodeType === 3 && !n.nodeValue.trim() ) ) )
        n = n.nextSibling;
    return n;
}

/** Removes the first `count` characters of the text of an element */
function stripLeadingText( el, count ) {
    const walker = el.ownerDocument.createTreeWalker( el, 4 );
    let node;
    while ( count > 0 && ( node = walker.nextNode() ) ) {
        const take = Math.min( count, node.nodeValue.length );
        node.nodeValue = node.nodeValue.slice( take );
        count -= take;
    }
}

/** Formatting written as styles (Google Docs, LibreOffice, web pages) as elements */
function stylesToElements( el ) {
    const style = styleOf( el );
    if ( !style )
        return el;
    const tags = [];
    const weight = /font-weight\s*:\s*(bold|bolder|[6-9]00)/.test( style );
    const normalWeight = /font-weight\s*:\s*(normal|[1-4]00)/.test( style );
    if ( weight && !/^(STRONG|B|H[1-6]|TH)$/.test( el.nodeName ) )
        tags.push( 'strong' );
    if ( /font-style\s*:\s*italic/.test( style ) && !/^(EM|I)$/.test( el.nodeName ) )
        tags.push( 'em' );
    // a link's underline is the link's look (Google Docs, web pages), not the underline tag
    if ( /text-decoration[^;]*underline/.test( style ) && el.nodeName !== 'U' && !el.closest( 'a' ) )
        tags.push( 'u' );
    if ( /vertical-align\s*:\s*super/.test( style ) )
        tags.push( 'sup' );
    else if ( /vertical-align\s*:\s*sub/.test( style ) )
        tags.push( 'sub' );
    if ( tags.length )
        wrapChildren( el, tags );
    // Google Docs wraps everything in <b style="font-weight:normal">
    if ( normalWeight && /^(B|STRONG)$/.test( el.nodeName ) ) {
        unwrap( el );
        return null;
    }
    const align = /text-align\s*:\s*(left|center|right|justify)/.exec( style );
    if ( align && /^(P|H[1-6]|TD|TH)$/.test( el.nodeName ) && !el.getAttribute( 'align' ) )
        el.setAttribute( 'align', align[1] );
    return el;
}

/**
 * Cleans pasted HTML to what ezxmltext can store.
 *
 * @param {string} html
 * @return {string}
 */
export function cleanPastedHTML( html ) {
    if ( !html )
        return html;
    // an inert document: nothing pasted is ever part of the page (an image would load, an onerror run)
    const doc = document.implementation.createHTMLDocument( '' );
    if ( isEditorHTML( html ) ) {
        doc.body.innerHTML = String( html );
        sanitizeEditorHTML( doc.body );
        return doc.body.innerHTML;
    }
    const office = isOfficeHTML( html );
    // the fragment Office and browsers put on the clipboard (<!--StartFragment-->), without the document around it
    let source = String( html );
    const fragment = /<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/.exec( source );
    if ( fragment )
        source = fragment[1];
    source = source
        .replace( /<\?xml[^>]*>/gi, '' )
        .replace( /<!\[if [^\]]*\]>|<!\[endif\]>/gi, '' )      // Word's downlevel-revealed conditionals
        .replace( /<!--[\s\S]*?-->/g, '' );                    // comments and Word's conditional comments
    doc.body.innerHTML = source;
    const root = doc.body;

    // Word's parts that are not the text: header, footer, comments; separators of foot- and endnotes
    for ( const el of elements( root ) ) {
        if ( !el.parentNode )
            continue;
        const style = styleOf( el );
        if ( /mso-element\s*:\s*(header|footer|comment-list|comment|footnote-separator|endnote-separator|footnote-continuation-separator|endnote-continuation-separator)\b/.test( style ) ||
             /MsoCommentReference|msocomoff|msocomanchor/i.test( el.getAttribute( 'class' ) || '' ) ||
             ( el.nodeName === 'A' && /^#_msocom/i.test( el.getAttribute( 'href' ) || '' ) ) ||
             ( el.nodeName === 'BR' && el.getAttribute( 'clear' ) ) ||
             /display\s*:\s*none|mso-hide\s*:\s*all/.test( style ) )
            el.parentNode.removeChild( el );
    }
    if ( office )
        convertOfficeLists( root );

    for ( const el of elements( root ) ) {
        if ( !el.parentNode )
            continue;
        const name = el.nodeName.toUpperCase();
        if ( DROP.test( name ) ) {
            el.parentNode.removeChild( el );
            continue;
        }
        // Word's runs of spaces and tabs: plain spaces
        if ( /mso-spacerun|mso-tab-count/.test( styleOf( el ) ) ) {
            el.replaceWith( doc.createTextNode( /mso-tab-count/.test( styleOf( el ) ) ? ' ' : el.textContent.replace( / /g, ' ' ) ) );
            continue;
        }
        const kept = stylesToElements( el );
        if ( !kept )
            continue;
        // links: only real addresses; anchors, Word's bookmarks (_Toc, _GoBack, footnotes) and local files are text
        if ( name === 'A' ) {
            if ( !safeHref( el.getAttribute( 'href' ), false ) ) {
                unwrap( el );
                continue;
            }
        }
        if ( name.indexOf( ':' ) !== -1 ) {
            unwrap( el );                                    // smart tags (st1:place ...)
            continue;
        }
        if ( BLOCKISH.test( name ) ) {
            const hasBlocks = Array.prototype.some.call( el.children, ( c ) => BLOCK_CHILD.test( c.nodeName.toUpperCase() ) );
            if ( hasBlocks || !el.textContent.trim() )
                unwrap( el );
            else {
                const p = rename( el, 'p' );
                if ( name === 'CAPTION' ) {
                    // a table's caption: a paragraph before the table
                    const table = p.closest( 'table' );
                    if ( table )
                        table.parentNode.insertBefore( p, table );
                }
            }
            continue;
        }
        if ( !KEEP[name] ) {
            unwrap( el );                                    // span, font, code, small, mark, abbr, ins ...
            continue;
        }
        for ( const a of Array.prototype.slice.call( el.attributes ) ) {
            if ( KEEP[name].indexOf( a.name.toLowerCase() ) === -1 )
                el.removeAttribute( a.name );
        }
        if ( name === 'A' && el.getAttribute( 'target' ) && el.getAttribute( 'target' ) !== '_blank' )
            el.removeAttribute( 'target' );
    }

    // a line break between blocks (Google Docs puts one after a list) is no line of text
    Array.prototype.slice.call( root.children ).forEach( ( el ) => {
        if ( el.nodeName === 'BR' )
            root.removeChild( el );
    } );
    // empty inline formatting goes; a paragraph of only (non-breaking) spaces is an empty paragraph
    for ( const el of elements( root ).reverse() ) {
        if ( /^(STRONG|B|EM|I|U|SUB|SUP|A)$/.test( el.nodeName ) && !el.textContent && !el.querySelector( 'br' ) )
            el.parentNode.removeChild( el );
        else if ( /^(P|H[1-6])$/.test( el.nodeName ) && !el.children.length && !el.textContent.replace( /[\s ]+/g, '' ) )
            el.textContent = '';
    }
    return root.innerHTML;
}

/**
 * Plain text as ezoe pastes it: paragraphs at blank lines, line breaks within them.
 *
 * @return {Slice}
 */
export function textToSlice( text, schema ) {
    const paragraphs = String( text || '' ).replace( /\r\n?/g, '\n' ).split( /\n[ \t]*\n+/ );
    const para = schema.nodes.paragraph, br = schema.nodes.hardBreak;
    const nodes = paragraphs.map( ( block ) => {
        const parts = [];
        block.split( '\n' ).forEach( ( line, i ) => {
            if ( i && br )
                parts.push( br.create() );
            if ( line )
                parts.push( schema.text( line ) );
        } );
        return para.create( null, parts );
    } );
    return new Slice( Fragment.from( nodes ), 1, 1 );
}

/** The paste handling of an editor instance (instance.pasteAsText: the switch of the pastetext button) */
export function pasteExtension( instance ) {
    let plainOnce = 0;
    return Extension.create( {
        name: 'expOEPaste',
        addKeyboardShortcuts() {
            const plain = () => {
                // the browser pastes next (its own paste as plain text); the paste handler takes the text only
                plainOnce = Date.now();
                return false;
            };
            return { 'Mod-Shift-v': plain, 'Mod-Shift-V': plain };
        },
        addProseMirrorPlugins() {
            return [ new Plugin( {
                key: new PluginKey( 'expOEPaste' ),
                props: {
                    // the next paste after Ctrl+Shift+V, not one after another key (a plain Ctrl+V)
                    handleKeyDown: ( view, event ) => {
                        if ( plainOnce && !/^(Shift|Control|Meta|Alt)$/.test( event.key ) && !( ( event.ctrlKey || event.metaKey ) && event.shiftKey && /^v$/i.test( event.key ) ) )
                            plainOnce = 0;
                        return false;
                    },
                    transformPastedHTML: ( html ) => cleanPastedHTML( html ),
                    // in literal text the default keeps the line breaks as they are
                    clipboardTextParser: ( text, $context, plain, view ) => ( $context.parent.type.spec.code ? null : textToSlice( text, view.state.schema ) ),
                    handlePaste: ( view, event ) => {
                        const once = plainOnce && Date.now() - plainOnce < 1500;
                        plainOnce = 0;
                        if ( !instance.pasteAsText && !once )
                            return false;
                        const data = event && event.clipboardData;
                        const text = data ? data.getData( 'text/plain' ) : '';
                        if ( !text )
                            return !!( data && data.getData( 'text/html' ) );   // nothing as text: paste nothing rather than formatting
                        view.dispatch( view.state.tr.replaceSelection( textToSlice( text, view.state.schema ) ).scrollIntoView().setMeta( 'paste', true ).setMeta( 'uiEvent', 'paste' ) );
                        return true;
                    }
                }
            } ) ];
        }
    } );
}
