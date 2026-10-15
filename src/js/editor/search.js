/**
 * Find and replace: a ProseMirror plugin that finds a text in the document and marks the matches (decorations, never
 * stored), and the functions the search bar (ui/search-bar.js) calls. A match never crosses a paragraph, a line
 * break or an inline object (embed, anchor, custom tag image); the search is literal text, with or without case.
 *
 * @license GPL-2.0-or-later
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const NAME = 'expOESearch';
export const searchKey = new PluginKey( NAME );

const EMPTY = { query: '', caseSensitive: false, matches: [], current: -1 };

/**
 * The matches of `query` in `doc`.
 * @return {Array} [ { from, to } ] in document order
 */
export function findMatches( doc, query, caseSensitive ) {
    const result = [];
    if ( !query )
        return result;
    const re = new RegExp( query.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ), caseSensitive ? 'g' : 'gi' );
    doc.descendants( ( node, pos ) => {
        if ( !node.isTextblock )
            return true;
        // the text of the block, one character per position; inline objects are a character no query has
        let text = '';
        node.forEach( ( child ) => {
            text += child.isText ? child.text : '￼'.repeat( child.nodeSize );
        } );
        re.lastIndex = 0;
        let m;
        while ( ( m = re.exec( text ) ) ) {
            result.push( { from: pos + 1 + m.index, to: pos + 1 + m.index + m[0].length } );
            if ( !m[0].length )
                re.lastIndex++;
        }
        return false;
    } );
    return result;
}

/** The index of the first match at or after pos (wraps to the first) */
function indexFrom( matches, pos ) {
    if ( !matches.length )
        return -1;
    const i = matches.findIndex( ( m ) => m.from >= pos );
    return i === -1 ? 0 : i;
}

export function searchState( state ) {
    return searchKey.getState( state ) || EMPTY;
}

export const SearchExtension = Extension.create( {
    name: NAME,
    addProseMirrorPlugins() {
        return [ new Plugin( {
            key: searchKey,
            state: {
                init: () => EMPTY,
                apply( tr, value, old, state ) {
                    const meta = tr.getMeta( searchKey );
                    if ( meta ) {
                        const query = meta.query !== undefined ? meta.query : value.query;
                        const caseSensitive = meta.caseSensitive !== undefined ? meta.caseSensitive : value.caseSensitive;
                        const matches = findMatches( state.doc, query, caseSensitive );
                        let current = meta.current !== undefined ? meta.current : indexFrom( matches, meta.from !== undefined ? meta.from : 0 );
                        if ( current >= matches.length )
                            current = matches.length ? 0 : -1;
                        return { query, caseSensitive, matches, current };
                    }
                    if ( tr.docChanged && value.query ) {
                        const matches = findMatches( state.doc, value.query, value.caseSensitive );
                        const at = value.current >= 0 && value.matches[value.current] ? tr.mapping.map( value.matches[value.current].from ) : 0;
                        return Object.assign( {}, value, { matches, current: indexFrom( matches, at ) } );
                    }
                    return value;
                }
            },
            props: {
                decorations( state ) {
                    const { matches, current } = searchState( state );
                    if ( !matches.length )
                        return null;
                    return DecorationSet.create( state.doc, matches.map( ( m, i ) =>
                        Decoration.inline( m.from, m.to, { class: i === current ? 'exp-oe-search-match exp-oe-search-current' : 'exp-oe-search-match' } ) ) );
                }
            }
        } ) ];
    }
} );

/** Sets the query (and the case option); the current match is the first one at or after the cursor */
export function setSearch( view, query, caseSensitive ) {
    view.dispatch( view.state.tr.setMeta( searchKey, { query, caseSensitive, from: view.state.selection.from } ).setMeta( 'addToHistory', false ) );
    return searchState( view.state );
}

/** Selects match i (and scrolls to it) */
function select( view, i ) {
    const { matches } = searchState( view.state );
    const m = matches[i];
    if ( !m )
        return;
    const tr = view.state.tr.setMeta( searchKey, { current: i } ).setSelection( TextSelection.create( view.state.doc, m.from, m.to ) ).scrollIntoView();
    view.dispatch( tr );
}

/** Moves to the next (dir 1) or previous (dir -1) match */
export function goTo( view, dir ) {
    const { matches, current } = searchState( view.state );
    if ( !matches.length )
        return searchState( view.state );
    select( view, current < 0 ? 0 : ( current + dir + matches.length ) % matches.length );
    return searchState( view.state );
}

/** Replaces the current match and moves to the next one */
export function replaceCurrent( view, text ) {
    const { matches, current } = searchState( view.state );
    const m = matches[current];
    if ( !m )
        return searchState( view.state );
    const tr = view.state.tr;
    if ( text )
        tr.insertText( text, m.from, m.to );
    else
        tr.delete( m.from, m.to );
    view.dispatch( tr );
    const after = searchState( view.state );
    if ( after.matches.length ) {
        const end = m.from + ( text || '' ).length;
        select( view, indexFrom( after.matches, end ) );
    }
    return searchState( view.state );
}

/** Replaces every match in one step (one undo); returns how many were replaced */
export function replaceAll( view, text ) {
    const { matches } = searchState( view.state );
    if ( !matches.length )
        return 0;
    const tr = view.state.tr;
    for ( let i = matches.length - 1; i >= 0; i-- ) {
        if ( text )
            tr.insertText( text, matches[i].from, matches[i].to );
        else
            tr.delete( matches[i].from, matches[i].to );
    }
    view.dispatch( tr );
    return matches.length;
}

/** Removes the marks of the matches */
export function clearSearch( view ) {
    view.dispatch( view.state.tr.setMeta( searchKey, { query: '' } ).setMeta( 'addToHistory', false ) );
}
