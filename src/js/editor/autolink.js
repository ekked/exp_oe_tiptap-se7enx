/**
 * Autolink (TinyMCE's autolink plugin, #1121): a URL typed in a text and closed by a space or Enter becomes a link.
 *
 * Only http(s):// and www. words are linked (www. gets http:// as href). Not linked: a word that already carries the
 * link mark, a word in a literal (pre) block, and every word if the schema has no link mark. Punctuation at the end of
 * the word (. , ; : ! ? ) ] ' " and closing quotes) stays outside the link, a closing ) only if the URL has no
 * unclosed ( of its own (Wikipedia). The URL may follow whitespace or ( [ „ « ". An inline atom (hard break, embed,
 * anchor) is no part of a word: it ends the URL and may precede one. The space itself stays outside the link.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const PUNCT = '.,;:!?)\\]\'"»“”…';
const URL_AT_END = new RegExp(
    '(?:^|[\\s\\ufffc(\\[„«"])' +
    '((?:https?:\\/\\/|www\\.)[^\\s<>\\ufffc' + PUNCT + '][^\\s<>\\ufffc]*?)' +
    '([' + PUNCT + ']*)$', 'i' );

/**
 * @param {string} text the text of the block before the cursor (inline atoms as U+FFFC)
 * @returns {{start: number, url: string, href: string, trailing: number}|null} start offset in text, the URL, and
 *          the number of punctuation characters after it that stay outside the link
 */
export function urlAtEnd( text ) {
    const m = URL_AT_END.exec( text );
    if ( !m )
        return null;
    let url = m[1];
    let rest = m[2];
    const count = ( s, ch ) => s.split( ch ).length - 1;
    while ( rest[0] === ')' && count( url, '(' ) > count( url, ')' ) ) {
        url += ')';
        rest = rest.slice( 1 );
    }
    return {
        start: text.length - rest.length - url.length,
        url,
        href: /^www\./i.test( url ) ? 'http://' + url : url,
        trailing: rest.length
    };
}

/** Links the URL before the cursor, if there is one; the typed key itself is left to the editor */
function linkBeforeCursor( view ) {
    const { state } = view;
    const linkType = state.schema.marks.link;
    if ( !linkType || !state.selection.empty )
        return;
    const $pos = state.selection.$from;
    const parent = $pos.parent;
    if ( !parent.isTextblock || parent.type.spec.code )
        return;
    const before = parent.textBetween( 0, $pos.parentOffset, null, '￼' );
    const found = urlAtEnd( before );
    if ( !found )
        return;
    const start = $pos.start() + found.start;
    const end = $pos.pos - found.trailing;
    if ( state.doc.rangeHasMark( start, end, linkType ) )
        return;
    view.dispatch( state.tr.addMark( start, end, linkType.create( { href: found.href } ) ) );
}

export const Autolink = Extension.create( {
    name: 'exp-oe-autolink',
    addProseMirrorPlugins() {
        return [ new Plugin( {
            key: new PluginKey( 'exp-oe-autolink' ),
            props: {
                handleTextInput( view, from, to, text ) {
                    if ( from === to && /^\s$/.test( text ) )
                        linkBeforeCursor( view );
                    return false;
                },
                handleKeyDown( view, event ) {
                    if ( event.key === 'Enter' && !event.isComposing )
                        linkBeforeCursor( view );
                    return false;
                }
            }
        } ) ];
    }
} );
